#!/bin/bash
# Generate and publish an edition through Codex CLI and the user's ChatGPT login.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
APP_CODEX="/Applications/ChatGPT.app/Contents/Resources/codex"
TARGET_DATE=""
REPLACE=false
CHECK_ONLY=false

usage() {
    echo "Usage: bash run.sh [--date YYYY-MM-DD] [--force] [--check]"
    echo "  --date   Generate a specific date; default is today in Asia/Kolkata."
    echo "  --force  Deliberately replace an existing edition."
    echo "  --check  Verify the local Codex installation and ChatGPT login only."
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --date)
            if [[ $# -lt 2 ]]; then
                echo "--date requires YYYY-MM-DD." >&2
                exit 2
            fi
            TARGET_DATE="$2"
            shift 2
            ;;
        --force)
            REPLACE=true
            shift
            ;;
        --check)
            CHECK_ONLY=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
done

if [[ -n "$TARGET_DATE" && ! "$TARGET_DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    echo "Date must use YYYY-MM-DD format." >&2
    exit 2
fi

if [[ "$CHECK_ONLY" != "true" ]]; then
    if ! command -v python3 &> /dev/null; then
        echo "python3 could not be found. Please install Python 3.10 or newer." >&2
        exit 1
    fi

    if [[ -z "$TARGET_DATE" ]]; then
        TARGET_DATE="$(TZ=Asia/Kolkata date +%F)"
    fi

    if ! python3 - "$TARGET_DATE" <<'PY'
import sys
from datetime import date, datetime
from zoneinfo import ZoneInfo

try:
    requested = date.fromisoformat(sys.argv[1])
except ValueError:
    raise SystemExit(1)

if requested > datetime.now(ZoneInfo("Asia/Kolkata")).date():
    raise SystemExit(1)
PY
    then
        echo "Date must be a real, non-future date in YYYY-MM-DD format." >&2
        exit 2
    fi

    if [[ -f "$SCRIPT_DIR/data/$TARGET_DATE.json" && "$REPLACE" != "true" ]]; then
        echo "Digest for $TARGET_DATE already exists; nothing was changed."
        echo "Use --force only if you deliberately want to replace it."
        exit 0
    fi
fi

CODEX_BIN=""
if command -v codex &> /dev/null && codex --version &> /dev/null; then
    CODEX_BIN="$(command -v codex)"
elif [[ -x "$APP_CODEX" ]] && "$APP_CODEX" --version &> /dev/null; then
    CODEX_BIN="$APP_CODEX"
fi

if [[ -z "$CODEX_BIN" ]]; then
    echo "Codex CLI is unavailable. Install it, then run 'codex login' with ChatGPT." >&2
    echo "Official installer: curl -fsSL https://chatgpt.com/codex/install.sh | sh" >&2
    exit 1
fi

echo "Using $($CODEX_BIN --version) from $CODEX_BIN"
if ! "$CODEX_BIN" login status; then
    echo "Codex is not signed in. Run '$CODEX_BIN login' and choose ChatGPT." >&2
    exit 1
fi

if [[ "$CHECK_ONLY" == "true" ]]; then
    echo "Codex desktop generation is ready."
    exit 0
fi

DATE_INSTRUCTION="Generate the edition for $TARGET_DATE."

if [[ "$REPLACE" == "true" ]]; then
    REPLACE_INSTRUCTION="The user explicitly requested replacement, so pass --force to publish.sh."
else
    REPLACE_INSTRUCTION="Do not replace an existing edition. If one exists, keep it and report that no generation was needed."
fi

PROMPT="You are running the Teja's Daily Digest desktop publishing task. Read AGENTS.md and DIGEST_BRIEF.md before acting. $DATE_INSTRUCTION Use live web search and verify every time-sensitive claim and source URL. Prepare the complete digest JSON in a temporary file outside data/. Do not change application code. Do not call run.sh recursively. Publish only through bash publish.sh with the correct --date and --input arguments. $REPLACE_INSTRUCTION Complete the task only after validation, commit, and push succeed; otherwise preserve the existing archive and explain the failure."

echo "Launching Codex through your ChatGPT subscription..."
exec "$CODEX_BIN" --search exec --approve-for-me -C "$SCRIPT_DIR" "$PROMPT"
