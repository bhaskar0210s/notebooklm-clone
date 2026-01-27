/**
 * Shared types for chat functionality
 */

export type MessageRole = "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
}

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

export interface ChatState {
  messages: Message[];
  input: string;
  isLoading: boolean;
  connectionStatus: ConnectionStatus;
  threadId: string | null;
}

export interface SSEEvent {
  event?: string;
  data?: SSEEventData;
}

export interface SSEErrorData {
  message?: string;
  error?: string;
}

export type SSEEventData =
  | SSEMessagePayload[]
  | { messages?: SSEMessagePayload[] }
  | SSEErrorData
  | unknown;

export interface SSEMessagePayload {
  type?: string;
  content?: string | ContentPart[] | unknown;
}

export interface ContentPart {
  text?: string;
  [key: string]: unknown;
}

export interface ChatApiRequest {
  message: string;
  threadId: string;
  assistantId: string;
}

export interface ChatApiError {
  error: string;
}

export interface ChatSession {
  threadId: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}
