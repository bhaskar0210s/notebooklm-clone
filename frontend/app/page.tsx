"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { MessageInput, type MessageInputRef } from "@/components/MessageInput.tsx";
import { Messages } from "@/components/Messages.tsx";
import { FilePreview } from "@/components/file-preview.tsx";
import { TextSourcePreview } from "@/components/TextSourcePreview.tsx";
import { AddTextModal } from "@/components/AddTextModal.tsx";
import { Sidebar } from "@/components/Sidebar.tsx";
import { useChat } from "@/hooks/useChat.ts";
import { useChatHistory } from "@/hooks/useChatHistory.ts";
import { toast } from "sonner";

export default function Home() {
  const {
    chatSessions,
    currentSessionId,
    setCurrentSessionId,
    saveSession,
    addUploadSession,
    deleteSession,
    getSession,
  } = useChatHistory();

  const {
    messages,
    input,
    setInput,
    isLoading,
    connectionStatus,
    threadId,
    handleSubmit,
    submitMessage,
    retryLastMessage,
    editAndResubmitMessage,
    stop,
    newChat,
    loadSession,
  } = useChat();

  const inputRef = useRef<MessageInputRef>(null);
  const wasAddTextModalOpen = useRef(false);
  const [files, setFiles] = useState<File[]>([]);
  const [textSources, setTextSources] = useState<
    Array<{ id: string; text: string; readOnly?: boolean }>
  >([]);
  const [loadedFileNames, setLoadedFileNames] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAddTextModalOpen, setIsAddTextModalOpen] = useState(false);
  const [editingTextSourceId, setEditingTextSourceId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);

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

  // Restore focus to message input when Add Text modal closes (fixes input not working after save)
  useEffect(() => {
    if (wasAddTextModalOpen.current && !isAddTextModalOpen) {
      const timeoutId = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timeoutId);
    }
    wasAddTextModalOpen.current = isAddTextModalOpen;
  }, [isAddTextModalOpen]);

  // Save messages to chat history whenever they change
  useEffect(() => {
    if (threadId && messages.length > 0) {
      saveSession(threadId, messages);
      setCurrentSessionId(threadId);
    }
  }, [threadId, messages, saveSession, setCurrentSessionId]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length === 0) return;

      setIsUploading(true);
      try {
        const formData = new FormData();
        selectedFiles.forEach((file) => {
          formData.append("files", file);
        });
        if (threadId) {
          formData.append("threadId", threadId);
        }

        console.log("[handleFileUpload] Sending request:", {
          fileCount: selectedFiles.length,
          threadId: threadId ?? "(null/undefined)",
        });

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to upload files");
        }

        setFiles((prev) => [...prev, ...selectedFiles]);
        toast.success(
          `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} uploaded successfully`,
        );

        // If upload created a new thread, add to recents and switch to it
        const uploadedThreadId = data.threadId as string | undefined;
        if (uploadedThreadId && uploadedThreadId !== threadId) {
          const fileNames = selectedFiles.map((f) => f.name).join(", ");
          addUploadSession(
            uploadedThreadId,
            fileNames.length > 28 ? `${fileNames.slice(0, 25)}...` : fileNames,
          );
          loadSession(uploadedThreadId, []);
          setCurrentSessionId(uploadedThreadId);
          setFiles([]); // Clear - files are now in the new thread's context
        }
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
    },
    [threadId, addUploadSession, loadSession, setCurrentSessionId],
  );

  const handleRemoveFile = useCallback((fileToRemove: File) => {
    setFiles((prev) => prev.filter((file) => file !== fileToRemove));
    toast.success(`${fileToRemove.name} has been removed`);
  }, []);

  const handleRemoveLoadedFile = useCallback(
    async (nameToRemove: string) => {
      if (!threadId) return;
      try {
        const res = await fetch(
          `/api/documents?threadId=${encodeURIComponent(threadId)}&type=file&filename=${encodeURIComponent(nameToRemove)}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Failed to delete");
        setLoadedFileNames((prev) => prev.filter((n) => n !== nameToRemove));
        toast.success(`${nameToRemove} has been removed`);
      } catch {
        toast.error("Failed to remove file");
      }
    },
    [threadId]
  );

  const handleTextUpload = useCallback(
    async (text: string) => {
      setIsUploading(true);
      try {
        const isEditingLoaded =
          editingTextSourceId &&
          textSources.find((s) => s.id === editingTextSourceId)?.readOnly;

        if (isEditingLoaded && threadId) {
          const delRes = await fetch(
            `/api/documents?threadId=${encodeURIComponent(threadId)}&type=text`,
            { method: "DELETE" }
          );
          if (!delRes.ok) throw new Error("Failed to remove old text");
        }

        const body: { text: string; threadId?: string } = { text };
        if (threadId) body.threadId = threadId;

        const response = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to add text");
        }

        if (editingTextSourceId) {
          setTextSources((prev) =>
            prev.map((s) => (s.id === editingTextSourceId ? { ...s, text, readOnly: false } : s)),
          );
          toast.success("Text updated successfully");
        } else {
          setTextSources((prev) => [...prev, { id: crypto.randomUUID(), text }]);
          toast.success("Text added successfully");
        }

        const uploadedThreadId = data.threadId as string | undefined;
        if (uploadedThreadId && uploadedThreadId !== threadId) {
          addUploadSession(uploadedThreadId, "Added text");
          loadSession(uploadedThreadId, []);
          setCurrentSessionId(uploadedThreadId);
          setTextSources([]);
        }
      } catch (error) {
        toast.error(
          `Failed to add text. ${error instanceof Error ? error.message : "Please try again."}`,
        );
      } finally {
        setIsUploading(false);
        setIsAddTextModalOpen(false);
        setEditingTextSourceId(null);
      }
    },
    [threadId, editingTextSourceId, textSources, addUploadSession, loadSession, setCurrentSessionId],
  );

  const handleRemoveTextSource = useCallback(
    async (idToRemove: string) => {
      const source = textSources.find((t) => t.id === idToRemove);
      const isLoaded = source?.readOnly;

      if (isLoaded && threadId) {
        try {
          const res = await fetch(
            `/api/documents?threadId=${encodeURIComponent(threadId)}&type=text`,
            { method: "DELETE" }
          );
          if (!res.ok) throw new Error("Failed to delete");
        } catch {
          toast.error("Failed to remove text source");
          return;
        }
      }

      setTextSources((prev) => prev.filter((t) => t.id !== idToRemove));
      if (editingTextSourceId === idToRemove) {
        setEditingTextSourceId(null);
        setIsAddTextModalOpen(false);
      }
      toast.success("Text source removed");
    },
    [editingTextSourceId, textSources, threadId]
  );

  const handleEditTextSource = useCallback((source: { id: string; text: string }) => {
    setEditingTextSourceId(source.id);
    setIsAddTextModalOpen(true);
  }, []);

  const handleNewChat = useCallback(async () => {
    setEditingMessageIndex(null);
    setFiles([]);
    setTextSources([]);
    setLoadedFileNames([]);
    await newChat();
    setCurrentSessionId(null);
    // Focus input after new chat is created
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [newChat, setCurrentSessionId]);

  const handleSelectChat = useCallback(
    async (selectedThreadId: string) => {
      setEditingMessageIndex(null);
      setFiles([]);
      setTextSources([]);
      setLoadedFileNames([]);
      const session = getSession(selectedThreadId);
      if (session) {
        loadSession(session.threadId, session.messages);
        setCurrentSessionId(session.threadId);
        try {
          const res = await fetch(
            `/api/documents?threadId=${encodeURIComponent(session.threadId)}`
          );
          if (res.ok) {
            const data = await res.json();
            setLoadedFileNames((data.files ?? []).map((f: { name: string }) => f.name));
            setTextSources(
              (data.textSources ?? []).map((s: { id: string; text: string }) => ({
                id: s.id,
                text: s.text,
                readOnly: true,
              }))
            );
          }
        } catch {
          // Silently ignore - sources may not exist for this thread
        }
      }
    },
    [getSession, loadSession, setCurrentSessionId],
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

  const handleEditPrompt = (messageIndex: number, content: string) => {
    setInput(content);
    setEditingMessageIndex(messageIndex);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleCancelEdit = () => {
    setInput("");
    setEditingMessageIndex(null);
  };

  const handleSubmitWithEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMessageIndex !== null) {
      await editAndResubmitMessage(editingMessageIndex, input);
      setEditingMessageIndex(null);
    } else {
      await handleSubmit(e);
    }
  };

  return (
    <>
      <AddTextModal
        isOpen={isAddTextModalOpen}
        onClose={() => {
          setIsAddTextModalOpen(false);
          setEditingTextSourceId(null);
        }}
        onSave={handleTextUpload}
        isSaving={isUploading}
        initialText={
          editingTextSourceId
            ? textSources.find((s) => s.id === editingTextSourceId)?.text ?? ""
            : ""
        }
      />
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
          <Messages
            messages={messages}
            isLoading={isLoading}
            onExamplePromptClick={submitMessage}
            onRetry={retryLastMessage}
            onEditPrompt={handleEditPrompt}
          />
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-10 bg-linear-to-t from-gray-950 via-gray-950/95 to-transparent pb-6 pt-12">
          <div className="mx-auto max-w-4xl px-4 space-y-4">
            {(files.length > 0 || loadedFileNames.length > 0 || textSources.length > 0) && (
              <div className="scrollbar-thin max-h-[180px] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {files.map((file, index) => (
                  <FilePreview
                    key={`file-${file.name}-${index}`}
                    file={file}
                    onRemove={() => handleRemoveFile(file)}
                  />
                ))}
                {loadedFileNames.map((name, index) => (
                  <FilePreview
                    key={`loaded-${name}-${index}`}
                    file={{ name }}
                    onRemove={() => handleRemoveLoadedFile(name)}
                  />
                ))}
                {textSources.map((source) => (
                  <TextSourcePreview
                    key={source.id}
                    preview={source.text.slice(0, 80)}
                    onRemove={() => handleRemoveTextSource(source.id)}
                    onEdit={() => handleEditTextSource(source)}
                  />
                ))}
                </div>
              </div>
            )}
            <MessageInput
              ref={inputRef}
              value={input}
              onChange={setInput}
              onSubmit={handleSubmitWithEdit}
              onStop={stop}
              onFileUpload={handleFileUpload}
              onAddTextClick={() => {
                setEditingTextSourceId(null);
                setIsAddTextModalOpen(true);
              }}
              isLoading={isLoading}
              isUploading={isUploading}
              disabled={!isConnected}
              isEditing={editingMessageIndex !== null}
              onCancelEdit={handleCancelEdit}
            />
          </div>
        </div>
      </main>
    </>
  );
}
