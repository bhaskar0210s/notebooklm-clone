#!/usr/bin/env sh

if [ -f "../.env" ]; then
    set -a
    . ../.env
    set +a
else
    echo "Note: ../.env file not found" >&2
fi

exec npx @langchain/langgraph-cli dev --no-browser