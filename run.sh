#!/bin/bash
# Publish a Daily Digest edition prepared through Codex.

set -euo pipefail

echo "Starting Daily Digest publisher..."

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "python3 could not be found. Please install Python 3.10 or newer."
    exit 1
fi

# Install the validation dependency.
echo "Checking/Installing validation dependency..."
python3 -m pip install -q --disable-pip-version-check -r "$SCRIPT_DIR/requirements.txt"

# Fetch latest from github
echo "Fetching latest changes from github..."
git -C "$SCRIPT_DIR" pull --rebase

# Validate the prepared edition and rebuild the archive indexes.
echo "Validating prepared digest..."
python3 "$SCRIPT_DIR/update_website.py" "$@"

# The publisher owns only data files. Git operations remain deterministic and
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
