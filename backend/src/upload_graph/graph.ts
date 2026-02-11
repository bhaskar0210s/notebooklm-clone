/**
 * This graph exposes an endpoint for a user to upload docs to be indexed.
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { Document } from "@langchain/core/documents";
import { RunnableConfig } from "@langchain/core/runnables";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { makeSupabaseVectorStore } from "../shared/retrieval.ts";
import {
  BaseConfigurationAnnotation,
  ensureBaseConfiguration,
} from "../shared/configuration.ts";
import { processPDFFromBase64, type PDFFileData } from "../shared/pdf.ts";

// Constants
const GRAPH_RUN_NAME = "uploadGraph";

// State Annotations
const IndexStateAnnotation = Annotation.Root({
  /**
   * PDF file to be processed (base64 encoded).
   */
  pdfFile: Annotation<PDFFileData>({
    default: () => ({
      filename: "",
      content: "",
      mimeType: "application/pdf",
    }),
    reducer: (existing, incoming) => incoming || existing,
  }),
  /**
   * Raw text content to be indexed (alternative to PDF).
   */
  textContent: Annotation<string>({
    default: () => "",
    reducer: (existing, incoming) => incoming || existing,
  }),
  /**
   * Thread ID for document scoping (per-chat documents in Supabase).
   */
  threadId: Annotation<string>({
    default: () => "",
    reducer: (existing, incoming) => incoming || existing,
  }),
});

const IndexConfigurationAnnotation = Annotation.Root({
  ...BaseConfigurationAnnotation.spec,
});

/**
 * Helper function to add documents with retry logic and batching to handle rate limits
 */
async function addDocumentsWithRetry(
  vectorStore: any,
  documents: Document[],
  batchSize: number = 20,
  maxRetries: number = 3,
  initialDelay: number = 100
): Promise<void> {
  // Process documents in batches to avoid rate limits
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(documents.length / batchSize);

    let retryCount = 0;
    let delay = initialDelay;
    let success = false;

    while (retryCount <= maxRetries && !success) {
      try {
        const embeddings = await vectorStore.embeddings.embedDocuments(
          batch.map((doc) => doc.pageContent)
        );

        await vectorStore.addVectors(
          embeddings,
          batch,
          batch.map((doc) => doc.metadata || {})
        );
        success = true;
      } catch (error: any) {
        // Check for rate limit errors in multiple places (error might be nested)
        const errorCode =
          error?.code ||
          error?.response?.status ||
          error?.status ||
          error?.cause?.code ||
          "unknown";
        const errorMessage = error?.message || error?.cause?.message || "";
        const isRateLimit =
          errorCode === 429 ||
          errorMessage.includes("429") ||
          errorMessage.includes("rateLimitExceeded") ||
          errorMessage.includes("Quota exceeded") ||
          errorMessage.includes("RESOURCE_EXHAUSTED") ||
          error?.error?.code === 429 ||
          error?.error?.status === "RESOURCE_EXHAUSTED";

        if (isRateLimit && retryCount < maxRetries) {
          retryCount++;
          await new Promise((resolve) => setTimeout(resolve, delay));
          // Exponential backoff with jitter
          // delay = Math.min(delay * 2 + Math.random() * 1000, 30000);
        } else {
          throw error;
        }
      }
    }

    if (!success) {
      throw new Error(
        `Failed to add batch ${batchNum} after ${maxRetries} retries`
      );
    }

    // Add a small delay between batches to avoid hitting rate limits
    if (i + batchSize < documents.length) {
      const interBatchDelay = 500; // 500ms between batches
      await new Promise((resolve) => setTimeout(resolve, interBatchDelay));
    }
  }
}

// Node Functions
async function uploadDocs(
  state: typeof IndexStateAnnotation.State,
  config?: RunnableConfig
): Promise<typeof IndexStateAnnotation.Update> {
  if (!config) {
    throw new Error("Configuration required to run uploadDocs.");
  }

  // Ensure base configuration is valid
  ensureBaseConfiguration(config);

  const hasPdf =
    state.pdfFile && state.pdfFile.content && state.pdfFile.filename;
  const hasText = state.textContent && state.textContent.trim().length > 0;

  if (!hasPdf && !hasText) {
    throw new Error("Either a PDF file or text content must be provided.");
  }

  let docs: Document[];

  // Get thread_id from state (input) first, then config - ensures it's always available for Supabase
  const stateThreadId = state.threadId && state.threadId.trim();
  const configThreadId = (config.configurable as Record<string, unknown>)
    ?.thread_id as string | undefined;
  const threadId = stateThreadId || configThreadId;

  if (hasPdf) {
    // Process PDF file
    try {
      docs = await processPDFFromBase64(state.pdfFile!);
    } catch (error: any) {
      console.error(`[uploadDocs] Error processing PDF:`, error);
      throw new Error(
        `Failed to process PDF ${state.pdfFile!.filename}: ${
          error.message || error
        }`
      );
    }
  } else {
    // Process text content
    const textMetadata = {
      source: "user_text",
      ...(threadId && { thread_id: threadId }),
    };
    docs = [
      new Document({
        pageContent: state.textContent!.trim(),
        metadata: textMetadata,
      }),
    ];
  }

  if (!docs || docs.length === 0) {
    throw new Error("No content to index.");
  }

  // Chunk documents to stay well within embedding model context limits
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 8000,
    chunkOverlap: 1200,
  });
  const splitDocs = await splitter.splitDocuments(docs);

  // Add thread_id to all document metadata for per-chat scoping
  if (threadId) {
    splitDocs.forEach((doc) => {
      doc.metadata = { ...doc.metadata, thread_id: threadId };
    });
  }

  try {
    const vectorStore = await makeSupabaseVectorStore(config);

    // Add documents with retry logic and batching to handle rate limits
    await addDocumentsWithRetry(vectorStore, splitDocs);
  } catch (error: any) {
    console.error(
      `[uploadDocs] Error adding documents to vector store:`,
      error
    );
    throw new Error(
      `Failed to add documents to vector store: ${error.message || error}`
    );
  }

  return {
    pdfFile: { filename: "", content: "", mimeType: "" },
    textContent: "",
  };
}

// Graph Builder
const uploadGraphBuilder = new StateGraph(
  IndexStateAnnotation,
  IndexConfigurationAnnotation
)
  .addNode("uploadDocs", uploadDocs)
  .addEdge(START, "uploadDocs")
  .addEdge("uploadDocs", END);

export const graph = uploadGraphBuilder.compile().withConfig({
  runName: GRAPH_RUN_NAME,
});
