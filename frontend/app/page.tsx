"use client";

import { useRef, useEffect } from "react";
import { MessageInput, type MessageInputRef } from "@/components/MessageInput";
import { Messages } from "@/components/Messages";
import { useChat } from "@/hooks/useChat";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { messages, input, setInput, isLoading, connectionStatus, handleSubmit, submitMessage, stop, newChat } =
    useChat();
  const inputRef = useRef<MessageInputRef>(null);

  const isConnected = connectionStatus === "connected";

  // Focus input when connected and not loading
  useEffect(() => {
    if (isConnected && !isLoading) {
      const timeoutId = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isConnected, isLoading]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center p-4 pb-32 md:p-8 md:pb-36">
      {/* New Chat Button - Top Left */}
      <div className="fixed top-4 left-4 z-20 md:top-6 md:left-6">
        <Button
          onClick={newChat}
          className="flex items-center gap-2 rounded-xl border border-gray-700/50 bg-gray-800/80 px-4 py-2.5 text-sm font-medium text-gray-300 shadow-lg backdrop-blur-sm transition-all hover:border-gray-600/50 hover:bg-gray-800 hover:text-white"
          aria-label="New Chat"
        >
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">New Chat</span>
        </Button>
      </div>

      <div className="w-full flex-1">
        <Messages messages={messages} isLoading={isLoading} onExamplePromptClick={submitMessage} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-10 bg-linear-to-t from-gray-950 via-gray-950/95 to-transparent pb-6 pt-12">
        <div className="mx-auto max-w-4xl px-4">
          <MessageInput
            ref={inputRef}
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            onStop={stop}
            isLoading={isLoading}
            disabled={!isConnected}
          />
        </div>
      </div>
    </main>
  );
}
