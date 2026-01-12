# Backend Dockerfile
# Uses Node.js 22 for LangGraph CLI

FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY langgraph.json ./

# Install all dependencies (including dev dependencies for TypeScript compilation)
# LangGraph CLI needs TypeScript to compile the graphs
RUN npm ci

# Copy source code and config
COPY tsconfig.json ./
COPY src/ ./src/

# Expose the port that LangGraph CLI uses
EXPOSE 2024

# Set environment variable for port
ENV PORT=2024

# Run LangGraph CLI dev server
# --host 0.0.0.0 allows external connections
# --port uses the PORT env var
CMD ["npx", "@langchain/langgraph-cli", "dev", "--host", "0.0.0.0", "--port", "2024"]
