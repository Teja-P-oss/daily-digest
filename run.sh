#!/bin/bash
# Standalone execution script for AI Website Update

echo "Starting Daily Digest Automation..."

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

# Check if pip is installed
if ! command -v pip &> /dev/null; then
    echo "pip could not be found. Please install Python and pip."
    exit 1
fi

# Install dependencies if they are not already installed
echo "Checking/Installing dependencies (google-antigravity)..."
pip install -q google-antigravity

# Run the python script
echo "Running AI script..."
python "$SCRIPT_DIR/update_website.py"
