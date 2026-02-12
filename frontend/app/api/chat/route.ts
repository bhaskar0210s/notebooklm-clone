import { NextResponse } from "next/server";
import { getServerLangGraphClient } from "@/lib/langgraph.ts";
import {
  retrievalAssistantConfig,
  retrievalAssistantId,
} from "@/constants/graphConfigs.ts";
import { SSE_CONSTANTS } from "@/constants/api.ts";
import type { ChatApiRequest, ChatApiError } from "@/types/chat.ts";

export const runtime = "edge";
const MAX_MESSAGE_LENGTH = 10_000;
const MAX_THREAD_ID_LENGTH = 200;

function isValidMessageHistory(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      item &&
      typeof item === "object" &&
      ("role" in item) &&
      ("content" in item) &&
      ((item as { role?: unknown }).role === "user" ||
        (item as { role?: unknown }).role === "assistant") &&
      typeof (item as { content?: unknown }).content === "string",
  );
}

/**
 * Validates the chat request payload.
 */
function validateRequest(body: unknown): body is ChatApiRequest {
  if (!body || typeof body !== "object") return false;

  const { message, threadId, messagesBeforeEdit } = body as Partial<ChatApiRequest>;
  if (typeof message !== "string" || typeof threadId !== "string") {
    return false;
  }

  const trimmedMessage = message.trim();
  const trimmedThreadId = threadId.trim();
  if (!trimmedMessage || !trimmedThreadId) {
    return false;
  }
  if (
    trimmedMessage.length > MAX_MESSAGE_LENGTH ||
    trimmedThreadId.length > MAX_THREAD_ID_LENGTH
  ) {
    return false;
  }

  return isValidMessageHistory(messagesBeforeEdit);
}

/**
 * Creates an SSE-formatted data string.
 */
function formatSSEData(data: unknown): string {
  return `${SSE_CONSTANTS.DATA_PREFIX} ${JSON.stringify(data)}${SSE_CONSTANTS.EVENT_DELIMITER}`;
}

/**
 * Creates an error response with the given message and status.
 */
function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message } satisfies ChatApiError, {
    status,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!validateRequest(body)) {
      return errorResponse("Message and Thread ID are required", 400);
    }

    const { assistantId, messagesBeforeEdit } = body;
    const message = body.message.trim();
    const threadId = body.threadId.trim();
    const targetAssistantId = assistantId || retrievalAssistantId;
    const client = getServerLangGraphClient();

    if (Array.isArray(messagesBeforeEdit)) {
      const langGraphMessages = messagesBeforeEdit.map((m) => ({
        type: m.role === "user" ? "human" : "ai",
        content: m.content,
      }));
      try {
        await client.threads.updateState(threadId, {
          values: { messages: langGraphMessages },
        });
      } catch (stateError) {
        const errorMessage =
          stateError instanceof Error
            ? stateError.message
            : String(stateError);
        if (!errorMessage.includes("has no graph ID")) {
          throw stateError;
        }
        console.warn(
          `[chat API] Skipping state update for thread ${threadId}: ${errorMessage}`,
        );
      }
    }

    // Pass thread_id so retrieval only fetches docs from this chat's uploads
    const configWithThread = {
      ...retrievalAssistantConfig,
      filterKwargs: {
        ...retrievalAssistantConfig.filterKwargs,
        thread_id: threadId,
      },
    };

    const eventStream = await client.runs.stream(threadId, targetAssistantId, {
      input: { query: message },
      streamMode: ["messages", "updates"],
      config: {
        configurable: configWithThread,
      },
    });

    const encoder = new TextEncoder();

    const sseStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of eventStream) {
            controller.enqueue(encoder.encode(formatSSEData(chunk)));
          }
        } catch (streamError) {
          const errorMessage =
            streamError instanceof Error
              ? streamError.message
              : String(streamError);
          controller.enqueue(
            encoder.encode(
              formatSSEData({
                event: SSE_CONSTANTS.ERROR_EVENT,
                data: { message: errorMessage },
              }),
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(sseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (routeError) {
    console.error("[chat API] Route error:", routeError);
    return errorResponse("Internal server error", 500);
  }
}
