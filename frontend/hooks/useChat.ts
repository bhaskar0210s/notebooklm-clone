"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { getLangGraphClient } from "@/lib/langgraph.ts";
import { retrievalAssistantId } from "@/constants/graphConfigs.ts";
import { API_ENDPOINTS, ERROR_MESSAGES } from "@/constants/api.ts";
import type { Message, ConnectionStatus } from "@/types/chat.ts";
import {
  parseSSEChunk,
  isSSEErrorEvent,
  extractSSEErrorMessage,
  readSSEStream,
  isSSEInterruptedErrorEvent,
} from "@/lib/utils/sse.ts";

interface UseChatReturn {
  messages: Message[];
  input: string;
  setInput: (inputValue: string) => void;
  isLoading: boolean;
  connectionStatus: ConnectionStatus;
  threadId: string | null;
  handleSubmit: (event: React.FormEvent) => Promise<void>;
  submitMessage: (
    messageText: string,
    messagesBeforeEdit?: Message[],
  ) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  editAndResubmitMessage: (
    messageIndex: number,
    newContent: string,
  ) => Promise<void>;
  stop: () => Promise<void>;
  newChat: () => Promise<void>;
  loadSession: (sessionThreadId: string, sessionMessages: Message[]) => void;
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
  const chatAbortRef = useRef<AbortController | null>(null);

  // Initialize thread on mount
  useEffect(() => {
    // Only initialize if we don't have a thread ID yet
    if (threadId) return;

    let isCancelled = false;
    setConnectionStatus("connecting");

    const initializeThread = async () => {
      try {
        const client = getLangGraphClient();
        const thread = await client.threads.create({
          graphId: retrievalAssistantId,
        });

        if (!isCancelled) {
          setThreadId(thread.thread_id);
          setConnectionStatus("connected");
        }
      } catch (error) {
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

  // Abort in-flight chat request on unmount (e.g. browser refresh)
  useEffect(() => {
    return () => {
      if (chatAbortRef.current) {
        chatAbortRef.current.abort();
      }
    };
  }, []);

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
    async (
      messageText: string,
      targetThreadId?: string,
      messagesBeforeEdit?: Message[],
      signal?: AbortSignal,
    ) => {
      const id = targetThreadId ?? threadId;
      if (!id) throw new Error("No thread ID");

      const body: Record<string, unknown> = {
        message: messageText,
        threadId: id,
        assistantId: retrievalAssistantId,
      };
      if (Array.isArray(messagesBeforeEdit)) {
        body.messagesBeforeEdit = messagesBeforeEdit;
      }

      const response = await fetch(API_ENDPOINTS.CHAT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
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
              const errorMessage =
                extractSSEErrorMessage(event) ??
                ERROR_MESSAGES.STREAMING_ERROR;
              // Preserve partial content when stream ends with error (e.g. user stopped)
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last.content?.trim()) {
                  return prev; // Keep existing streamed content
                }
                return [
                  ...prev.slice(0, -1),
                  { role: "assistant", content: errorMessage },
                ];
              });
              toast.error(errorMessage);
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
    async (
      messageText: string,
      messagesBeforeEdit?: Message[],
    ) => {
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

      const controller = new AbortController();
      chatAbortRef.current = controller;

      try {
        const response = await sendMessage(
          trimmedInput,
          undefined,
          messagesBeforeEdit,
          controller.signal,
        );
        await processStreamEvents(response);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        const errorMessage =
          error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR;
        // Preserve partial content if user stopped - only show error when nothing was streamed
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.content?.trim()) {
            return prev; // Keep existing streamed content
          }
          return [
            ...prev.slice(0, -1),
            { role: "assistant", content: errorMessage },
          ];
        });
        toast.error(errorMessage);
      } finally {
        chatAbortRef.current = null;
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

  const retryLastMessage = useCallback(async () => {
    const lastUserIndex = messages.findLastIndex((m) => m.role === "user");
    if (lastUserIndex === -1 || isLoading) return;

    const lastUserMessage = messages[lastUserIndex];
    if (!lastUserMessage?.content?.trim()) return;

    if (connectionStatus !== "connected" || !threadId) {
      toast.info(ERROR_MESSAGES.BACKEND_NOT_READY);
      return;
    }

    // Remove the last user message and its assistant response
    const messagesBeforeEdit = messages.slice(0, lastUserIndex);
    setMessages((prev) => prev.slice(0, lastUserIndex));
    await submitMessage(lastUserMessage.content, messagesBeforeEdit);
  }, [messages, isLoading, connectionStatus, threadId, submitMessage]);

  const editAndResubmitMessage = useCallback(
    async (messageIndex: number, newContent: string) => {
      newContent = newContent.trim();
      if (!newContent || isLoading) return;

      const message = messages[messageIndex];
      if (!message || message.role !== "user") return;

      if (connectionStatus !== "connected" || !threadId) {
        toast.info(ERROR_MESSAGES.BACKEND_NOT_READY);
        return;
      }

      // Messages before the edit point - backend will set these so it remembers context
      const messagesBeforeEdit = messages.slice(0, messageIndex);

      // Truncate at edited message, add new user message + empty assistant for streaming
      setMessages((prev) => [
        ...prev.slice(0, messageIndex),
        { role: "user", content: newContent },
        { role: "assistant", content: "" },
      ]);
      setInput("");
      setIsLoading(true);
      currentRunIdRef.current = null;

      const controller = new AbortController();
      chatAbortRef.current = controller;

      try {
        const response = await sendMessage(
          newContent,
          threadId,
          messagesBeforeEdit,
          controller.signal,
        );
        await processStreamEvents(response);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        const errorMessage =
          error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR;
        // Preserve partial content if user stopped - only show error when nothing was streamed
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.content?.trim()) {
            return prev; // Keep existing streamed content
          }
          return [
            ...prev.slice(0, -1),
            { role: "assistant", content: errorMessage },
          ];
        });
        toast.error(errorMessage);
      } finally {
        chatAbortRef.current = null;
        setIsLoading(false);
        currentRunIdRef.current = null;
      }
    },
    [
      messages,
      isLoading,
      connectionStatus,
      threadId,
      sendMessage,
      processStreamEvents,
      appendAssistantMessage,
    ],
  );

  const stop = useCallback(async () => {
    // Abort the fetch to stop reading the stream immediately
    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
      chatAbortRef.current = null;
    }

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
        // Silently handle cancellation errors
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
      const thread = await client.threads.create({
        graphId: retrievalAssistantId,
      });
      setThreadId(thread.thread_id);
      setConnectionStatus("connected");
    } catch (error) {
      setConnectionStatus("error");
      toast.error(ERROR_MESSAGES.CONNECTION_FAILED);
    }
  }, [stop]);

  const loadSession = useCallback(
    (sessionThreadId: string, sessionMessages: Message[]) => {
      // Stop any ongoing stream
      if (chatAbortRef.current) {
        chatAbortRef.current.abort();
        chatAbortRef.current = null;
      }
      currentRunIdRef.current = null;
      setIsLoading(false);

      // Load the session
      setThreadId(sessionThreadId);
      setMessages(sessionMessages);
      setInput("");
      setConnectionStatus("connected");
    },
    [],
  );

  return {
    messages,
    input,
    setInput,
    isLoading,
    connectionStatus,
    threadId,
    handleSubmit,
    submitMessage,
    retryLastMessage,
    editAndResubmitMessage,
    stop,
    newChat,
    loadSession,
  };
}
