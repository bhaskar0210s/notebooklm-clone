"use client";

import { useRef, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { ArrowUpIcon, PaperClipIcon } from "@heroicons/react/24/outline";
import { StopIcon } from "@heroicons/react/24/solid";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop?: () => void | Promise<void>;
  onFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  isLoading?: boolean;
  isUploading?: boolean;
  disabled?: boolean;
}

export interface MessageInputRef {
  focus: () => void;
}

export const MessageInput = forwardRef<MessageInputRef, MessageInputProps>(
  ({ value, onChange, onSubmit, onStop, onFileUpload, isLoading = false, isUploading = false, disabled = false }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const handleFileButtonClick = () => {
      fileInputRef.current?.click();
    };

    return (
      <form onSubmit={onSubmit} className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={onFileUpload}
          className="hidden"
        />
        <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-gray-700/50 bg-gray-800/80 px-5 py-3.5 shadow-xl backdrop-blur-sm transition-all hover:border-gray-600/50 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20">
          <Button
            type="button"
            onClick={handleFileButtonClick}
            disabled={isUploading || disabled}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-all hover:bg-gray-700/50 hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Upload file"
          >
            {isUploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            ) : (
              <PaperClipIcon className="h-4 w-4" />
            )}
          </Button>
          <Input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isUploading ? "Uploading PDF..." : "Ask anything..."}
            disabled={disabled || isUploading}
            className="h-auto flex-1 bg-transparent text-base text-white placeholder:text-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button
            type={isLoading ? "button" : "submit"}
            onClick={handleButtonClick}
            disabled={isLoading ? false : !value.trim() || disabled || isUploading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-500 hover:to-blue-600 hover:shadow-blue-500/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:from-blue-600 disabled:hover:to-blue-700 active:scale-95"
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
