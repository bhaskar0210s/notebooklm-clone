import { NextResponse } from "next/server";
import { getServerLangGraphClient } from "@/lib/langgraph.ts";
import {
  retrievalAssistantConfig,
  retrievalAssistantId,
} from "@/constants/graphConfigs.ts";
import { SSE_CONSTANTS } from "@/constants/api.ts";
import type { ChatApiRequest, ChatApiError } from "@/types/chat.ts";

export const runtime = "edge";

/**
 * Validates the chat request payload.
 */
function validateRequest(body: unknown): body is ChatApiRequest {
  if (!body || typeof body !== "object") return false;

  const { message, threadId } = body as Partial<ChatApiRequest>;
  return typeof message === "string" && typeof threadId === "string";
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

    const { message, threadId, assistantId, messagesBeforeEdit } = body;
    const targetAssistantId = assistantId || retrievalAssistantId;
    const client = getServerLangGraphClient();

    if (Array.isArray(messagesBeforeEdit)) {
      const langGraphMessages = messagesBeforeEdit.map((m) => ({
        type: m.role === "user" ? "human" : "ai",
        content: m.content,
      }));
      await client.threads.updateState(threadId, {
        values: { messages: langGraphMessages },
      });
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
    return errorResponse("Internal server error", 500);
  }
}
