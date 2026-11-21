#!/usr/bin/env python3
"""Generate and publish one Daily Digest edition through the OpenAI API."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from openai import OpenAI

from update_website import (
    DATA_DIR,
    Digest,
    DigestError,
    parse_date,
    publish_digest,
    repair_existing_archive,
    today_in_ist,
    validate_digest,
)


ROOT = Path(__file__).resolve().parent
BRIEF_PATH = ROOT / "DIGEST_BRIEF.md"
DEFAULT_MODEL = "gpt-5.6-terra"
CHEAP_MODEL = "gpt-5.4-mini"
DEFAULT_REASONING_EFFORT = "medium"
ADVANCE_REASONING_EFFORT = "medium"
CHEAP_REASONING_EFFORT = "low"
DEFAULT_MAX_TOOL_CALLS = 12
ADVANCE_MAX_TOOL_CALLS = 10
CHEAP_MAX_TOOL_CALLS = 8
DEFAULT_MAX_OUTPUT_TOKENS = 18_000
ADVANCE_MAX_OUTPUT_TOKENS = DEFAULT_MAX_OUTPUT_TOKENS
CHEAP_MAX_OUTPUT_TOKENS = 14_000
SEARCH_CONTEXT_SIZE = "medium"
CHEAP_SEARCH_CONTEXT_SIZE = "low"
TEXT_VERBOSITY = "medium"
CHEAP_TEXT_VERBOSITY = "low"
ACTIVE_RESPONSE_STATES = {"queued", "in_progress"}
MAX_ADVANCE_DAYS = 7


@dataclass(frozen=True)
class GenerationProfile:
    """Token and model limits for one type of edition."""

    model: str
    reasoning_effort: str
    max_tool_calls: int
    max_output_tokens: int
    search_context_size: str = SEARCH_CONTEXT_SIZE
    text_verbosity: str = TEXT_VERBOSITY


def _usage_field(value: Any, name: str, default: int | None = None) -> int | None:
    """Read a usage field from either an SDK object or a test/API dictionary."""
    if value is None:
        return default
    if isinstance(value, dict):
        return value.get(name, default)
    return getattr(value, name, default)


def response_token_usage(response: Any) -> dict[str, int] | None:
    """Return the token counters exposed by the Responses API, when available."""
    usage = getattr(response, "usage", None)
    if usage is None:
        return None
    input_details = _usage_field(usage, "input_tokens_details")
    output_details = _usage_field(usage, "output_tokens_details")
    return {
        "input_tokens": _usage_field(usage, "input_tokens", 0) or 0,
        "cached_input_tokens": _usage_field(input_details, "cached_tokens", 0) or 0,
        "output_tokens": _usage_field(usage, "output_tokens", 0) or 0,
        "reasoning_tokens": _usage_field(output_details, "reasoning_tokens", 0) or 0,
        "total_tokens": _usage_field(usage, "total_tokens", 0) or 0,
    }


def print_token_usage(response: Any) -> None:
    usage = response_token_usage(response)
    if usage is None:
        print("Token usage: unavailable in the completed response.")
        return
    print(
        "Token usage: "
        f"input={usage['input_tokens']}, "
        f"cached_input={usage['cached_input_tokens']}, "
        f"output={usage['output_tokens']}, "
        f"reasoning={usage['reasoning_tokens']}, "
        f"total={usage['total_tokens']}"
    )


def used_paper_titles(exclude_date: date, limit: int = 24) -> list[str]:
    titles: list[str] = []
    for path in sorted(DATA_DIR.glob("????-??-??.json"), reverse=True):
        if path.stem == exclude_date.isoformat():
            continue
        try:
            papers = json.loads(path.read_text(encoding="utf-8")).get("papers", {})
        except (OSError, json.JSONDecodeError, AttributeError):
            continue
        for paper in papers.values():
            if isinstance(paper, dict) and paper.get("title"):
                titles.append(str(paper["title"]))
        if len(titles) >= limit:
            break
    return titles[:limit]


def recent_inside_tracks(exclude_date: date, issue_limit: int = 6) -> list[str]:
    tracks: list[str] = []
    issues_read = 0
    for path in sorted(DATA_DIR.glob("????-??-??.json"), reverse=True):
        if path.stem == exclude_date.isoformat():
            continue
        try:
            papers = json.loads(path.read_text(encoding="utf-8")).get("papers", {})
        except (OSError, json.JSONDecodeError, AttributeError):
            continue
        fields = [
            str((papers.get(key) or {}).get("field", "")).strip()
            for key in ("domain1", "domain2")
            if isinstance(papers.get(key), dict)
        ]
        if fields:
            tracks.append(f"{path.stem}: {'; '.join(field for field in fields if field)}")
            issues_read += 1
        if issues_read >= issue_limit:
            break
    return tracks


def edition_context(report_date: date, advance: bool = False) -> str:
    if advance:
        date_context = (
            f"This is an advance vacation edition for the future date {report_date.isoformat()}. "
            f"It is actually being generated on {today_in_ist().isoformat()}. Do not predict future "
            "news or prices. Use sourced evergreen knowledge and the unavailable market values from "
            "the advance-edition rules."
        )
    elif report_date == today_in_ist():
        date_context = "Use information available today and prioritize developments from the last 24 hours."
    else:
        date_context = (
            f"This is a historical edition. Report the state of the world on {report_date.isoformat()} "
            "and do not use later outcomes as if they were already known."
        )

    used_titles = used_paper_titles(report_date)
    recent_tracks = recent_inside_tracks(report_date)
    archive_context = ""
    if recent_tracks:
        archive_context += (
            "\nRecent inside-domain fields (use these to rotate away from repetition):\n- "
            + "\n- ".join(recent_tracks)
        )
    if used_titles:
        archive_context += (
            "\nExact learning items already used (do not repeat them):\n- "
            + "\n- ".join(used_titles)
        )
    return (
        f"Create Teja's Daily Digest for {report_date.isoformat()} in India Standard Time.\n"
        f"{date_context}{archive_context}"
    )


def build_prompt(report_date: date, advance: bool = False) -> str:
    """Return the complete prompt text for inspection and backwards-compatible callers."""
    brief = BRIEF_PATH.read_text(encoding="utf-8")
    return (
        "Follow this editorial and output contract exactly. Return only the structured digest.\n\n"
        f"{brief}\n\nEdition-specific context:\n{edition_context(report_date, advance)}"
    )


def build_input(report_date: date, advance: bool = False) -> list[dict[str, Any]]:
    """Keep the reusable brief separate from the changing date/archive context."""
    brief = BRIEF_PATH.read_text(encoding="utf-8")
    return [
        {
            "role": "developer",
            "content": [
                {
                    "type": "input_text",
                    "text": (
                        "You are a meticulous research editor. Browse before making factual claims, "
                        "distinguish evidence from inference, and produce accurate structured output. "
                        "Return only the structured digest.\n\n"
                        f"{brief}"
                    ),
                }
            ],
        },
        {"role": "user", "content": edition_context(report_date, advance)},
    ]


def generation_profile(
    *,
    advance: bool,
    model: str,
    advance_model: str,
    reasoning_effort: str,
    advance_reasoning_effort: str,
    max_tool_calls: int | None,
    max_output_tokens: int | None,
    cheap_advance: bool = False,
) -> GenerationProfile:
    """Select safe defaults while allowing deliberate per-run overrides."""
    use_cheap_profile = advance and cheap_advance
    return GenerationProfile(
        model=(
            CHEAP_MODEL
            if use_cheap_profile and advance_model == DEFAULT_MODEL
            else (advance_model if advance else model)
        ),
        reasoning_effort=(
            CHEAP_REASONING_EFFORT
            if use_cheap_profile
            else (advance_reasoning_effort if advance else reasoning_effort)
        ),
        max_tool_calls=max_tool_calls
        if max_tool_calls is not None
        else (
            CHEAP_MAX_TOOL_CALLS
            if use_cheap_profile
            else (ADVANCE_MAX_TOOL_CALLS if advance else DEFAULT_MAX_TOOL_CALLS)
        ),
        max_output_tokens=max_output_tokens
        if max_output_tokens is not None
        else (
            CHEAP_MAX_OUTPUT_TOKENS
            if use_cheap_profile
            else (ADVANCE_MAX_OUTPUT_TOKENS if advance else DEFAULT_MAX_OUTPUT_TOKENS)
        ),
        search_context_size=CHEAP_SEARCH_CONTEXT_SIZE if use_cheap_profile else SEARCH_CONTEXT_SIZE,
        text_verbosity=CHEAP_TEXT_VERBOSITY if use_cheap_profile else TEXT_VERBOSITY,
    )


def request_digest(
    model: str,
    report_date: date,
    max_tool_calls: int,
    advance: bool = False,
    client: OpenAI | None = None,
    reasoning_effort: str = DEFAULT_REASONING_EFFORT,
    max_output_tokens: int = DEFAULT_MAX_OUTPUT_TOKENS,
    search_context_size: str = SEARCH_CONTEXT_SIZE,
    text_verbosity: str = TEXT_VERBOSITY,
) -> Digest:
    client = client or OpenAI(max_retries=5, timeout=1200.0)
    print(f"Researching {report_date.isoformat()} with {model}...")
    response = client.responses.parse(
        model=model,
        input=build_input(report_date, advance),
        tools=[
            {
                "type": "web_search",
                "external_web_access": True,
                "search_context_size": search_context_size,
                "user_location": {
                    "type": "approximate",
                    "country": "IN",
                    "timezone": "Asia/Kolkata",
                },
            }
        ],
        tool_choice="auto",
        parallel_tool_calls=True,
        max_tool_calls=max_tool_calls,
        max_output_tokens=max_output_tokens,
        reasoning={"effort": reasoning_effort},
        text_format=Digest,
        text={"verbosity": text_verbosity},
        background=True,
        store=True,
        metadata={
            "edition_date": report_date.isoformat(),
            "edition_kind": "advance" if advance else "current",
            "application": "tejas-daily-digest",
        },
        prompt_cache_key="tejas-daily-digest-v5",
    )

    deadline = time.monotonic() + 25 * 60
    try:
        while response.status in ACTIVE_RESPONSE_STATES:
            if time.monotonic() >= deadline:
                raise DigestError("OpenAI generation did not finish within 25 minutes.")
            print(f"OpenAI response is {response.status}; checking again shortly...")
            time.sleep(10)
            response = client.responses.retrieve(response.id)
    except BaseException:
        if response.status in ACTIVE_RESPONSE_STATES:
            try:
                client.responses.cancel(response.id)
            except Exception:
                pass
        raise

    if response.status != "completed":
        detail = getattr(response, "error", None) or getattr(response, "incomplete_details", None)
        raise DigestError(f"OpenAI generation ended with status {response.status}: {detail}")

    print_token_usage(response)
    parsed = getattr(response, "output_parsed", None)
    digest = parsed if isinstance(parsed, Digest) else Digest.model_validate_json(response.output_text)
    validate_digest(digest, report_date)
    return digest


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "days",
        nargs="?",
        type=int,
        choices=range(1, MAX_ADVANCE_DAYS + 1),
        metavar=f"1-{MAX_ADVANCE_DAYS}",
        help="prepare the next N future calendar days as advance editions",
    )
    parser.add_argument(
        "--date",
        type=parse_date,
        help="today or a historical edition date in YYYY-MM-DD",
    )
    parser.add_argument("--force", action="store_true", help="replace an existing edition for this date")
    parser.add_argument(
        "--model",
        default=os.environ.get("OPENAI_MODEL", DEFAULT_MODEL),
        help=f"OpenAI model ID (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--advance-model",
        default=os.environ.get("OPENAI_ADVANCE_MODEL", DEFAULT_MODEL),
        help=f"model for advance editions (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--reasoning-effort",
        choices=("low", "medium", "high"),
        default=os.environ.get("OPENAI_REASONING_EFFORT", DEFAULT_REASONING_EFFORT),
        help=f"reasoning effort for current/historical editions (default: {DEFAULT_REASONING_EFFORT})",
    )
    parser.add_argument(
        "--advance-reasoning-effort",
        choices=("low", "medium", "high"),
        default=os.environ.get("OPENAI_ADVANCE_REASONING_EFFORT", ADVANCE_REASONING_EFFORT),
        help=f"reasoning effort for advance editions (default: {ADVANCE_REASONING_EFFORT})",
    )
    parser.add_argument(
        "--cheap-advance",
        action="store_true",
        help=f"opt into the lower-cost {CHEAP_MODEL} profile for advance editions",
    )
    parser.add_argument(
        "--max-tool-calls",
        type=int,
        default=None,
        choices=range(6, 25),
        metavar="6-24",
        help="override the edition-specific web-search budget",
    )
    parser.add_argument(
        "--max-output-tokens",
        type=int,
        default=None,
        choices=range(12000, 24001),
        metavar="12000-24000",
        help="override the edition-specific output-token cap",
    )
    return parser


def generation_targets(report_date: date | None, days: int | None) -> list[date]:
    if report_date and days:
        raise DigestError("Use either --date or a number of future days, not both.")
    if report_date and report_date > today_in_ist():
        raise DigestError("Use a positional number, such as 2, to prepare future editions safely.")
    if days:
        return [today_in_ist() + timedelta(days=offset) for offset in range(1, days + 1)]
    return [report_date or today_in_ist()]


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    targets = generation_targets(args.date, args.days)

    pending: list[tuple[date, bool]] = []
    for report_date in targets:
        issue_path = DATA_DIR / f"{report_date.isoformat()}.json"
        if issue_path.exists() and not args.force:
            repaired = repair_existing_archive(report_date)
            print(f"Digest already exists; kept {repaired}. Use --force to refresh it.")
            continue
        pending.append((report_date, report_date > today_in_ist()))

    if pending and not os.environ.get("OPENAI_API_KEY"):
        raise DigestError("OPENAI_API_KEY is not set.")

    for report_date, advance in pending:
        profile = generation_profile(
            advance=advance,
            model=args.model,
            advance_model=args.advance_model,
            reasoning_effort=args.reasoning_effort,
            advance_reasoning_effort=args.advance_reasoning_effort,
            max_tool_calls=args.max_tool_calls,
            max_output_tokens=args.max_output_tokens,
            cheap_advance=args.cheap_advance,
        )
        print(
            f"Using {profile.model} ({profile.reasoning_effort} reasoning, "
            f"{profile.max_tool_calls} searches, {profile.max_output_tokens} output tokens)."
        )
        digest = request_digest(
            profile.model,
            report_date,
            profile.max_tool_calls,
            advance=advance,
            reasoning_effort=profile.reasoning_effort,
            max_output_tokens=profile.max_output_tokens,
            search_context_size=profile.search_context_size,
            text_verbosity=profile.text_verbosity,
        )
        published = publish_digest(digest, report_date)
        edition_label = "advance vacation edition" if advance else "current edition"
        print(f"Published {published} as a validated {edition_label}.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("Generation cancelled; existing archive files were preserved.", file=sys.stderr)
        sys.exit(130)
    except Exception as error:
        print(f"Daily Digest failed: {error}", file=sys.stderr)
        sys.exit(1)
