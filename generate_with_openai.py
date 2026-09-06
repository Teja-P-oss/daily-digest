#!/usr/bin/env python3
"""Generate and publish one Daily Digest edition through the OpenAI API."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

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
ACTIVE_RESPONSE_STATES = {"queued", "in_progress"}
MAX_ADVANCE_DAYS = 30


def used_paper_titles(exclude_date: date) -> list[str]:
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
        if len(titles) >= 60:
            break
    return titles[:60]


def build_prompt(report_date: date, advance: bool = False) -> str:
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
    repetition_context = (
        "\nDo not select any of these papers already used in the archive:\n- " + "\n- ".join(used_titles)
        if used_titles
        else ""
    )
    brief = BRIEF_PATH.read_text(encoding="utf-8")
    return (
        f"Create Teja's Daily Digest for {report_date.isoformat()} in India Standard Time.\n"
        f"{date_context}{repetition_context}\n\nFollow this editorial and output contract exactly:\n\n{brief}"
    )


def request_digest(
    model: str,
    report_date: date,
    max_tool_calls: int,
    advance: bool = False,
    client: OpenAI | None = None,
) -> Digest:
    client = client or OpenAI(max_retries=5, timeout=1200.0)
    print(f"Researching {report_date.isoformat()} with {model}...")
    response = client.responses.parse(
        model=model,
        instructions=(
            "You are a meticulous research editor. Browse before making factual claims, distinguish "
            "evidence from inference, and produce accurate structured output."
        ),
        input=build_prompt(report_date, advance),
        tools=[
            {
                "type": "web_search",
                "external_web_access": True,
                "search_context_size": "high",
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
        max_output_tokens=30000,
        reasoning={"effort": "medium"},
        text_format=Digest,
        text={"verbosity": "high"},
        background=True,
        store=True,
        metadata={
            "edition_date": report_date.isoformat(),
            "edition_kind": "advance" if advance else "current",
            "application": "tejas-daily-digest",
        },
        prompt_cache_key="tejas-daily-digest-v3",
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

    parsed = getattr(response, "output_parsed", None)
    digest = parsed if isinstance(parsed, Digest) else Digest.model_validate_json(response.output_text)
    validate_digest(digest, report_date)
    return digest


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--date",
        type=parse_date,
        help="today or a historical edition date in YYYY-MM-DD",
    )
    parser.add_argument(
        "--days",
        type=int,
        choices=range(1, MAX_ADVANCE_DAYS + 1),
        metavar=f"1-{MAX_ADVANCE_DAYS}",
        help="prepare the next N future calendar days as advance editions",
    )
    parser.add_argument("--force", action="store_true", help="replace an existing edition for this date")
    parser.add_argument(
        "--model",
        default=os.environ.get("OPENAI_MODEL", DEFAULT_MODEL),
        help=f"OpenAI model ID (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--max-tool-calls",
        type=int,
        default=24,
        choices=range(8, 41),
        metavar="8-40",
        help="maximum web searches allowed for one edition",
    )
    return parser


def generation_targets(report_date: date | None, days: int | None) -> list[date]:
    if report_date and days:
        raise DigestError("Use either --date or --days, not both.")
    if report_date and report_date > today_in_ist():
        raise DigestError("Use --days N to prepare future editions safely.")
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
        digest = request_digest(args.model, report_date, args.max_tool_calls, advance=advance)
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
