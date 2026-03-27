#!/bin/bash
# Simple code execution in ephemeral Docker container

set -e

LANGUAGE="${1:-javascript}"
TIMEOUT="${2:-10}"

if [ "$LANGUAGE" = "javascript" ]; then
    echo "console.log('Hello from JavaScript!');" > /tmp/code.js
    timeout "$TIMEOUT" node /tmp/code.js
elif [ "$LANGUAGE" = "python" ]; then
    echo "print('Hello from Python!')" > /tmp/code.py
    timeout "$TIMEOUT" python3 /tmp/code.py
else
    echo "Unsupported language: $LANGUAGE"
    exit 1
fi
