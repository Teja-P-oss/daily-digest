#!/usr/bin/env python3
"""Validate and publish one prepared Daily Digest edition."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from build_search_index import main as build_search_index


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
INDEX_PATH = DATA_DIR / "index.json"
IST = ZoneInfo("Asia/Kolkata")
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


def validate_http_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("must be an absolute HTTP(S) URL")
    return value


class NewsItem(StrictModel):
    category: str = Field(min_length=2, max_length=50)
    headline: str = Field(min_length=12, max_length=180)
    summary: str = Field(min_length=40, max_length=700)
    why: str = Field(min_length=30, max_length=500)
    link: str

    _validate_link = field_validator("link")(validate_http_url)


class News(StrictModel):
    india: list[NewsItem] = Field(min_length=4, max_length=6)
    world: list[NewsItem] = Field(min_length=4, max_length=6)


class Paper(StrictModel):
    title: str = Field(min_length=8, max_length=300)
    authors: str = Field(min_length=2, max_length=500)
    year: str = Field(min_length=4, max_length=20)
    venue: str = Field(min_length=2, max_length=120)
    field: str = Field(min_length=2, max_length=100)
    link: str
    scholar: str
    summary: str = Field(min_length=80, max_length=900)
    problem: str = Field(min_length=120, max_length=1600)
    difficulty: str = Field(min_length=120, max_length=1600)
    idea: str = Field(min_length=120, max_length=1600)
    method: str = Field(min_length=250, max_length=3000)
    results: str = Field(min_length=160, max_length=2200)
    care: str = Field(min_length=160, max_length=1800)
    learn: list[str] = Field(min_length=3, max_length=6)
    concepts: list[str] = Field(min_length=4, max_length=8)

    _validate_urls = field_validator("link", "scholar")(validate_http_url)


class Papers(StrictModel):
    domain1: Paper
    domain2: Paper
    outside1: Paper
    outside2: Paper


class Stock(StrictModel):
    symbol: str = Field(min_length=1, max_length=30)
    price: str = Field(min_length=1, max_length=40)
    change: float | None = Field(default=None, ge=-100, le=100)
    reason: str = Field(min_length=20, max_length=220)
    thesis: str = Field(min_length=30, max_length=350)
    risk: str = Field(min_length=20, max_length=300)


class Stocks(StrictModel):
    us: list[Stock] = Field(min_length=3, max_length=4)
    india: list[Stock] = Field(min_length=3, max_length=4)


class Takeaways(StrictModel):
    remember: list[str] = Field(min_length=5, max_length=8)
    explore: str = Field(min_length=120, max_length=1200)


class Edition(StrictModel):
    kind: Literal["current", "advance"]
    generated_on: date
    note: str = Field(min_length=30, max_length=300)


class Digest(StrictModel):
    edition: Edition | None = None
    news: News
    papers: Papers
    stocks: Stocks
    takeaways: Takeaways


class DigestError(RuntimeError):
    """A safe, user-facing generation or publication failure."""


def parse_date(value: str) -> date:
    if not DATE_PATTERN.fullmatch(value):
        raise argparse.ArgumentTypeError("date must use YYYY-MM-DD format")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError(str(error)) from error
    return parsed


def today_in_ist() -> date:
    return datetime.now(IST).date()


def validate_digest(digest: Digest, report_date: date | None = None) -> None:
    papers = [
        digest.papers.domain1,
        digest.papers.domain2,
        digest.papers.outside1,
        digest.papers.outside2,
    ]
    normalized_titles = {paper.title.casefold() for paper in papers}
    if len(normalized_titles) != 4:
        raise DigestError("The response contains duplicate research papers.")

    if digest.papers.outside1.field.casefold() == digest.papers.outside2.field.casefold():
        raise DigestError("The two outside-domain papers must come from different fields.")

    paper_links = {paper.link.casefold() for paper in papers}
    if len(paper_links) != 4:
        raise DigestError("The response reuses a paper URL.")

    for label, items in (("India", digest.news.india), ("World", digest.news.world)):
        categories = {item.category.casefold() for item in items}
        if len(categories) < 3:
            raise DigestError(f"{label} news is not varied enough.")
        links = {item.link.casefold() for item in items}
        if len(links) < max(3, len(items) - 1):
            raise DigestError(f"{label} news reuses too few source pages.")

    for label, items in (("US", digest.stocks.us), ("India", digest.stocks.india)):
        if len({item.symbol.casefold() for item in items}) != len(items):
            raise DigestError(f"{label} market list contains duplicate symbols.")

    if digest.edition and digest.edition.generated_on > today_in_ist():
        raise DigestError("Edition metadata cannot claim a future generation date.")

    if report_date and report_date > today_in_ist():
        if not digest.edition or digest.edition.kind != "advance":
            raise DigestError("Future dates require advance-edition metadata.")
        if digest.edition.generated_on >= report_date:
            raise DigestError("An advance edition must be generated before its target date.")
        for stock in [*digest.stocks.us, *digest.stocks.india]:
            if stock.change is not None:
                raise DigestError("Advance editions must not invent stock-price changes.")
            if stock.price.casefold() not in {"n/a", "not available", "not available — advance edition"}:
                raise DigestError("Advance editions must mark stock prices as unavailable.")
    elif report_date:
        if digest.edition and digest.edition.kind != "current":
            raise DigestError("Today and historical dates require current-edition metadata.")
        if any(stock.change is None for stock in [*digest.stocks.us, *digest.stocks.india]):
            raise DigestError("Current and historical editions require verified stock-price changes.")


def load_digest(path: Path) -> Digest:
    try:
        digest = Digest.model_validate_json(path.read_text(encoding="utf-8"))
    except OSError as error:
        raise DigestError(f"Could not read prepared digest: {path}") from error
    except ValidationError as error:
        details = "; ".join(
            f"{'.'.join(str(part) for part in item['loc'])}: {item['msg']}"
            for item in error.errors(include_url=False)[:8]
        )
        raise DigestError(f"Prepared digest failed validation: {details}") from error

    validate_digest(digest)
    return digest


def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        with temporary.open("wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def read_index() -> list[str]:
    if not INDEX_PATH.exists():
        return []
    raw = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise DigestError("data/index.json must contain a JSON array.")
    return [value for value in raw if isinstance(value, str) and DATE_PATTERN.fullmatch(value)]


def updated_index(report_date: date) -> list[str]:
    dates = set(read_index())
    dates.add(report_date.isoformat())
    return sorted(dates, reverse=True)


def restore_files(snapshots: dict[Path, bytes | None]) -> None:
    for path, original in snapshots.items():
        if original is None:
            path.unlink(missing_ok=True)
        else:
            atomic_write(path, original)


def publish_digest(digest: Digest, report_date: date) -> Path:
    validate_digest(digest, report_date)
    issue_path = DATA_DIR / f"{report_date.isoformat()}.json"
    search_path = DATA_DIR / "search-index.json"
    paths = (issue_path, INDEX_PATH, search_path)
    snapshots = {path: path.read_bytes() if path.exists() else None for path in paths}

    issue_bytes = (
        json.dumps(digest.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n"
    ).encode("utf-8")
    index_bytes = (json.dumps(updated_index(report_date), indent=4) + "\n").encode("utf-8")

    try:
        atomic_write(issue_path, issue_bytes)
        atomic_write(INDEX_PATH, index_bytes)
        build_search_index()
        json.loads(issue_path.read_text(encoding="utf-8"))
        json.loads(INDEX_PATH.read_text(encoding="utf-8"))
        json.loads(search_path.read_text(encoding="utf-8"))
    except Exception:
        restore_files(snapshots)
        raise

    return issue_path


def repair_existing_archive(report_date: date) -> Path:
    issue_path = DATA_DIR / f"{report_date.isoformat()}.json"
    search_path = DATA_DIR / "search-index.json"
    snapshots = {
        path: path.read_bytes() if path.exists() else None
        for path in (INDEX_PATH, search_path)
    }
    try:
        payload = json.loads(issue_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise DigestError(f"Existing digest is unreadable: {issue_path}") from error
    if not isinstance(payload, dict):
        raise DigestError(f"Existing digest is not a JSON object: {issue_path}")

    try:
        atomic_write(
            INDEX_PATH,
            (json.dumps(updated_index(report_date), indent=4) + "\n").encode("utf-8"),
        )
        build_search_index()
    except Exception:
        restore_files(snapshots)
        raise
    return issue_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--date",
        type=parse_date,
        default=today_in_ist(),
        help="edition date in YYYY-MM-DD",
    )
    parser.add_argument(
        "--input",
        type=Path,
        help="prepared JSON file; defaults to data/YYYY-MM-DD.json",
    )
    parser.add_argument("--force", action="store_true", help="replace an existing edition with --input")
    parser.add_argument(
        "--advance",
        action="store_true",
        help="allow a prepared-ahead edition for a future date",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.date > today_in_ist() and not args.advance:
        raise DigestError("Future dates require --advance; use run.sh --days N to prepare vacation issues.")
    if args.advance and args.date <= today_in_ist():
        raise DigestError("--advance is only valid for a future date.")
    issue_path = DATA_DIR / f"{args.date.isoformat()}.json"
    source_path = args.input or issue_path

    try:
        same_file = source_path.resolve() == issue_path.resolve()
    except OSError:
        same_file = False

    if issue_path.exists() and not same_file and not args.force:
        raise DigestError(
            f"Digest already exists at {issue_path}. Use --force to replace it deliberately."
        )

    if not source_path.exists():
        raise DigestError(
            f"No prepared digest found at {source_path}. Ask Codex to generate it from DIGEST_BRIEF.md."
        )

    digest = load_digest(source_path)
    published = publish_digest(digest, args.date)
    content_label = "advance learning briefs" if digest.edition and digest.edition.kind == "advance" else "general news"
    print(f"Validated and published {published} with four papers and {content_label}.")
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
