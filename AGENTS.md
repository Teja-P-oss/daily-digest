# Daily Digest project instructions

When the user asks to generate or publish an edition:

1. Read `DIGEST_BRIEF.md` and follow it as the editorial and JSON contract.
2. Use the requested date, or today's date in Asia/Kolkata when none is supplied. A future target is an
   advance vacation edition: follow the advance rules in the brief and never fabricate future events
   or market data.
3. Before researching, check whether `data/YYYY-MM-DD.json` already exists. If it does, stop unless
   the user explicitly requested replacement.
4. Research with live web sources. Verify URLs and time-sensitive facts before writing the edition.
5. Prepare the JSON in a temporary file outside `data/`.
6. Run `bash publish.sh --date YYYY-MM-DD --input /absolute/path/to/file.json`. Add `--advance` when
   the target date is in the future.
7. Add `--force` to `publish.sh` only when the user explicitly asks to replace or refresh an existing
   edition.
8. Confirm that the push succeeds; Vercel deploys from the GitHub repository.

Do not call `run.sh` from inside a Codex task because it launches another Codex task. Interactive and
desktop-script Codex sessions use the user's ChatGPT sign-in. The separate `generate_with_openai.py`
path is reserved for the on-demand GitHub Action and uses `OPENAI_API_KEY`. Do not edit
`data/index.json` or `data/search-index.json` manually; the publisher rebuilds them and rolls back
partial updates on failure. When generating several advance editions, check the existing archive so
papers, knowledge briefs, and company lessons do not repeat across adjacent days.
