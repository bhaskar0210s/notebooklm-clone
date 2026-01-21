#!/bin/sh

# Cloud Run sets PORT automatically, default to 8080 if not set
PORT=${PORT:-8080}

# Start LangGraph CLI dev server
# --host 0.0.0.0 allows external connections
# --port uses the PORT env var from Cloud Run
exec npx @langchain/langgraph-cli dev --host 0.0.0.0 --port ${PORT}
