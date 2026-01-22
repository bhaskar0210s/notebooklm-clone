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
        console.log(
          `[uploadDocs] Adding batch ${batchNum}/${totalBatches} (${batch.length} documents)`
        );
        // Log the embeddings here.
        const embeddings = await vectorStore.embeddings.embedDocuments(
          batch.map((doc) => doc.pageContent)
        );
        console.log("[uploadDocs] Embeddings completed", embeddings.length);

        await vectorStore.addVectors(
          embeddings,
          batch,
          batch.map((doc) => doc.metadata || {})
        );
        success = true;
        console.log(`[uploadDocs] Successfully added batch documents)`);
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
          console.log(
            `[uploadDocs] Rate limit hit (batch ${batchNum}). Retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})...`
          );
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

  // Validate PDF file is provided
  if (!state.pdfFile || !state.pdfFile.content || !state.pdfFile.filename) {
    throw new Error("No PDF file provided.");
  }

  console.log(`[uploadDocs] Processing PDF: ${state.pdfFile.filename}`);

  // Process PDF file
  let docs: Document[];
  try {
    docs = await processPDFFromBase64(state.pdfFile);
    console.log(`[uploadDocs] Extracted ${docs.length} document(s) from PDF`);
  } catch (error: any) {
    console.error(`[uploadDocs] Error processing PDF:`, error);
    throw new Error(
      `Failed to process PDF ${state.pdfFile.filename}: ${
        error.message || error
      }`
    );
  }

  if (!docs || docs.length === 0) {
    throw new Error("No content extracted from PDF file.");
  }

  // Chunk documents to stay well within embedding model context limits
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 8000,
    chunkOverlap: 1200,
  });
  const splitDocs = await splitter.splitDocuments(docs);
  console.log(`[uploadDocs] Split into ${splitDocs.length} chunk(s)`);

  try {
    const vectorStore = await makeSupabaseVectorStore(config);
    console.log(
      `[uploadDocs] Adding ${splitDocs.length} document(s) to vector store...`
    );

    // Add documents with retry logic and batching to handle rate limits
    await addDocumentsWithRetry(vectorStore, splitDocs);

    console.log(
      `[uploadDocs] Successfully added ${splitDocs.length} document(s) to Supabase`
    );
  } catch (error: any) {
    console.error(
      `[uploadDocs] Error adding documents to vector store:`,
      error
    );
    throw new Error(
      `Failed to add documents to vector store: ${error.message || error}`
    );
  }

  return { pdfFile: { filename: "", content: "", mimeType: "" } };
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
