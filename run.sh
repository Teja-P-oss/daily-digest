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
# should provide GEMINI_API_KEY through an encrypted repository secret.
if [[ -z "${GEMINI_API_KEY:-}" && -z "${GOOGLE_API_KEY:-}" ]]; then
    if [[ -t 0 ]]; then
        read -r -s -p "Paste your Gemini API key: " GEMINI_API_KEY
        echo
        export GEMINI_API_KEY
    else
        echo "GEMINI_API_KEY is required for a non-interactive run."
        exit 1
    fi
fi

# Install dependencies if they are not already installed
echo "Checking/Installing dependencies (google-antigravity)..."
python3 -m pip install -q google-antigravity

# Fetch latest from github
echo "Fetching latest changes from github..."
git -C "$SCRIPT_DIR" pull --rebase

# Run the python script
echo "Running AI script..."
python3 "$SCRIPT_DIR/update_website.py"
