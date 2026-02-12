import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "@langchain/core/documents";
import fs from "fs/promises";
import os from "os";
import path from "path";

/**
 * Interface for PDF file data received from frontend
 */
export interface PDFFileData {
  filename: string;
  content: string; // base64 encoded PDF
  mimeType: string;
}

/**
 * Processes a PDF file from base64 string by parsing it into Document objects.
 * @param pdfData - The PDF file data with base64 content.
 * @returns An array of Document objects extracted from the PDF.
 */
export async function processPDFFromBase64(
  pdfData: PDFFileData
): Promise<Document[]> {
  // Decode base64 to buffer
  const buffer = Buffer.from(pdfData.content, "base64");

  // Create temporary directory and file
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-"));
  // Sanitize filename to prevent path traversal (e.g. ../../../etc/passwd)
  const safeFilename = path.basename(pdfData.filename) || "document.pdf";
  const tempFilePath = path.join(tempDir, safeFilename);

  try {
    // Write buffer to temporary file
    await fs.writeFile(tempFilePath, buffer);

    // Load PDF using PDFLoader
    const loader = new PDFLoader(tempFilePath);
    const docs = await loader.load();

    // Add filename to metadata for each document
    docs.forEach((doc) => {
      doc.metadata.filename = pdfData.filename;
    });

    return docs;
  } finally {
    // Clean up temporary files
    await fs.unlink(tempFilePath).catch(() => {});
    await fs.rmdir(tempDir).catch(() => {});
  }
}
