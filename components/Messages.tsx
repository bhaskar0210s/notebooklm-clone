import React, { useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface MessagesProps {
  messages: Message[];
}

export function Messages({ messages }: MessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">NotebookLM Clone</h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Start a conversation by typing a message below or select an example prompt.
          </p>
        </div>
      </div>
    );
  }

  return (
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
  );
}
