#!/bin/bash
# Generate and publish Daily Digest editions through Codex and the user's ChatGPT login.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
APP_CODEX="/Applications/ChatGPT.app/Contents/Resources/codex"
TARGET_DATE=""
DAYS=""
REPLACE=false
CHECK_ONLY=false
MAX_ADVANCE_DAYS=7

usage() {
    echo "Usage: bash run.sh [NUMBER_OF_DAYS] [--date YYYY-MM-DD] [--force] [--check]"
    echo "  N        Prepare tomorrow through the next N future calendar days (maximum 7)."
    echo "  --date   Generate today or a historical date; default is today in Asia/Kolkata."
    echo "  --force  Deliberately replace editions that already exist."
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
        [0-9]*)
            if [[ -n "$DAYS" ]]; then
                echo "Provide the number of future days only once." >&2
                exit 2
            fi
            DAYS="$1"
            shift
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
done

if [[ -n "$TARGET_DATE" && -n "$DAYS" ]]; then
    echo "Use either --date or a number of future days, not both." >&2
    exit 2
fi

if [[ -n "$TARGET_DATE" && ! "$TARGET_DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    echo "Date must use YYYY-MM-DD format." >&2
    exit 2
fi

if [[ -n "$DAYS" ]]; then
    if [[ ! "$DAYS" =~ ^[0-9]+$ ]] || (( 10#$DAYS < 1 || 10#$DAYS > MAX_ADVANCE_DAYS )); then
        echo "Number of future days must be between 1 and $MAX_ADVANCE_DAYS." >&2
        exit 2
    fi
    DAYS="$((10#$DAYS))"
fi

TARGET_DATES=()
ADVANCE_FLAGS=()

if [[ "$CHECK_ONLY" != "true" ]]; then
    if ! command -v python3 &> /dev/null; then
        echo "python3 could not be found. Please install Python 3.10 or newer." >&2
        exit 1
    fi

    if [[ -n "$DAYS" ]]; then
        TARGET_OUTPUT="$(python3 - "$DAYS" <<'PY'
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
for offset in range(1, int(sys.argv[1]) + 1):
    print(f"{today + timedelta(days=offset)}|true")
PY
)"
    else
        TARGET_OUTPUT="$(python3 - "$TARGET_DATE" <<'PY'
import sys
from datetime import date, datetime
from zoneinfo import ZoneInfo

today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
try:
    requested = date.fromisoformat(sys.argv[1]) if sys.argv[1] else today
except ValueError:
    print("Date must be a real date in YYYY-MM-DD format.", file=sys.stderr)
    raise SystemExit(2)

if requested > today:
    print("Use a number of days, such as 'bash run.sh 7', to prepare future editions.", file=sys.stderr)
    raise SystemExit(2)
print(f"{requested}|false")
PY
)" || exit $?
    fi

    while IFS='|' read -r date_value advance_value; do
        [[ -z "$date_value" ]] && continue
        TARGET_DATES+=("$date_value")
        ADVANCE_FLAGS+=("$advance_value")
    done <<< "$TARGET_OUTPUT"

    pending_count=0
    for date_value in "${TARGET_DATES[@]}"; do
        if [[ -f "$SCRIPT_DIR/data/$date_value.json" && "$REPLACE" != "true" ]]; then
            echo "Digest for $date_value already exists; skipping it."
        else
            pending_count=$((pending_count + 1))
        fi
    done

    if (( pending_count == 0 )); then
        echo "Nothing to generate. Use --force only if you deliberately want to replace these editions."
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

generated_count=0
for index in "${!TARGET_DATES[@]}"; do
    date_value="${TARGET_DATES[$index]}"
    advance_value="${ADVANCE_FLAGS[$index]}"

    if [[ -f "$SCRIPT_DIR/data/$date_value.json" && "$REPLACE" != "true" ]]; then
        continue
    fi

    if [[ "$REPLACE" == "true" ]]; then
        replace_instruction="The user explicitly requested replacement, so pass --force to publish.sh."
    else
        replace_instruction="Do not replace an existing edition. If one appears before publishing, keep it and report the safe conflict."
    fi

    if [[ "$advance_value" == "true" ]]; then
        mode_instruction="This is an advance vacation edition for a future date. Follow every advance rule in DIGEST_BRIEF.md. Future news and prices are unknowable: use sourced evergreen India/world knowledge, set stock prices to 'Not available — advance edition', set changes to null, and pass --advance to publish.sh."
    else
        mode_instruction="This is a current or historical edition. Use real general news and verified market data appropriate to the date. Do not pass --advance to publish.sh."
    fi

    prompt="You are running the Teja's Daily Digest desktop publishing task. Read AGENTS.md and DIGEST_BRIEF.md before acting. Generate the edition for $date_value. $mode_instruction Use live web search and verify every factual claim and source URL. Check existing archive paper titles and avoid repetition. Prepare the complete digest JSON in a temporary file outside data/. Do not change application code. Do not call run.sh recursively. Publish only through bash publish.sh with the correct --date and --input arguments. $replace_instruction Complete the task only after validation, commit, and push succeed; otherwise preserve the existing archive and explain the failure."

    echo "Launching Codex for $date_value through your ChatGPT subscription..."
    "$CODEX_BIN" --search exec --approve-for-me -C "$SCRIPT_DIR" "$prompt"
    generated_count=$((generated_count + 1))
done

echo "Completed $generated_count digest generation task(s)."
