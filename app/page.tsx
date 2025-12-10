'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageInput } from '@/components/MessageInput';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: '' },
    ]);
    setInput('');
    setIsLoading(true);

    // Simulate API call - replace with actual API later
    setTimeout(() => {
      setMessages((prev) => {
        const newArr = [...prev];
        if (newArr.length > 0 && newArr[newArr.length - 1].role === 'assistant') {
          newArr[newArr.length - 1].content = 'This is a placeholder response. API integration will be added later.';
        }
        return newArr;
      });
      setIsLoading(false);
    }, 1000);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-24 max-w-5xl mx-auto w-full">
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">NotebookLM Clone</h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Start a conversation by typing a message below or select an example prompt.
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full space-y-4 mb-20">
          {messages.map((message, i) => (
            <div
              key={i}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-black dark:bg-gray-800 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                }`}
              >
                {message.content || (
                  <div className="flex space-x-1 h-6 items-center">
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse delay-75" />
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse delay-150" />
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800">
        <div className="max-w-5xl mx-auto">
          <MessageInput value={input} onChange={setInput} onSubmit={handleSubmit} isLoading={isLoading} />
        </div>
      </div>
    </main>
  );
}
