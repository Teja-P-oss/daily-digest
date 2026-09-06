#!/usr/bin/env python3
"""Generate and publish one Daily Digest edition through the OpenAI API."""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import date
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


def build_prompt(report_date: date) -> str:
    date_context = (
        "Use information available today and prioritize developments from the last 24 hours."
        if report_date == today_in_ist()
        else (
            f"This is a historical edition. Report the state of the world on {report_date.isoformat()} "
            "and do not use later outcomes as if they were already known."
        )
    )
    brief = BRIEF_PATH.read_text(encoding="utf-8")
    return (
        f"Create Teja's Daily Digest for {report_date.isoformat()} in India Standard Time.\n"
        f"{date_context}\n\nFollow this editorial and output contract exactly:\n\n{brief}"
    )


def request_digest(
    model: str,
    report_date: date,
    max_tool_calls: int,
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
        input=build_prompt(report_date),
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
        metadata={"edition_date": report_date.isoformat(), "application": "tejas-daily-digest"},
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
    validate_digest(digest)
    return digest


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--date",
        type=parse_date,
        default=today_in_ist(),
        help="edition date in YYYY-MM-DD",
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


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    issue_path = DATA_DIR / f"{args.date.isoformat()}.json"

    if issue_path.exists() and not args.force:
        repaired = repair_existing_archive(args.date)
        print(f"Digest already exists; kept {repaired}. Use --force to refresh it.")
        return 0

    if not os.environ.get("OPENAI_API_KEY"):
        raise DigestError("OPENAI_API_KEY is not set.")

    digest = request_digest(args.model, args.date, args.max_tool_calls)
    published = publish_digest(digest, args.date)
    print(f"Published {published} with four papers and current general news.")
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
