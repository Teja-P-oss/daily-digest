# Teja's daily digest

A static, searchable daily research and general-news briefing deployed through Vercel.

## Run from this Mac

Create an OpenAI API key and either export it as `OPENAI_API_KEY` or add this line to the
Git-ignored `local_secrets.sh` file:

```bash
export OPENAI_API_KEY='your-key-here'
```

Then run:

```bash
bash run.sh
```

If today's edition already exists, the command safely keeps it. To deliberately research and
replace the same date:

```bash
bash run.sh --force
```

Generate a missing historical date with:

```bash
bash run.sh --date 2026-08-15
```

The runner validates the generated JSON, updates the archive and compact search index, commits the
data, and pushes it. Vercel deploys the GitHub commit.

## Run from an iPhone while the Mac is off

1. In GitHub, open **Settings → Secrets and variables → Actions**.
2. Create a repository secret named `OPENAI_API_KEY`.
3. Open **Actions → Generate Daily Digest → Run workflow**.
4. Leave the date blank for today's India-time edition, or enter a historical date.
5. Enable **Replace the edition** only when intentionally refreshing an existing date.

The workflow also runs daily at 7:00 PM India Standard Time. Concurrent runs are serialized, and
repeat runs are no-ops unless regeneration is explicitly requested.
