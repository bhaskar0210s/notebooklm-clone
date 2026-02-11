"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatSession, Message } from "@/types/chat.ts";

const STORAGE_KEY = "notebooklm-chat-history";
const MAX_TITLE_LENGTH = 30;

interface UseChatHistoryReturn {
  chatSessions: ChatSession[];
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  saveSession: (threadId: string, messages: Message[]) => void;
  addUploadSession: (threadId: string, title?: string) => void;
  deleteSession: (threadId: string) => void;
  getSession: (threadId: string) => ChatSession | undefined;
  clearHistory: () => void;
}

function generateTitle(messages: Message[]): string {
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (!firstUserMessage) return "New Chat";
  
  const content = firstUserMessage.content.trim();
  if (content.length <= MAX_TITLE_LENGTH) return content;
  return content.substring(0, MAX_TITLE_LENGTH) + "...";
}

function loadFromStorage(): ChatSession[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as ChatSession[];
  } catch {
    return [];
  }
}

function saveToStorage(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Storage quota exceeded or other error
  }
}

export function useChatHistory(): UseChatHistoryReturn {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const sessions = loadFromStorage();
    setChatSessions(sessions);
    setIsLoaded(true);
  }, []);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      saveToStorage(chatSessions);
    }
  }, [chatSessions, isLoaded]);

  const addUploadSession = useCallback(
    (threadId: string, title: string = "Uploaded document") => {
      setChatSessions((prev) => {
        if (prev.some((s) => s.threadId === threadId)) return prev;
        const now = Date.now();
        const newSession: ChatSession = {
          threadId,
          title,
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        return [newSession, ...prev];
      });
    },
    [],
  );

  const saveSession = useCallback((threadId: string, messages: Message[]) => {
    if (messages.length === 0) return;

    setChatSessions((prev) => {
      const existingIndex = prev.findIndex((s) => s.threadId === threadId);
      const now = Date.now();
      const title = generateTitle(messages);

      if (existingIndex >= 0) {
        // Update existing session
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          messages,
          title,
          updatedAt: now,
        };
        // Sort by most recent
        return updated.sort((a, b) => b.updatedAt - a.updatedAt);
      } else {
        // Add new session
        const newSession: ChatSession = {
          threadId,
          title,
          messages,
          createdAt: now,
          updatedAt: now,
        };
        return [newSession, ...prev];
      }
    });
  }, []);

  const deleteSession = useCallback((threadId: string) => {
    setChatSessions((prev) => prev.filter((s) => s.threadId !== threadId));
    if (currentSessionId === threadId) {
      setCurrentSessionId(null);
    }
  }, [currentSessionId]);

  const getSession = useCallback(
    (threadId: string) => {
      return chatSessions.find((s) => s.threadId === threadId);
    },
    [chatSessions]
  );

  const clearHistory = useCallback(() => {
    setChatSessions([]);
    setCurrentSessionId(null);
  }, []);

  return {
    chatSessions,
    currentSessionId,
    setCurrentSessionId,
    saveSession,
    addUploadSession,
    deleteSession,
    getSession,
    clearHistory,
  };
}
