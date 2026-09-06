from __future__ import annotations

import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest import mock

import httpx2
from openai import DefaultHttpxClient, OpenAI

import generate_with_openai as api_generator
import update_website as digest_app


def paragraph(label: str, length: int = 180) -> str:
    return (f"{label} supplies verified context, technical detail, evidence, limitations, and practical implications. " * 8)[:length]


def paper(title: str, field: str, slug: str) -> digest_app.Paper:
    return digest_app.Paper(
        title=title,
        authors="A. Researcher and B. Researcher",
        year="2026",
        venue="Example Conference",
        field=field,
        link=f"https://example.com/papers/{slug}",
        scholar=f"https://scholar.google.com/scholar?q={slug}",
        summary=paragraph("Summary", 120),
        problem=paragraph("Problem"),
        difficulty=paragraph("Difficulty"),
        idea=paragraph("Idea"),
        method=paragraph("Method", 320),
        results=paragraph("Results", 200),
        care=paragraph("Importance", 200),
        learn=["Lesson one is concrete.", "Lesson two is concrete.", "Lesson three is concrete."],
        concepts=["concept one", "concept two", "concept three", "concept four"],
    )


def news(prefix: str) -> list[digest_app.NewsItem]:
    categories = ["Governance", "Science", "Health", "Environment"]
    return [
        digest_app.NewsItem(
            category=category,
            headline=f"{prefix} verified headline number {index}",
            summary=paragraph(f"{prefix} summary {index}", 90),
            why=paragraph(f"{prefix} importance {index}", 70),
            link=f"https://example.com/{prefix.casefold()}/{index}",
        )
        for index, category in enumerate(categories, 1)
    ]


def stocks(prefix: str) -> list[digest_app.Stock]:
    return [
        digest_app.Stock(
            symbol=f"{prefix}{index}",
            price=f"${100 + index}",
            change=float(index),
            reason="Latest completed session with verified market context.",
            thesis="The watchlist thesis is concise, evidence-based, and not a recommendation.",
            risk="Valuation and execution remain material risks.",
        )
        for index in range(1, 4)
    ]


def sample_digest() -> digest_app.Digest:
    return digest_app.Digest(
        news=digest_app.News(india=news("India"), world=news("World")),
        papers=digest_app.Papers(
            domain1=paper("Inside Domain Paper One", "Imaging", "domain-one"),
            domain2=paper("Inside Domain Paper Two", "Semiconductors", "domain-two"),
            outside1=paper("Outside Domain Paper One", "Neuroscience", "outside-one"),
            outside2=paper("Outside Domain Paper Two", "Economics", "outside-two"),
        ),
        stocks=digest_app.Stocks(us=stocks("US"), india=stocks("IN")),
        takeaways=digest_app.Takeaways(
            remember=[f"Remember verified idea {index}." for index in range(1, 6)],
            explore=paragraph("Explore the relationship between the strongest ideas", 180),
        ),
    )


class PublishTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temporary.name) / "data"
        self.data_dir.mkdir()
        self.index_path = self.data_dir / "index.json"
        self.index_path.write_text("[]\n", encoding="utf-8")
        self.patch_data = mock.patch.object(digest_app, "DATA_DIR", self.data_dir)
        self.patch_index = mock.patch.object(digest_app, "INDEX_PATH", self.index_path)
        self.patch_data.start()
        self.patch_index.start()

    def tearDown(self) -> None:
        self.patch_index.stop()
        self.patch_data.stop()
        self.temporary.cleanup()

    def fake_search_builder(self) -> None:
        (self.data_dir / "search-index.json").write_text("[]\n", encoding="utf-8")

    def test_publish_and_repeat_repair_keep_one_date(self) -> None:
        edition = date(2026, 9, 5)
        with mock.patch.object(digest_app, "build_search_index", self.fake_search_builder):
            issue_path = digest_app.publish_digest(sample_digest(), edition)
            digest_app.repair_existing_archive(edition)
            digest_app.repair_existing_archive(edition)

        self.assertTrue(issue_path.exists())
        self.assertEqual(json.loads(self.index_path.read_text()), ["2026-09-05"])

    def test_publish_rolls_back_all_archive_files_on_failure(self) -> None:
        edition = date(2026, 9, 5)
        issue_path = self.data_dir / "2026-09-05.json"
        search_path = self.data_dir / "search-index.json"
        issue_path.write_text('{"old": true}\n', encoding="utf-8")
        self.index_path.write_text('["2026-09-05"]\n', encoding="utf-8")
        search_path.write_text('[{"old": true}]\n', encoding="utf-8")
        originals = {path: path.read_bytes() for path in (issue_path, self.index_path, search_path)}

        with mock.patch.object(digest_app, "build_search_index", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                digest_app.publish_digest(sample_digest(), edition)

        self.assertEqual({path: path.read_bytes() for path in originals}, originals)

    def test_duplicate_papers_are_rejected(self) -> None:
        digest = sample_digest()
        digest.papers.domain2.title = digest.papers.domain1.title
        with self.assertRaises(digest_app.DigestError):
            digest_app.validate_digest(digest)

    def test_prepared_json_is_validated_and_published(self) -> None:
        edition = date(2026, 9, 5)
        prepared = Path(self.temporary.name) / "prepared.json"
        prepared.write_text(sample_digest().model_dump_json(), encoding="utf-8")

        with mock.patch.object(digest_app, "build_search_index", self.fake_search_builder):
            result = digest_app.main(
                ["--date", edition.isoformat(), "--input", str(prepared)]
            )

        self.assertEqual(result, 0)
        self.assertTrue((self.data_dir / "2026-09-05.json").exists())
        self.assertEqual(json.loads(self.index_path.read_text()), ["2026-09-05"])

    def test_existing_edition_requires_force_for_external_input(self) -> None:
        edition = date(2026, 9, 5)
        (self.data_dir / "2026-09-05.json").write_text(
            sample_digest().model_dump_json(), encoding="utf-8"
        )
        prepared = Path(self.temporary.name) / "replacement.json"
        prepared.write_text(sample_digest().model_dump_json(), encoding="utf-8")

        with self.assertRaises(digest_app.DigestError):
            digest_app.main(
                ["--date", edition.isoformat(), "--input", str(prepared)]
            )

    def test_force_allows_deliberate_replacement(self) -> None:
        edition = date(2026, 9, 5)
        issue_path = self.data_dir / "2026-09-05.json"
        issue_path.write_text('{"old": true}', encoding="utf-8")
        prepared = Path(self.temporary.name) / "replacement.json"
        prepared.write_text(sample_digest().model_dump_json(), encoding="utf-8")

        with mock.patch.object(digest_app, "build_search_index", self.fake_search_builder):
            result = digest_app.main(
                [
                    "--date",
                    edition.isoformat(),
                    "--input",
                    str(prepared),
                    "--force",
                ]
            )

        self.assertEqual(result, 0)
        self.assertIn("papers", json.loads(issue_path.read_text(encoding="utf-8")))

    def test_invalid_prepared_json_has_readable_error(self) -> None:
        prepared = Path(self.temporary.name) / "invalid.json"
        prepared.write_text('{"news": {}}', encoding="utf-8")

        with self.assertRaisesRegex(digest_app.DigestError, "Prepared digest failed validation"):
            digest_app.load_digest(prepared)


class OpenAIRequestTests(unittest.TestCase):
    def test_verbosity_is_nested_inside_text_config(self) -> None:
        captured: dict = {}
        output = sample_digest().model_dump_json()

        def handler(request: httpx2.Request) -> httpx2.Response:
            body = json.loads(request.content)
            captured.update(body)
            return httpx2.Response(
                200,
                json={
                    "id": "resp_test",
                    "object": "response",
                    "created_at": 0,
                    "completed_at": 1,
                    "status": "completed",
                    "error": None,
                    "incomplete_details": None,
                    "instructions": body.get("instructions"),
                    "max_output_tokens": body.get("max_output_tokens"),
                    "model": body["model"],
                    "output": [
                        {
                            "id": "msg_test",
                            "type": "message",
                            "status": "completed",
                            "role": "assistant",
                            "content": [
                                {
                                    "type": "output_text",
                                    "text": output,
                                    "annotations": [],
                                }
                            ],
                        }
                    ],
                    "parallel_tool_calls": True,
                    "previous_response_id": None,
                    "reasoning": body.get("reasoning"),
                    "store": True,
                    "temperature": 1.0,
                    "text": body["text"],
                    "tool_choice": "auto",
                    "tools": body["tools"],
                    "top_p": 1.0,
                    "truncation": "disabled",
                    "usage": None,
                    "metadata": body.get("metadata", {}),
                },
            )

        client = OpenAI(
            api_key="test",
            http_client=DefaultHttpxClient(transport=httpx2.MockTransport(handler)),
        )
        result = api_generator.request_digest(
            "gpt-5.6-terra", date(2026, 9, 6), 8, client=client
        )

        self.assertIsInstance(result, digest_app.Digest)
        self.assertNotIn("verbosity", captured)
        self.assertEqual(captured["text"]["verbosity"], "high")
        self.assertEqual(captured["text"]["format"]["type"], "json_schema")


if __name__ == "__main__":
    unittest.main()
