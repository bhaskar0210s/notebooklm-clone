import { Document } from "@langchain/core/documents";

/**
 * Formats documents by joining their content with double newlines.
 */
export function formatDocs(docs?: Document[]): string {
  if (!docs || docs.length === 0) {
    return "";
  }
  return docs.map((doc) => doc.pageContent).join("\n\n");
}
