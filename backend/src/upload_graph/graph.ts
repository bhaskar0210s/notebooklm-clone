/**
 * This graph exposes an endpoint for a user to upload docs to be indexed.
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { Document } from "@langchain/core/documents";
import { RunnableConfig } from "@langchain/core/runnables";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { makeRetriever } from "../shared/retrieval.ts";
import {
  BaseConfigurationAnnotation,
  ensureBaseConfiguration,
} from "../shared/configuration.ts";
import { processPDFFromBase64, type PDFFileData } from "../shared/pdf.ts";

// Constants
const GRAPH_RUN_NAME = "uploadionGraph";

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

  // Process PDF file
  let docs: Document[];
  try {
    docs = await processPDFFromBase64(state.pdfFile);
  } catch (error: any) {
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
    chunkSize: 800,
    chunkOverlap: 120,
  });
  const splitDocs = await splitter.splitDocuments(docs);

  const retriever = await makeRetriever(config);
  await retriever.addDocuments(splitDocs);

  return { pdfFile: { filename: "", content: "", mimeType: "" } };
}

// Graph Builder
const uploadionGraphBuilder = new StateGraph(
  IndexStateAnnotation,
  IndexConfigurationAnnotation
)
  .addNode("uploadDocs", uploadDocs)
  .addEdge(START, "uploadDocs")
  .addEdge("uploadDocs", END);

export const graph = uploadionGraphBuilder.compile().withConfig({
  runName: GRAPH_RUN_NAME,
});
