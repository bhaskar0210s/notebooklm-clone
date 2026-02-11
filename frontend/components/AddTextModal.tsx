"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button.tsx";
import { DocumentTextIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon } from "@heroicons/react/24/outline";

interface AddTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (text: string) => void | Promise<void>;
  isSaving?: boolean;
  /** When provided, pre-fills the textarea for editing */
  initialText?: string;
}

export function AddTextModal({
  isOpen,
  onClose,
  onSave,
  isSaving = false,
  initialText = "",
}: AddTextModalProps) {
  const [text, setText] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setText(initialText);
    }
  }, [isOpen, initialText]);

  // Auto-grow textarea height so the wrapper handles scrolling (fixes scroll dead zones)
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.max(ta.scrollHeight, 80)}px`;
  }, [text]);

  // Handle Escape at document level so it doesn't interfere with textarea editing (Ctrl/Cmd+C, Ctrl/Cmd+V, etc.)
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [isOpen, onClose]);

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await onSave(trimmed);
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        // Only close on direct backdrop click, not when releasing after resizing textarea
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative mx-4 w-full max-w-lg rounded-2xl border border-gray-700/50 bg-gray-900 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-gray-700/50 px-6 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/20">
            <DocumentTextIcon className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-100">
              {initialText ? "Edit text" : "Add text"}
            </h2>
            <p className="text-sm text-gray-500">
              {initialText
                ? "Edit your text and save to update"
                : "Paste or type text to add to your sources"}
            </p>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-1.5">
            <div
              className={`scrollbar-thin cursor-text overflow-y-auto rounded-xl border border-gray-700/50 bg-gray-800/80 transition-[min-height,max-height] duration-200 ease-out ${
                isExpanded ? "min-h-[400px] max-h-[60vh]" : "min-h-[200px] max-h-[280px]"
              }`}
              onClick={() => textareaRef.current?.focus()}
            >
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter your text here..."
                className="min-h-[80px] w-full resize-none overflow-hidden rounded-xl border-0 bg-transparent px-4 py-3 text-gray-100 placeholder:text-gray-500 outline-none selection:bg-blue-500/30"
                rows={1}
                autoFocus
                disabled={isSaving}
                spellCheck
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                disabled={isSaving}
                className="flex h-6 items-center gap-1 rounded px-2 text-[11px] text-gray-500 transition-colors hover:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <ArrowsPointingInIcon className="h-3 w-3" />
                ) : (
                  <ArrowsPointingOutIcon className="h-3 w-3" />
                )}
                <span>{isExpanded ? "Collapse" : "Expand"}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-700/50 px-6 py-4">
          <Button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl bg-gray-700/50 px-4 py-2 text-gray-300 transition-colors hover:bg-gray-700 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!text.trim() || isSaving}
            className="rounded-xl bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
                  Saving...
                </span>
              ) : (
                "Save"
              )}
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}
