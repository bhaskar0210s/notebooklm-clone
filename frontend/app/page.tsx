"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { MessageInput, type MessageInputRef } from "@/components/MessageInput.tsx";
import { Messages } from "@/components/Messages.tsx";
import { FilePreview } from "@/components/file-preview.tsx";
import { Sidebar } from "@/components/Sidebar.tsx";
import { useChat } from "@/hooks/useChat.ts";
import { useChatHistory } from "@/hooks/useChatHistory.ts";
import { toast } from "sonner";

export default function Home() {
  const {
    messages,
    input,
    setInput,
    isLoading,
    connectionStatus,
    threadId,
    handleSubmit,
    submitMessage,
    stop,
    newChat,
    loadSession,
  } = useChat();

  const {
    chatSessions,
    currentSessionId,
    setCurrentSessionId,
    saveSession,
    deleteSession,
    getSession,
  } = useChatHistory();

  const inputRef = useRef<MessageInputRef>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  // Save messages to chat history whenever they change
  useEffect(() => {
    if (threadId && messages.length > 0) {
      saveSession(threadId, messages);
      setCurrentSessionId(threadId);
    }
  }, [threadId, messages, saveSession, setCurrentSessionId]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload files");
      }

      setFiles((prev) => [...prev, ...selectedFiles]);
      toast.success(
        `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} uploaded successfully`,
      );
    } catch (error) {
      toast.error(
        `Failed to upload files. ${error instanceof Error ? error.message : "Please try again."}`,
      );
    } finally {
      setIsUploading(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  }, []);

  const handleRemoveFile = useCallback((fileToRemove: File) => {
    // todo: remove file from the database
    setFiles((prev) => prev.filter((file) => file !== fileToRemove));
    toast.success(`${fileToRemove.name} has been removed`);
  }, []);

  const handleNewChat = useCallback(async () => {
    await newChat();
    setCurrentSessionId(null);
    // Focus input after new chat is created
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [newChat, setCurrentSessionId]);

  const handleSelectChat = useCallback(
    (selectedThreadId: string) => {
      const session = getSession(selectedThreadId);
      if (session) {
        loadSession(session.threadId, session.messages);
        setCurrentSessionId(session.threadId);
      }
    },
    [getSession, loadSession, setCurrentSessionId]
  );

  const handleDeleteChat = useCallback(
    (threadIdToDelete: string) => {
      deleteSession(threadIdToDelete);
      // If deleting current chat, start a new one
      if (currentSessionId === threadIdToDelete) {
        handleNewChat();
      }
      toast.success("Chat deleted");
    },
    [deleteSession, currentSessionId, handleNewChat]
  );

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  return (
    <>
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        chatSessions={chatSessions}
        currentSessionId={currentSessionId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
      />

      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center p-4 pb-32 md:p-8 md:pb-36">
        <div className="w-full flex-1">
          <Messages messages={messages} isLoading={isLoading} onExamplePromptClick={submitMessage} />
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-10 bg-linear-to-t from-gray-950 via-gray-950/95 to-transparent pb-6 pt-12">
          <div className="mx-auto max-w-4xl px-4 space-y-4">
            {files.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {files.map((file, index) => (
                  <FilePreview
                    key={`${file.name}-${index}`}
                    file={file}
                    onRemove={() => handleRemoveFile(file)}
                  />
                ))}
              </div>
            )}
            <MessageInput
              ref={inputRef}
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              onStop={stop}
              onFileUpload={handleFileUpload}
              isLoading={isLoading}
              isUploading={isUploading}
              disabled={!isConnected}
            />
          </div>
        </div>
      </main>
    </>
  );
}

