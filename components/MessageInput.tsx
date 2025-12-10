"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusIcon, ArrowUpIcon } from "@heroicons/react/24/outline";
import { ArrowPathIcon } from "@heroicons/react/24/solid";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
}

export function MessageInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
}: MessageInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <form onSubmit={onSubmit} className="relative">
      <div className="flex items-center gap-2 overflow-hidden rounded-full bg-gray-800 px-4 py-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf"
          multiple
        />
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center p-1 text-white transition-colors hover:text-gray-300"
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Send a message..."
          disabled={isLoading}
          className="h-10 flex-1 bg-transparent text-sm text-white placeholder:text-gray-400 focus:outline-none"
        />
        <Button
          type="submit"
          disabled={!value.trim() || isLoading}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUpIcon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </form>
  );
}
