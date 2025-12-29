/**
 * SSE (Server-Sent Events) parsing and streaming utilities
 */

import type { SSEEvent, SSEMessagePayload, ContentPart } from "@/types/chat";
import { SSE_CONSTANTS } from "@/constants/api";

/**
 * Extracts text content from various message content formats.
 * Handles string, array, and object-based content structures.
 */
export function extractMessageContent(
  messageContent: string | ContentPart[] | unknown,
): string | null {
  if (typeof messageContent === "string") {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    const extractedText = messageContent
      .map((contentPart) => {
        if (typeof contentPart === "string") return contentPart;
        if (typeof contentPart === "object" && contentPart !== null) {
          const part = contentPart as ContentPart;
          return typeof part.text === "string" ? part.text : "";
        }
        return "";
      })
      .join("")
      .trim();

    return extractedText || null;
  }

  return null;
}

/**
 * Checks if the message type is from an AI/assistant.
 */
function isAssistantMessage(messageType: string | undefined): boolean {
  if (!messageType) return true; // Default to true if no type specified
  return SSE_CONSTANTS.AI_TYPES.includes(
    messageType as (typeof SSE_CONSTANTS.AI_TYPES)[number],
  );
}

/**
 * Extracts message array from SSE event data.
 */
function extractMessageArray(
  eventData: SSEEvent["data"],
): SSEMessagePayload[] | null {
  if (Array.isArray(eventData)) {
    return eventData as SSEMessagePayload[];
  }

  if (
    eventData &&
    typeof eventData === "object" &&
    "messages" in eventData &&
    Array.isArray((eventData as { messages?: unknown[] }).messages)
  ) {
    return (eventData as { messages: SSEMessagePayload[] }).messages;
  }

  return null;
}

/**
 * Parses an SSE event chunk and extracts message content.
 * Returns the content string if valid, null otherwise.
 */
export function parseSSEChunk(eventChunk: unknown): string | null {
  if (!eventChunk || typeof eventChunk !== "object") {
    return null;
  }

  const { event: eventType, data: eventData } = eventChunk as SSEEvent;

  if (!eventType?.startsWith(SSE_CONSTANTS.MESSAGE_EVENT_PREFIX)) {
    return null;
  }

  const messageArray = extractMessageArray(eventData);
  if (!messageArray || messageArray.length === 0) {
    return null;
  }

  const lastMessage = messageArray[messageArray.length - 1];

  if (!isAssistantMessage(lastMessage?.type)) {
    return null;
  }

  const messageText = extractMessageContent(lastMessage?.content);
  if (!messageText?.trim()) {
    return null;
  }

  // Filter out JSON metadata that sometimes appears
  if (messageText.trim().startsWith("{")) {
    return null;
  }

  return messageText;
}

/**
 * Checks if an SSE event is an error event.
 */
export function isSSEErrorEvent(eventChunk: unknown): boolean {
  return (
    eventChunk !== null &&
    typeof eventChunk === "object" &&
    "event" in eventChunk &&
    (eventChunk as SSEEvent).event === SSE_CONSTANTS.ERROR_EVENT
  );
}

/**
 * Parses a single SSE data line into a JavaScript object.
 */
function parseSSELine(line: string): unknown | null {
  const trimmedLine = line.trim();
  if (!trimmedLine.startsWith(SSE_CONSTANTS.DATA_PREFIX)) {
    return null;
  }

  const jsonString = trimmedLine.slice(SSE_CONSTANTS.DATA_PREFIX.length).trim();
  try {
    return JSON.parse(jsonString);
  } catch {
    console.error("Failed to parse SSE event:", trimmedLine);
    return null;
  }
}

/**
 * Processes an SSE buffer string and returns parsed events.
 */
export function processSSEBuffer(bufferString: string): {
  parsedEvents: unknown[];
  remainingBuffer: string;
} {
  const eventStrings = bufferString.split(SSE_CONSTANTS.EVENT_DELIMITER);
  const remainingBuffer = eventStrings.pop() ?? "";

  const parsedEvents = eventStrings
    .map(parseSSELine)
    .filter((event): event is unknown => event !== null);

  return { parsedEvents, remainingBuffer };
}

/**
 * Reads an SSE stream and yields parsed events.
 * This is a generator function for efficient streaming.
 */
export async function* readSSEStream(
  response: Response,
): AsyncGenerator<unknown, void, unknown> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No reader available on response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { parsedEvents, remainingBuffer } = processSSEBuffer(buffer);
      buffer = remainingBuffer;

      for (const event of parsedEvents) {
        yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
