import React, { useRef, useEffect } from "react";
import type { Message } from "@/types/chat";

interface MessagesProps {
  messages: Message[];
}

export function Messages({ messages }: MessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <div className="text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/20">
            <svg
              className="h-8 w-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h1 className="mb-3 bg-gradient-to-r from-gray-100 to-gray-300 bg-clip-text text-5xl font-bold text-transparent">
            NotebookLM Clone
          </h1>
          <p className="mx-auto max-w-md text-lg text-gray-400">
            Start a conversation by typing a message below
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 py-8">
      {messages.map((message, messageIndex) => (
        <div
          key={messageIndex}
          className={`flex w-full ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`group relative max-w-[80%] md:max-w-[75%] ${
              message.role === "user" ? "ml-auto" : "mr-auto"
            }`}
          >
            <div
              className={`relative rounded-2xl px-5 py-3 shadow-lg transition-all ${
                message.role === "user"
                  ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-blue-500/20"
                  : "bg-gray-800/80 backdrop-blur-sm text-gray-100 shadow-gray-900/50 border border-gray-700/50"
              }`}
            >
              <div className="prose prose-invert prose-sm max-w-none">
                {message.content ? (
                  <p className="m-0 whitespace-pre-wrap break-words leading-relaxed">
                    {message.content}
                  </p>
                ) : (
                  <div className="flex items-center space-x-1.5 py-1">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
                    <div className="h-2 w-2 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                    <div className="h-2 w-2 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
