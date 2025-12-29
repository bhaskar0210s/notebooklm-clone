import { Client } from "@langchain/langgraph-sdk";

let browserClientInstance: Client | null = null;
let serverClientInstance: Client | null = null;

const apiUrl = "http://localhost:2024";

/**
 * Returns a singleton LangGraph client for browser use.
 */
export function getLangGraphClient(): Client {
  if (browserClientInstance) return browserClientInstance;

  browserClientInstance = new Client({ apiUrl });
  return browserClientInstance;
}

/**
 * Returns a singleton LangGraph client for server-side calls (API routes).
 */
export function getServerLangGraphClient(): Client {
  if (serverClientInstance) return serverClientInstance;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  serverClientInstance = new Client({ apiUrl, defaultHeaders: requestHeaders });
  return serverClientInstance;
}
