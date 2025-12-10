"use client";

import { useState } from "react";
import { MessageInput } from "@/components/MessageInput";
import { Messages } from "@/components/Messages";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setIsLoading(true);

    // Simulate API call - replace with actual API later
    setTimeout(() => {
      setMessages((prev) => {
        const newArr = [...prev];
        if (
          newArr.length > 0 &&
          newArr[newArr.length - 1].role === "assistant"
        ) {
          newArr[newArr.length - 1].content =
            "This is a placeholder response. API integration will be added later.";
        }
        return newArr;
      });
      setIsLoading(false);
    }, 1000);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-24 max-w-5xl mx-auto w-full">
      <Messages messages={messages} />

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800">
        <div className="max-w-5xl mx-auto">
          <MessageInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      </div>
    </main>
  );
}
