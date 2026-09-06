# Teja's daily digest

A static, searchable daily research and general-news briefing deployed through Vercel.

## Generate with your ChatGPT subscription

Open this repository in the Codex desktop app while signed in with ChatGPT, then ask:

```text
Generate and publish Teja's Daily Digest for today. Follow DIGEST_BRIEF.md.
```

Codex researches the edition, prepares the structured JSON, validates it, updates the search archive,
commits the data, and pushes it to GitHub. Vercel deploys the resulting commit. This path uses the
ChatGPT subscription attached to Codex; the repository does not call the OpenAI API and needs no API
key.

For a historical edition, include the date:

```text
Generate and publish Teja's Daily Digest for 2026-08-15. Follow DIGEST_BRIEF.md.
```

If an edition already exists, it is preserved unless you explicitly ask Codex to replace or refresh
that date.

## Publish a prepared JSON file manually

The helper remains available for validation and publishing without any AI or API credentials:

```bash
bash run.sh --date 2026-09-06 --input /absolute/path/to/prepared-digest.json
```

Replacing an existing date requires an explicit flag:

```bash
bash run.sh --date 2026-09-06 --input /absolute/path/to/prepared-digest.json --force
```

The publisher validates the content before touching the archive. If validation or search-index
generation fails, the existing files are restored. Because GitHub Actions has been removed, the Mac
and Codex task must be running when an edition is generated.
