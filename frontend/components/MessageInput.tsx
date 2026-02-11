"use client";

import { useRef, forwardRef, useImperativeHandle, useState, useEffect } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { ArrowUpIcon, PaperClipIcon, DocumentTextIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { StopIcon } from "@heroicons/react/24/solid";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop?: () => void | Promise<void>;
  onFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onAddTextClick?: () => void;
  isLoading?: boolean;
  isUploading?: boolean;
  /** When false, input is disabled (e.g. waiting for connection). Submit is blocked when false. */
  disabled?: boolean;
  isEditing?: boolean;
  onCancelEdit?: () => void;
}

export interface MessageInputRef {
  focus: () => void;
}

export const MessageInput = forwardRef<MessageInputRef, MessageInputProps>(
  ({ value, onChange, onSubmit, onStop, onFileUpload, onAddTextClick, isLoading = false, isUploading = false, disabled = false, isEditing = false, onCancelEdit }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const handleDropdownMouseEnter = () => {
      if (isLoading) return;
      if (dropdownTimerRef.current) {
        clearTimeout(dropdownTimerRef.current);
        dropdownTimerRef.current = null;
      }
      setIsDropdownOpen(true);
    };

    const handleDropdownMouseLeave = () => {
      dropdownTimerRef.current = setTimeout(() => {
        setIsDropdownOpen(false);
      }, 150);
    };

    const handleUploadFilesClick = () => {
      fileInputRef.current?.click();
    };

    const handleAddTextClick = () => {
      onAddTextClick?.();
      setIsDropdownOpen(false);
    };

    useEffect(() => {
      if (isLoading) setIsDropdownOpen(false);
    }, [isLoading]);

    return (
      <form onSubmit={onSubmit} className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={onFileUpload}
          className="hidden"
        />
        <div className="relative flex items-center gap-3 rounded-2xl border border-gray-700/50 bg-gray-800/80 px-5 py-3.5 shadow-xl backdrop-blur-sm transition-all hover:border-gray-600/50 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20">
          {isEditing && onCancelEdit && (
            <Button
              type="button"
              onClick={onCancelEdit}
              disabled={isUploading}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs text-gray-400 transition-colors hover:bg-gray-700/50 hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Cancel edit"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Cancel
            </Button>
          )}
          <div
            className={`relative ${isLoading ? "pointer-events-none opacity-50" : ""}`}
            onMouseEnter={handleDropdownMouseEnter}
            onMouseLeave={handleDropdownMouseLeave}
          >
            <Button
              type="button"
              onClick={() => !isUploading && !isLoading && setIsDropdownOpen((prev) => !prev)}
              disabled={isUploading || isLoading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-all hover:bg-gray-700/50 hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-gray-400"
              aria-label="Add sources"
              aria-expanded={isDropdownOpen}
            >
              {isUploading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              ) : (
                <PaperClipIcon className="h-4 w-4" />
              )}
            </Button>
            {isDropdownOpen && !isUploading && !isLoading && (
              <div className="absolute bottom-full left-0 z-50 mb-2 min-w-[160px] rounded-xl border border-gray-700/50 bg-gray-800 py-1 shadow-xl">
                <button
                  type="button"
                  onClick={handleAddTextClick}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-200 transition-colors hover:bg-gray-700/50 hover:text-gray-100"
                >
                  <DocumentTextIcon className="h-4 w-4 shrink-0 text-gray-500" />
                  Add text
                </button>
                <button
                  type="button"
                  onClick={handleUploadFilesClick}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-200 transition-colors hover:bg-gray-700/50 hover:text-gray-100"
                >
                  <PaperClipIcon className="h-4 w-4 shrink-0 text-gray-500" />
                  Upload files
                </button>
              </div>
            )}
          </div>
          <Input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              isUploading
                ? "Uploading..."
                : isEditing
                  ? "Edit your message..."
                  : "Ask anything..."
            }
            disabled={isUploading}
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
