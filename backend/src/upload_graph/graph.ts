/**
 * This graph exposes an endpoint for a user to upload docs to be indexed.
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { Document } from "@langchain/core/documents";
import { RunnableConfig } from "@langchain/core/runnables";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { randomUUID } from "crypto";
import {
  makeSupabaseClient,
  makeSupabaseVectorStore,
} from "../shared/retrieval.ts";
import {
  BaseConfigurationAnnotation,
  ensureBaseConfiguration,
} from "../shared/configuration.ts";
import { processPDFFromBase64, type PDFFileData } from "../shared/pdf.ts";

// Constants
const GRAPH_RUN_NAME = "uploadGraph";

type IndexOperation = "upload" | "list" | "delete";
type DeleteType = "text" | "file" | "";

interface DocumentSource {
  type: "file";
  name: string;
}

interface TextSource {
  type: "text";
  id: string;
  text: string;
}

interface DocumentsResponse {
  files: DocumentSource[];
  textSources: TextSource[];
  success?: boolean;
}

interface SupabaseDocumentRow {
  id: number | string | null;
  content: string | null;
  metadata: Record<string, unknown> | null;
}

function emptyDocumentsResponse(): DocumentsResponse {
  return {
    files: [],
    textSources: [],
  };
}

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
   * Stable identifier for text uploads so they can be managed individually.
   */
  textId: Annotation<string>({
    default: () => "",
    reducer: (_existing, incoming) => incoming || "",
  }),
  /**
   * Thread ID for document scoping (per-chat documents in Supabase).
   */
  threadId: Annotation<string>({
    default: () => "",
    reducer: (existing, incoming) => incoming || existing,
  }),
  /**
   * Operation to run for this graph invocation.
   */
  operation: Annotation<IndexOperation>({
    default: () => "upload",
    reducer: (_existing, incoming) => incoming || "upload",
  }),
  /**
   * Delete operation type when operation="delete".
   */
  deleteType: Annotation<DeleteType>({
    default: () => "",
    reducer: (_existing, incoming) => incoming || "",
  }),
  /**
   * File name to delete when deleteType="file".
   */
  filename: Annotation<string>({
    default: () => "",
    reducer: (_existing, incoming) => incoming || "",
  }),
  /**
   * Document listing and delete operation response.
   */
  documentsResponse: Annotation<DocumentsResponse>({
    default: () => emptyDocumentsResponse(),
    reducer: (_existing, incoming) => incoming || emptyDocumentsResponse(),
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

function getThreadIdFromState(
  state: typeof IndexStateAnnotation.State,
  config?: RunnableConfig
): string {
  const stateThreadId = state.threadId && state.threadId.trim();
  const configThreadId = (config?.configurable as Record<string, unknown>)
    ?.thread_id as string | undefined;
  const threadId = stateThreadId || configThreadId;

  if (!threadId) {
    throw new Error("threadId is required");
  }

  return threadId;
}

async function checkOperation(
  state: typeof IndexStateAnnotation.State
): Promise<{ operation: IndexOperation }> {
  const normalized = state.operation?.toString().trim().toLowerCase();

  if (normalized === "list" || normalized === "delete") {
    return { operation: normalized };
  }

  return { operation: "upload" };
}

async function routeIndexOperation(
  state: typeof IndexStateAnnotation.State
): Promise<"uploadDocs" | "manageDocuments"> {
  if (state.operation === "list" || state.operation === "delete") {
    return "manageDocuments";
  }
  return "uploadDocs";
}

async function manageDocuments(
  state: typeof IndexStateAnnotation.State,
  config?: RunnableConfig
): Promise<typeof IndexStateAnnotation.Update> {
  // Keep config validation consistent with other graph operations.
  if (config) {
    ensureBaseConfiguration(config);
  }

  const threadId = getThreadIdFromState(state, config);
  const supabase = makeSupabaseClient();
  const operation = state.operation;

  const { data: rows, error: selectError } = await supabase
    .from("documents")
    .select("id, content, metadata")
    .eq("thread_id", threadId);

  if (selectError) {
    throw new Error("Failed to fetch documents");
  }

  const normalizedRows = (rows || []) as SupabaseDocumentRow[];

  if (operation === "list") {
    const files: DocumentSource[] = [];
    const textSourceChunks = new Map<string, string[]>();

    for (const row of normalizedRows) {
      const metadata = row.metadata || {};
      const source =
        typeof metadata.source === "string" ? metadata.source : undefined;
      const filename =
        typeof metadata.filename === "string" ? metadata.filename : undefined;

      if (source === "user_text") {
        const content = row.content || "";
        if (content.trim()) {
          const sourceTextId =
            typeof metadata.text_id === "string" && metadata.text_id.trim()
              ? metadata.text_id.trim()
              : "legacy-user-text";

          if (!textSourceChunks.has(sourceTextId)) {
            textSourceChunks.set(sourceTextId, []);
          }

          const chunksForSource = textSourceChunks.get(sourceTextId);
          if (chunksForSource) {
            chunksForSource.push(content);
          }
        }
      } else if (filename || (source && source !== "user_text")) {
        const name = filename || source || "document.pdf";
        if (!files.some((file) => file.name === name)) {
          files.push({ type: "file", name });
        }
      }
    }

    const textSources: TextSource[] = Array.from(textSourceChunks.entries()).map(
      ([id, chunks]) => ({
        type: "text",
        id,
        text: chunks.join("\n\n"),
      })
    );

    return {
      documentsResponse: {
        files,
        textSources,
      },
    };
  }

  if (operation === "delete") {
    const deleteType = state.deleteType;
    const filename = state.filename?.trim();
    const textId = state.textId?.trim();

    if (deleteType !== "text" && deleteType !== "file") {
      throw new Error("deleteType must be 'text' or 'file'");
    }
    if (deleteType === "file" && !filename) {
      throw new Error("filename is required when deleteType is 'file'");
    }

    const ids = normalizedRows
      .filter((row) => {
        const metadata = row.metadata || {};
        if (deleteType === "text") {
          if (metadata.source !== "user_text") {
            return false;
          }

          if (!textId) {
            return true;
          }

          return metadata.text_id === textId;
        }
        return metadata.filename === filename;
      })
      .map((row) => row.id)
      .filter((id): id is number | string => id !== null && id !== undefined);

    if (ids.length > 0) {
      const { error: deleteError } = await supabase
        .from("documents")
        .delete()
        .in("id", ids);

      if (deleteError) {
        throw new Error("Failed to delete documents");
      }
    }

    return {
      documentsResponse: {
        ...emptyDocumentsResponse(),
        success: true,
      },
    };
  }

  throw new Error(`Unsupported operation: ${operation}`);
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
  const threadId = getThreadIdFromState(state, config);

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
    const textId = state.textId?.trim() || randomUUID();
    const textMetadata = {
      source: "user_text",
      text_id: textId,
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
    chunkSize: 1500,
    chunkOverlap: 200,
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
  .addNode("checkOperation", checkOperation)
  .addNode("uploadDocs", uploadDocs)
  .addNode("manageDocuments", manageDocuments)
  .addEdge(START, "checkOperation")
  .addConditionalEdges("checkOperation", routeIndexOperation, [
    "uploadDocs",
    "manageDocuments",
  ])
  .addEdge("uploadDocs", END)
  .addEdge("manageDocuments", END);

export const graph = uploadGraphBuilder.compile().withConfig({
  runName: GRAPH_RUN_NAME,
});
