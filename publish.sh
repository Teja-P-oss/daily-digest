#!/bin/bash
# Validate, index, commit, and push a prepared Daily Digest JSON file.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

if ! command -v python3 &> /dev/null; then
    echo "python3 could not be found. Please install Python 3.10 or newer." >&2
    exit 1
fi

echo "Checking/Installing publishing dependencies..."
python3 -m pip install -q --disable-pip-version-check -r "$SCRIPT_DIR/requirements.txt"

echo "Fetching latest changes from GitHub..."
git -C "$SCRIPT_DIR" pull --rebase

echo "Validating prepared digest..."
python3 "$SCRIPT_DIR/update_website.py" "$@"

git -C "$SCRIPT_DIR" add data/
if git -C "$SCRIPT_DIR" diff --cached --quiet -- data/; then
    echo "No digest changes to publish."
    exit 0
fi

git -C "$SCRIPT_DIR" commit -m "Update Teja's daily digest" -- data/
git -C "$SCRIPT_DIR" pull --rebase
git -C "$SCRIPT_DIR" push
echo "Digest pushed to GitHub; Vercel deployment should start automatically."
