#!/usr/bin/env python3
"""Build the compact client-side search index from published digest JSON files."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TAG_PATTERN = re.compile(r"<[^>]+>")


def plain_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        return " ".join(plain_text(item) for item in value.values())
    if isinstance(value, list):
        return " ".join(plain_text(item) for item in value)
    return re.sub(r"\s+", " ", html.unescape(TAG_PATTERN.sub(" ", str(value)))).strip()


def excerpt(value: Any, limit: int = 1800) -> str:
    text = plain_text(value)
    return text if len(text) <= limit else f"{text[: limit - 1].rstrip()}…"


def compact_terms(value: Any, limit: int = 220) -> str:
    """Keep searchable vocabulary while removing repeated prose from the CDN payload."""
    words = re.findall(r"[a-z0-9₹$%]+", plain_text(value).lower())
    unique_words = list(dict.fromkeys(word for word in words if len(word) > 1 or word.isdigit()))
    return " ".join(unique_words[:limit])


def news_summary(value: Any) -> str:
    if isinstance(value, list):
        headlines = [item.get("headline") for item in value if isinstance(item, dict) and item.get("headline")]
        if headlines:
            return " · ".join(headlines[:2])
    return excerpt(value, 180)


def issue_entries(date: str, data: dict[str, Any]) -> list[dict[str, Any]]:
    is_advance = (data.get("edition") or {}).get("kind") == "advance"
    entries: list[dict[str, Any]] = [
        {
            "date": date,
            "section": "research",
            "title": date,
            "summary": "Prepared-ahead vacation issue" if is_advance else "Digest archive",
            "content": compact_terms([date, data.get("edition")], 40),
            "score": 10,
        }
    ]

    news = data.get("news") or {}
    news_labels = (
        (("india", "India knowledge"), ("world", "World knowledge"))
        if is_advance
        else (("india", "India news"), ("world", "World news"))
    )
    for region, label in news_labels:
        if news.get(region):
            entries.append({
                "date": date,
                "section": "brief",
                "title": label,
                "summary": news_summary(news[region]),
                "content": compact_terms(news[region], 180),
                "score": 5,
            })

    for paper in (data.get("papers") or {}).values():
        if not isinstance(paper, dict):
            continue
        entries.append({
            "date": date,
            "section": "research",
            "title": paper.get("title") or "Research paper",
            "summary": paper.get("summary") or paper.get("problem") or paper.get("question") or "Research paper",
            "content": compact_terms(paper, 240),
            "score": 8,
        })

    stocks = data.get("stocks") or {}
    market_labels = (
        (("us", "US company study"), ("india", "India company study"))
        if is_advance
        else (("us", "US market"), ("india", "India market"))
    )
    for market, label in market_labels:
        for stock in stocks.get(market) or []:
            if not isinstance(stock, dict):
                continue
            entries.append({
                "date": date,
                "section": "markets",
                "title": f"{stock.get('symbol') or 'Stock'} · {label}",
                "summary": stock.get("reason") or stock.get("thesis") or "Market watchlist",
                "content": compact_terms(stock, 80),
                "score": 6,
            })

    if data.get("takeaways"):
        entries.append({
            "date": date,
            "section": "takeaways",
            "title": "Issue takeaways",
            "summary": excerpt(data["takeaways"].get("explore") or data["takeaways"].get("remember"), 180),
            "content": compact_terms(data["takeaways"], 140),
            "score": 4,
        })
    return entries


def main() -> None:
    dates = json.loads((DATA_DIR / "index.json").read_text(encoding="utf-8"))
    entries: list[dict[str, Any]] = []
    for date in dates:
        if not isinstance(date, str) or not DATE_PATTERN.fullmatch(date):
            continue
        issue_path = DATA_DIR / f"{date}.json"
        if not issue_path.exists():
            continue
        data = json.loads(issue_path.read_text(encoding="utf-8"))
        entries.extend(issue_entries(date, data))

    output_path = DATA_DIR / "search-index.json"
    output_path.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {len(entries)} search entries to {output_path}")


if __name__ == "__main__":
    main()
