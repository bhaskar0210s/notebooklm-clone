/**
 * SSE (Server-Sent Events) parsing and streaming utilities
 */

import type {
  SSEEvent,
  SSEMessagePayload,
  ContentPart,
  SSEErrorData,
} from "@/types/chat.ts";
import { SSE_CONSTANTS } from "@/constants/api.ts";

interface ParsedSSEMessageChunk {
  content: string;
  messageId?: string;
}

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

function extractRouteDecision(
  messageText: string,
): "direct" | "retrieve" | null {
  const trimmedText = messageText.trim();
  if (!trimmedText) return null;

  const lowercaseText = trimmedText.toLowerCase();
  if (lowercaseText === "direct" || lowercaseText === "retrieve") {
    return lowercaseText;
  }

  const routeLineMatch = trimmedText.match(
    /^route\s*[:=]\s*(direct|retrieve)\.?$/i,
  );
  if (routeLineMatch) {
    return routeLineMatch[1]!.toLowerCase() as "direct" | "retrieve";
  }

  const parseableCandidates = [trimmedText];
  const fencedJsonMatch = trimmedText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedJsonMatch?.[1]) {
    parseableCandidates.push(fencedJsonMatch[1].trim());
  }

  for (const candidate of parseableCandidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        continue;
      }

      const routeValue = parsed.route;
      if (routeValue !== "direct" && routeValue !== "retrieve") {
        continue;
      }

      const allowedKeys = new Set(["route", "reason", "explanation"]);
      const hasOnlyAllowedKeys = Object.keys(parsed).every((key) =>
        allowedKeys.has(key),
      );
      if (!hasOnlyAllowedKeys) {
        continue;
      }

      return routeValue;
    } catch {
      // Not JSON, continue checking other patterns.
    }
  }

  return null;
}

function isInternalRouteDecisionPayload(messageText: string): boolean {
  const routeDecision = extractRouteDecision(messageText);
  if (!routeDecision) {
    return false;
  }

  // Keep the filter narrow so normal assistant responses are not suppressed.
  return messageText.trim().length <= 240;
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
  const parsedChunk = parseSSEMessageChunk(eventChunk);
  return parsedChunk?.content ?? null;
}

export function parseSSEMessageChunk(
  eventChunk: unknown,
): ParsedSSEMessageChunk | null {
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
  if (isInternalRouteDecisionPayload(messageText)) {
    return null;
  }

  return {
    content: messageText,
    messageId: typeof lastMessage?.id === "string" ? lastMessage.id : undefined,
  };
}

export function extractSSEMessageNodeMetadata(
  eventChunk: unknown,
): Record<string, string> {
  if (
    !eventChunk ||
    typeof eventChunk !== "object" ||
    !("event" in eventChunk) ||
    (eventChunk as SSEEvent).event !== "messages/metadata"
  ) {
    return {};
  }

  const metadataEventData = (eventChunk as SSEEvent).data;
  if (!metadataEventData || typeof metadataEventData !== "object") {
    return {};
  }

  const messageNodeById: Record<string, string> = {};
  for (const [messageId, messageMetadata] of Object.entries(
    metadataEventData as Record<string, unknown>,
  )) {
    if (!messageMetadata || typeof messageMetadata !== "object") {
      continue;
    }

    const metadata = (messageMetadata as { metadata?: unknown }).metadata;
    if (!metadata || typeof metadata !== "object") {
      continue;
    }

    const nodeName = (metadata as Record<string, unknown>).langgraph_node;
    if (typeof nodeName === "string" && nodeName.trim()) {
      messageNodeById[messageId] = nodeName;
    }
  }

  return messageNodeById;
}

/**
 * Extracts the error message from an SSE error event.
 * Returns the message string or null if not an error event or no message.
 */
export function extractSSEErrorMessage(eventChunk: unknown): string | null {
  if (
    eventChunk == null ||
    typeof eventChunk !== "object" ||
    !("event" in eventChunk) ||
    (eventChunk as SSEEvent).event !== SSE_CONSTANTS.ERROR_EVENT
  ) {
    return null;
  }

  const eventData = (eventChunk as SSEEvent).data;
  if (eventData == null) return null;

  if (typeof eventData === "string") return eventData;
  if (
    typeof eventData === "object" &&
    "message" in eventData &&
    typeof (eventData as { message?: unknown }).message === "string"
  ) {
    return (eventData as { message: string }).message;
  }
  if (
    typeof eventData === "object" &&
    "error" in eventData &&
    typeof (eventData as { error?: unknown }).error === "string"
  ) {
    return (eventData as { error: string }).error;
  }

  return null;
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
 * Type guard to check if data is an SSE error data object.
 */
function isSSEErrorData(data: unknown): data is SSEErrorData {
  return (
    data !== null &&
    typeof data === "object" &&
    ("message" in data || "error" in data)
  );
}

/**
 * Checks if an SSE event is an interrupted error event.
 */
export function isSSEInterruptedErrorEvent(eventChunk: unknown): boolean {
  if (
    eventChunk === null ||
    typeof eventChunk !== "object" ||
    !("event" in eventChunk) ||
    (eventChunk as SSEEvent).event !== SSE_CONSTANTS.ERROR_EVENT
  ) {
    return false;
  }

  const eventData = (eventChunk as SSEEvent).data;
  return isSSEErrorData(eventData) && eventData.message === "interrupt";
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
