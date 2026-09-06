# Teja's daily digest

A static, searchable daily research and general-news briefing deployed through Vercel. It supports
two independent generation paths: Codex through a ChatGPT subscription on the Mac, or the OpenAI API
through an on-demand GitHub Action.

## Option 1: Generate from the Mac with ChatGPT/Codex

The one-command path is:

```bash
bash run.sh
```

`run.sh` launches Codex CLI with live web search and reuses the Mac's saved ChatGPT login. It asks
Codex to research the edition, prepare valid JSON, run the safe publisher, commit the result, and push
it to GitHub. This path uses the ChatGPT subscription rather than `OPENAI_API_KEY` billing.

Useful commands:

```bash
# Confirm that Codex is installed and signed in with ChatGPT
bash run.sh --check

# Generate a historical edition
bash run.sh --date 2026-08-15

# Deliberately refresh an existing edition
bash run.sh --date 2026-08-15 --force

# Vacation mode: prepare tomorrow and the following six days
bash run.sh 7
```

If Codex is not signed in, run `codex login` and choose ChatGPT. The script also recognizes the Codex
binary bundled with the ChatGPT desktop app when a separate command-line installation is unavailable.
The Mac must remain awake while this option runs.

Vacation mode accepts 1–7 days and generates each future calendar date separately. Advance editions
never pretend to know future headlines or prices: they contain sourced evergreen India/world learning,
a company-study watchlist with unavailable price fields, and the normal four research papers. The
website labels these issues **Prepared ahead** and keeps the homepage on the current issue rather than
jumping to the furthest future date.

Each day is a full, separately researched generation, so a long vacation batch can take substantial
time and consume corresponding Codex or API usage. The script publishes days one at a time; if a later
day fails, earlier successfully pushed days remain available and rerunning the same command skips them.

When an advance date actually arrives, replace it with live news and market data using:

```bash
bash run.sh --force
```

Or name that date explicitly with `bash run.sh --date YYYY-MM-DD --force`.

You can also open this repository in the Codex desktop app and ask:

```text
Generate and publish Teja's Daily Digest for today. Follow DIGEST_BRIEF.md.
```

## Option 2: Generate through GitHub Actions and the API

This option runs in the cloud while the Mac is off and can be started from GitHub on an iPhone. It
uses separately billed OpenAI API credit.

1. In GitHub, open **Settings → Secrets and variables → Actions**.
2. Create a repository secret named `OPENAI_API_KEY`.
3. Open **Actions → Generate Daily Digest (API) → Run workflow**.
4. Leave the date blank for today's India-time edition, or enter a historical date.
5. For vacation mode, leave the date blank and enter the number of future days in **days**.
6. Enable **Replace the edition** only when intentionally refreshing existing dates.

The Action is intentionally on-demand and is not scheduled, preventing unexpected API spending.
Concurrent runs are serialized. A repeated run for an existing date exits before calling the API
unless replacement is explicitly enabled.

## Publish a prepared JSON file directly

Codex and the API generator both use the same validated publisher. It can also be called manually:

```bash
bash publish.sh --date 2026-09-06 --input /absolute/path/to/prepared-digest.json
```

Replacing an existing date requires `--force`. The publisher validates the content before touching
the archive. If validation or search-index generation fails, existing files are restored. A successful
push triggers the Vercel deployment.
