#!/bin/sh

# Load environment variables from project root .env file
# This mimics how Docker Compose loads env vars in production
if [ -f "../.env" ]; then
  export $(grep -v '^#' ../.env | xargs)
fi

# Start LangGraph CLI dev server
exec npx @langchain/langgraph-cli dev --no-browser
