'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusIcon, ArrowUpIcon } from '@heroicons/react/24/outline';
import { ArrowPathIcon } from '@heroicons/react/24/solid';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
}

export function MessageInput({ value, onChange, onSubmit, isLoading = false }: MessageInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <form onSubmit={onSubmit} className="relative">
      <div className="flex items-center gap-2 rounded-full overflow-hidden bg-gray-800 px-4 py-2">
        <input ref={fileInputRef} type="file" className="hidden" accept=".pdf" multiple />
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center text-white hover:text-gray-300 transition-colors p-1"
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Send a message..."
          disabled={isLoading}
          className="flex-1 bg-transparent text-white placeholder:text-gray-400 focus:outline-none h-10 text-sm"
        />
        <Button
          type="submit"
          disabled={!value.trim() || isLoading}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-black hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <ArrowUpIcon className="h-4 w-4" />}
        </Button>
      </div>
    </form>
  );
}
