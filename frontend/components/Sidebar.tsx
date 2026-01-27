"use client";

import { useEffect, useRef } from "react";
import { PlusIcon, Bars3Icon, XMarkIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { ChatSession } from "@/types/chat.ts";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  chatSessions: ChatSession[];
  currentSessionId: string | null;
  onNewChat: () => void;
  onSelectChat: (threadId: string) => void;
  onDeleteChat: (threadId: string) => void;
}

export function Sidebar({
  isOpen,
  onToggle,
  chatSessions,
  currentSessionId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
}: SidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close sidebar when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        onToggle();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  // Close sidebar on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        onToggle();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onToggle]);

  return (
    <>
      {/* Hamburger Toggle Button - Always visible */}
      <button
        onClick={onToggle}
        className="fixed left-4 top-4 z-50 rounded-lg border border-gray-700/50 bg-gray-800/80 p-2.5 text-gray-300 shadow-lg backdrop-blur-sm transition-all hover:border-gray-600/50 hover:bg-gray-800 hover:text-white md:left-6 md:top-6"
        aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
      >
        {isOpen ? (
          <XMarkIcon className="h-5 w-5" />
        ) : (
          <Bars3Icon className="h-5 w-5" />
        )}
      </button>

      {/* New Chat Button - Always visible below hamburger (when sidebar is closed) */}
      {!isOpen && (
        <button
          onClick={onNewChat}
          className="fixed left-4 top-16 z-50 rounded-lg border border-gray-700/50 bg-gray-800/80 p-2.5 text-gray-300 shadow-lg backdrop-blur-sm transition-all hover:border-blue-500/50 hover:bg-gray-800 hover:text-white md:left-6 md:top-[4.5rem]"
          aria-label="New Chat"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      )}

      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden="true"
      />

      {/* Sidebar Panel */}
      <div
        ref={sidebarRef}
        className={`fixed left-0 top-0 z-40 flex h-full w-72 flex-col border-r border-gray-800 bg-gray-900/95 backdrop-blur-md transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header with spacing for hamburger */}
        <div className="flex items-center justify-between border-b border-gray-800 px-4 pb-4 pt-16 md:pt-20">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Chats
          </h2>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <button
            onClick={() => {
              onNewChat();
              onToggle();
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-gray-700/50 bg-gray-800/60 px-4 py-3 text-sm font-medium text-gray-300 transition-all hover:border-blue-500/50 hover:bg-gray-800 hover:text-white"
          >
            <PlusIcon className="h-5 w-5" />
            New Chat
          </button>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-hide">
          {chatSessions.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No recent chats
            </div>
          ) : (
            <div className="space-y-1">
              {chatSessions.map((session) => (
                <div
                  key={session.threadId}
                  className={`group relative flex items-center rounded-lg transition-all ${
                    currentSessionId === session.threadId
                      ? "bg-gray-800"
                      : "hover:bg-gray-800/50"
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelectChat(session.threadId);
                      onToggle();
                    }}
                    className="flex-1 px-4 py-3 text-left"
                  >
                    <div className="truncate text-sm text-gray-300">
                      {session.title}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {formatRelativeTime(session.updatedAt)}
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(session.threadId);
                    }}
                    className="mr-2 rounded p-1.5 text-gray-500 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
                    aria-label="Delete chat"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}
