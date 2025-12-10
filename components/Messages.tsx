import React, { useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

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
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">NotebookLM Clone</h1>
          <p className="mx-auto max-w-md text-gray-600 dark:text-gray-400">
            Start a conversation by typing a message below or select an example
            prompt.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-20 w-full space-y-4">
      {messages.map((message, i) => (
        <div
          key={i}
          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] rounded-2xl px-4 py-2 ${
              message.role === "user"
                ? "bg-black text-white dark:bg-gray-800"
                : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
            }`}
          >
            {message.content || (
              <div className="flex h-6 items-center space-x-1">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-current delay-75" />
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-current delay-150" />
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
