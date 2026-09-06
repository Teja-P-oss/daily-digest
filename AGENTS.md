# Daily Digest project instructions

When the user asks to generate or publish an edition:

1. Read `DIGEST_BRIEF.md` and follow it as the editorial and JSON contract.
2. Use the requested date, or today's date in Asia/Kolkata when none is supplied.
3. Research with live web sources. Verify URLs and time-sensitive facts before writing the edition.
4. Prepare the JSON in a temporary file outside `data/`.
5. Run `bash run.sh --date YYYY-MM-DD --input /absolute/path/to/file.json`.
6. Add `--force` only when the user explicitly asks to replace or refresh an existing edition.
7. Confirm that the push succeeds; Vercel deploys from the GitHub repository.

Do not call the OpenAI API or request `OPENAI_API_KEY`. The interactive Codex session supplies the AI
work through the user's ChatGPT sign-in. Do not edit `data/index.json` or `data/search-index.json`
manually; the publisher rebuilds them and rolls back partial updates on failure.
