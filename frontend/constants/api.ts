/**
 * API endpoint constants
 */

export const API_ENDPOINTS = {
  CHAT: "/api/chat",
} as const;

/**
 * Error messages for user-facing errors
 */
export const ERROR_MESSAGES = {
  CONNECTION_FAILED:
    "Unable to connect to the chat backend. Check LANGGRAPH env values.",
  BACKEND_NOT_READY:
    "Still connecting to the chat backend. Please wait a moment.",
  STREAMING_ERROR: "Streaming error. Please try again.",
  PROCESSING_ERROR: "Sorry, there was an error processing your message.",
  UNKNOWN_ERROR: "Unknown error occurred",
  NO_STREAM_READER: "No reader available on response body",
  NO_RUN_ID: "No run ID found in event",
} as const;

/**
 * SSE stream constants
 */
export const SSE_CONSTANTS = {
  DATA_PREFIX: "data:",
  EVENT_DELIMITER: "\n\n",
  MESSAGE_EVENT_PREFIX: "messages",
  ERROR_EVENT: "error",
  AI_TYPES: ["ai", "assistant"] as const,
} as const;
