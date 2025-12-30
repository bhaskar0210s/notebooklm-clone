import React, { useRef, useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { toast } from "sonner";
import { DocumentDuplicateIcon, CheckIcon } from "@heroicons/react/24/outline";
import type { Message } from "@/types/chat";

interface MessagesProps {
  messages: Message[];
  isLoading: boolean;
  onExamplePromptClick?: (prompt: string) => void;
}

const EXAMPLE_PROMPTS = [
  "What are the main topics discussed in the documents?",
  "Explain quantum computing in simple terms",
];

export function Messages({ messages, isLoading, onExamplePromptClick }: MessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const lastScrollTopRef = useRef<number>(0);
  const previousMessageCountRef = useRef<number>(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = useCallback(async (text: string, messageIndex: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(messageIndex);
      toast.success("Message copied to clipboard");
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      toast.error("Failed to copy message");
    }
  }, []);

  // Check if user is at the bottom of the page
  const isAtBottom = useCallback(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const distanceFromBottom = documentHeight - (scrollTop + windowHeight);
    // Consider at bottom if within 5px (accounting for rounding)
    return distanceFromBottom <= 5;
  }, []);

  // Initialize scroll position on mount
  useEffect(() => {
    lastScrollTopRef.current = window.pageYOffset || document.documentElement.scrollTop;
  }, []);

  // Handle scroll events to detect when user scrolls up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const previousScrollTop = lastScrollTopRef.current;
      
      // Calculate how much the user scrolled (positive = scrolled up, negative = scrolled down)
      const scrollDelta = previousScrollTop - currentScrollTop;

      // If user scrolled up at all (any upward movement), disable auto-scroll
      if (scrollDelta > 0) {
        setShouldAutoScroll(false);
      }
      
      // If user scrolls back down to bottom, re-enable auto-scroll
      if (isAtBottom()) {
        setShouldAutoScroll(true);
      }

      lastScrollTopRef.current = currentScrollTop;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isAtBottom]);

  // Re-enable auto-scroll when loading completes or new user message is submitted
  useEffect(() => {
    const currentMessageCount = messages.length;
    const previousMessageCount = previousMessageCountRef.current;

    // Check if a new user message was added (new message count increased)
    const hasNewUserMessage =
      currentMessageCount > previousMessageCount &&
      messages[currentMessageCount - 1]?.role === "user";

    // Re-enable auto-scroll when:
    // 1. Loading completes (streaming finished)
    // 2. A new user message is submitted
    if (!isLoading || hasNewUserMessage) {
      setShouldAutoScroll(true);
    }

    previousMessageCountRef.current = currentMessageCount;
  }, [messages, isLoading]);

  // Auto-scroll when messages change, but only if shouldAutoScroll is true
  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, shouldAutoScroll]);

  if (messages.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <div className="text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/20">
            <svg
              className="h-8 w-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h1 className="mb-3 bg-linear-to-r from-gray-100 to-gray-300 bg-clip-text text-5xl font-bold text-transparent">
            NotebookLM Clone
          </h1>
          {onExamplePromptClick && (
            <div className="mx-auto max-w-2xl">
              <h2 className="mb-4 text-sm font-semibold text-gray-400">
                Try these example prompts
              </h2>
              <div className="space-y-3">
                {EXAMPLE_PROMPTS.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => onExamplePromptClick(prompt)}
                  disabled={isLoading}
                  className="w-full rounded-xl border border-gray-700/50 bg-gray-800/50 px-5 py-3.5 text-left text-sm text-gray-300 transition-all hover:border-gray-600/50 hover:bg-gray-800/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-700/50 disabled:hover:bg-gray-800/50"
                >
                  {prompt}
                </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 py-8">
      {messages.map((message, messageIndex) => (
        <div
          key={messageIndex}
          className={`flex w-full ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`group relative max-w-[80%] md:max-w-[75%] ${
              message.role === "user" ? "ml-auto" : "mr-auto"
            }`}
          >
            <div
              className={`relative rounded-2xl px-5 py-3 shadow-lg transition-all ${
                message.role === "user"
                  ? "bg-linear-to-br from-blue-600 to-blue-700 text-white shadow-blue-500/20"
                  : "bg-gray-800/80 backdrop-blur-sm text-gray-100 shadow-gray-900/50 border border-gray-700/50"
              }`}
            >
              <div className="max-w-none">
                {message.content ? (
                  <div className="m-0 whitespace-pre-wrap wrap-break-word leading-tight">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                      p: ({ children }) => {
                        // Filter out empty paragraphs
                        const text = typeof children === 'string' ? children : 
                          (Array.isArray(children) ? children.join('') : String(children));
                        if (!text || text.trim() === '') return null;
                        return <p className="m-0 leading-tight">{children}</p>;
                      },
                      strong: ({ children }) => (
                        <strong className="font-semibold">{children}</strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic">{children}</em>
                      ),
                      ul: ({ children }) => (
                        <ul className="m-0 ml-4 list-disc space-y-0 leading-tight">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="m-0 ml-4 list-decimal space-y-0 leading-tight">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="ml-2 leading-tight">{children}</li>
                      ),
                      h1: ({ children }) => (
                        <h1 className="m-0 text-xl font-bold">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="m-0 text-lg font-bold">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="m-0 text-base font-semibold">
                          {children}
                        </h3>
                      ),
                      code: ({ children, className, ...props }) => {
                        const match = /language-(\w+)/.exec(className || "");
                        const language = match ? match[1] : "";
                        const isInline = !className || !language;
                        
                        if (isInline) {
                          return (
                            <code className="rounded bg-gray-700/50 px-1 py-0.5 text-sm font-mono">
                              {children}
                            </code>
                          );
                        }
                        
                        // For code blocks with language, render SyntaxHighlighter directly
                        // ReactMarkdown will wrap this in <pre>, so we handle that in pre component
                        return (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children, ...props }) => {
                        // ReactMarkdown wraps code blocks in <pre><code className="language-xxx">
                        const childArray = React.Children.toArray(children);
                        // Find code element - ReactMarkdown passes code blocks with className containing "language-"
                        const codeChild = childArray.find(
                          (child) => {
                            if (!React.isValidElement(child)) return false;
                            const props = child.props as { className?: string; node?: any };
                            // Check if it has a language- className (code blocks) or is a code element
                            return /language-/.test(props.className || "") || child.type === "code" || String(child.type) === "code";
                          }
                        ) as React.ReactElement<{ className?: string; children?: React.ReactNode; node?: any }> | undefined;
                        
                        if (codeChild) {
                          const codeProps = codeChild.props as { className?: string; children?: React.ReactNode; node?: any };
                          const match = /language-(\w+)/.exec(codeProps.className || "");
                          const language = match ? match[1] : "";
                          
                          if (language) {
                            // ReactMarkdown passes content via 'node.value' or 'children'
                            const codeContent = codeProps.children 
                              ? String(codeProps.children).replace(/\n$/, "")
                              : (codeProps.node?.value || "").replace(/\n$/, "");
                            return (
                              <SyntaxHighlighter
                                language={language}
                                style={vscDarkPlus}
                                PreTag="div"
                                className="m-0 rounded-lg"
                                customStyle={{
                                  margin: 0,
                                  padding: "0.75rem",
                                  background: "rgba(17, 24, 39, 0.5)",
                                }}
                              >
                                {codeContent}
                              </SyntaxHighlighter>
                            );
                          }
                        }
                        
                        return (
                          <pre className="m-0 overflow-x-auto rounded-lg bg-gray-900/50 p-3" {...props}>
                            {children}
                          </pre>
                        );
                      },
                      blockquote: ({ children }) => (
                        <blockquote className="m-0 border-l-4 border-gray-600 pl-4 italic">
                          {children}
                        </blockquote>
                      ),
                      hr: () => (
                        <hr className="m-0 border-gray-700" />
                      ),
                    }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5 py-1">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
                    <div className="h-2 w-2 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                    <div className="h-2 w-2 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
                  </div>
                )}
              </div>
            </div>
            {/* Copy button - appears below message on hover */}
            <div
              className={`mt-1 flex transition-opacity opacity-0 group-hover:opacity-100 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <button
                onClick={() => copyToClipboard(message.content, messageIndex)}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  message.role === "user"
                    ? "text-gray-400 hover:text-gray-300"
                    : "text-gray-500 hover:text-gray-400"
                }`}
                title="Copy message"
                aria-label="Copy message"
              >
                {copiedIndex === messageIndex ? (
                  <CheckIcon className="h-3.5 w-3.5" />
                ) : (
                  <DocumentDuplicateIcon className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
