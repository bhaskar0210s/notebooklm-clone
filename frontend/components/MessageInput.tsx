"use client";

import { useRef, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpIcon } from "@heroicons/react/24/outline";
import { StopIcon } from "@heroicons/react/24/solid";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop?: () => void | Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

export interface MessageInputRef {
  focus: () => void;
}

export const MessageInput = forwardRef<MessageInputRef, MessageInputProps>(
  ({ value, onChange, onSubmit, onStop, isLoading = false, disabled = false }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
    }));

    const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isLoading && onStop) {
        e.preventDefault();
        e.stopPropagation();
        onStop();
      }
    };

    return (
      <form onSubmit={onSubmit} className="relative">
        <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-800/80 px-5 py-3.5 shadow-xl backdrop-blur-sm transition-all hover:border-gray-600/50 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20">
          <Input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ask anything..."
            disabled={disabled || isLoading}
            className="h-auto flex-1 bg-transparent text-base text-white placeholder:text-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button
            type={isLoading ? "button" : "submit"}
            onClick={handleButtonClick}
            disabled={isLoading ? false : !value.trim() || disabled}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-500 hover:to-blue-600 hover:shadow-blue-500/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:from-blue-600 disabled:hover:to-blue-700 active:scale-95"
            aria-label={isLoading ? "Stop generation" : disabled ? "Waiting for connection" : "Send message"}
          >
            {isLoading ? (
              <StopIcon className="h-4 w-4" />
            ) : (
              <ArrowUpIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    );
});

MessageInput.displayName = "MessageInput";
