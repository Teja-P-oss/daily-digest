#!/bin/bash
# Standalone execution script for AI Website Update

set -euo pipefail

echo "Starting Daily Digest Automation..."

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

# Load credentials stored only on this Mac. This file is ignored by Git and is
# optional so cloud runs can continue to use environment-based repository secrets.
LOCAL_SECRETS_FILE="$SCRIPT_DIR/local_secrets.sh"
if [[ -f "$LOCAL_SECRETS_FILE" ]]; then
    # shellcheck source=/dev/null
    source "$LOCAL_SECRETS_FILE"
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "python3 could not be found. Please install Python 3.10 or newer."
    exit 1
fi

# Keep credentials out of Git-tracked files. For an interactive local run, ask
# for the key without echoing it or saving it in shell history. GitHub Actions
# provides OPENAI_API_KEY through an encrypted repository secret.
if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    if [[ -t 0 ]]; then
        read -r -s -p "Paste your OpenAI API key: " OPENAI_API_KEY
        echo
        export OPENAI_API_KEY
    else
        echo "OPENAI_API_KEY is required for a non-interactive run."
        exit 1
    fi
fi

# Install the pinned runtime dependency.
echo "Checking/Installing OpenAI dependency..."
python3 -m pip install -q --disable-pip-version-check -r "$SCRIPT_DIR/requirements.txt"

# Fetch latest from github
echo "Fetching latest changes from github..."
git -C "$SCRIPT_DIR" pull --rebase

# Run the python script
echo "Running AI script..."
python3 "$SCRIPT_DIR/update_website.py" "$@"

# The generator owns only data files. Git operations remain deterministic and
# happen here after validation and search-index generation succeed.
git -C "$SCRIPT_DIR" add data/
if git -C "$SCRIPT_DIR" diff --cached --quiet -- data/; then
    echo "No digest changes to publish."
    exit 0
fi

git -C "$SCRIPT_DIR" commit -m "Update Teja's daily digest" -- data/
git -C "$SCRIPT_DIR" pull --rebase
git -C "$SCRIPT_DIR" push
echo "Digest pushed to GitHub; Vercel deployment should start automatically."
