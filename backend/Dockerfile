# Backend Dockerfile
# Uses Node.js 22 for LangGraph CLI

FROM node:22-slim

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

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

# Copy start script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose port (Cloud Run will set PORT env var, default to 8080)
EXPOSE 8080

# Cloud Run sets PORT automatically, so we don't set it here
# The start.sh script will read PORT from environment

# Run start script which reads PORT from Cloud Run
CMD ["/app/start.sh"]
