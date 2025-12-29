"use client";

import { useRef, useEffect } from "react";
import { MessageInput, type MessageInputRef } from "@/components/MessageInput";
import { Messages } from "@/components/Messages";
import { useChat } from "@/hooks/useChat";

export default function Home() {
  const { messages, input, setInput, isLoading, connectionStatus, handleSubmit, stop } =
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
      <div className="w-full flex-1">
        <Messages messages={messages} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-gray-950 via-gray-950/95 to-transparent pb-6 pt-12">
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
