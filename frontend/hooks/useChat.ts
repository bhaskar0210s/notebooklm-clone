"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { getLangGraphClient } from "@/lib/langgraph";
import { retrievalAssistantId } from "@/constants/graphConfigs";
import { API_ENDPOINTS, ERROR_MESSAGES } from "@/constants/api";
import type { Message, ConnectionStatus } from "@/types/chat";
import {
  parseSSEChunk,
  isSSEErrorEvent,
  readSSEStream,
  isSSEInterruptedErrorEvent,
} from "@/lib/utils/sse";

interface UseChatReturn {
  messages: Message[];
  input: string;
  setInput: (inputValue: string) => void;
  isLoading: boolean;
  connectionStatus: ConnectionStatus;
  handleSubmit: (event: React.FormEvent) => Promise<void>;
  submitMessage: (messageText: string) => Promise<void>;
  stop: () => Promise<void>;
  newChat: () => Promise<void>;
}

/**
 * Custom hook for managing chat state and interactions.
 * Handles thread creation, message management, and SSE streaming.
 */
export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [threadId, setThreadId] = useState<string | null>(null);
  const currentRunIdRef = useRef<string | null>(null);

  // Initialize thread on mount
  useEffect(() => {
    // Only initialize if we don't have a thread ID yet
    if (threadId) return;

    let isCancelled = false;
    setConnectionStatus("connecting");

    const initializeThread = async () => {
      try {
        const client = getLangGraphClient();
        const thread = await client.threads.create();

        if (!isCancelled) {
          setThreadId(thread.thread_id);
          setConnectionStatus("connected");
        }
      } catch (error) {
        console.error("Error creating thread:", error);
        if (!isCancelled) {
          setConnectionStatus("error");
          toast.error(ERROR_MESSAGES.CONNECTION_FAILED);
        }
      }
    };

    initializeThread();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const appendAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => {
      if (prev.length === 0) {
        return [{ role: "assistant", content }];
      }

      const lastMessage = prev[prev.length - 1];
      if (lastMessage.role === "assistant") {
        return [...prev.slice(0, -1), { ...lastMessage, content }];
      }

      return [...prev, { role: "assistant", content }];
    });
  }, []);

  const sendMessage = useCallback(
    async (messageText: string) => {
      const response = await fetch(API_ENDPOINTS.CHAT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          threadId,
          assistantId: retrievalAssistantId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage =
          (errorData as { error?: string })?.error ??
          `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      return response;
    },
    [threadId],
  );

  /**
   * Extracts run_id from SSE event chunks.
   * Run_id is typically found in metadata events that have a data.run_id property.
   */
  const extractRunId = useCallback((event: unknown): string | null => {
    if (
      event &&
      typeof event === "object" &&
      "data" in event &&
      event.data &&
      typeof event.data === "object" &&
      "run_id" in event.data &&
      typeof (event.data as { run_id?: unknown }).run_id === "string"
    ) {
      return (event.data as { run_id: string }).run_id;
    }
    return null;
  }, []);

  const processStreamEvents = useCallback(
    async (response: Response) => {
      try {
        for await (const event of readSSEStream(response)) {
          // Extract and track run_id from events
          if (!currentRunIdRef.current) {
            const runId = extractRunId(event);

            if (runId) {
              currentRunIdRef.current = runId;
            } else {
              if (!isSSEInterruptedErrorEvent(event)) {
                toast.error(ERROR_MESSAGES.NO_RUN_ID);
              }
            }
          }

          const content = parseSSEChunk(event);
          if (content) {
            appendAssistantMessage(content);
          } else if (isSSEErrorEvent(event)) {
            if (!isSSEInterruptedErrorEvent(event)) {
              toast.error(ERROR_MESSAGES.STREAMING_ERROR);
            }
          }
        }
      } catch (error) {
        throw error;
      }
    },
    [appendAssistantMessage, extractRunId],
  );

  const submitMessage = useCallback(
    async (messageText: string) => {
      const trimmedInput = messageText.trim();
      if (!trimmedInput || isLoading) return;

      if (connectionStatus !== "connected" || !threadId) {
        toast.info(ERROR_MESSAGES.BACKEND_NOT_READY);
        return;
      }

      // Optimistically update UI
      setMessages((prev) => [
        ...prev,
        { role: "user", content: trimmedInput },
        { role: "assistant", content: "" },
      ]);
      setInput("");
      setIsLoading(true);

      // Reset run_id for new request
      currentRunIdRef.current = null;

      try {
        const response = await sendMessage(trimmedInput);
        await processStreamEvents(response);
      } catch (error) {
        console.error("Error sending message:", error);
        appendAssistantMessage(ERROR_MESSAGES.PROCESSING_ERROR);
        toast.error(
          error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
        );
      } finally {
        setIsLoading(false);
        currentRunIdRef.current = null;
      }
    },
    [
      isLoading,
      connectionStatus,
      threadId,
      sendMessage,
      processStreamEvents,
      appendAssistantMessage,
    ],
  );

  const handleSubmit = useCallback(
    async (formEvent: React.FormEvent) => {
      formEvent.preventDefault();
      await submitMessage(input);
    },
    [input, submitMessage],
  );

  const stop = useCallback(async () => {
    // Cancel the run on the backend if we have a run_id
    if (currentRunIdRef.current && threadId) {
      try {
        const client = getLangGraphClient();
        if (
          client.runs &&
          typeof (client.runs as { cancel?: unknown }).cancel === "function"
        ) {
          await (
            client.runs as {
              cancel: (threadId: string, runId: string) => Promise<unknown>;
            }
          ).cancel(threadId, currentRunIdRef.current);
        }
      } catch (cancelError) {
        console.debug("Error cancelling run:", cancelError);
      }
    }

    currentRunIdRef.current = null;
    setIsLoading(false);
  }, [threadId]);

  const newChat = useCallback(async () => {
    // Stop any ongoing stream first
    await stop();

    // Clear messages and reset state
    setMessages([]);
    setInput("");
    setIsLoading(false);
    currentRunIdRef.current = null;

    // Create a new thread
    try {
      const client = getLangGraphClient();
      const thread = await client.threads.create();
      setThreadId(thread.thread_id);
      setConnectionStatus("connected");
    } catch (error) {
      console.error("Error creating new thread:", error);
      setConnectionStatus("error");
      toast.error(ERROR_MESSAGES.CONNECTION_FAILED);
    }
  }, [stop]);

  return {
    messages,
    input,
    setInput,
    isLoading,
    connectionStatus,
    handleSubmit,
    submitMessage,
    stop,
    newChat,
  };
}
