// app/api/upload/route.ts
import {
  indexConfig,
  retrievalAssistantId,
} from "@/constants/graphConfigs.ts";
import { getServerLangGraphClient } from "@/lib/langgraph.ts";
import { NextRequest, NextResponse } from "next/server";

// Configuration constants - 2MB limit as per notes.md
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_FILE_TYPES = ["application/pdf"];

/**
 * Interface for PDF file data to send to backend
 */
interface PDFFileData {
  filename: string;
  content: string; // base64 encoded PDF
  mimeType: string;
}

/**
 * Validation result structure
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Extracts single file from FormData
 */
function extractFileFromFormData(formData: FormData): File | null {
  for (const [key, value] of formData.entries()) {
    if (key === "file" && value instanceof File) {
      return value;
    }
    // Also support "files" key for backward compatibility
    if (key === "files" && value instanceof File) {
      return value;
    }
  }
  return null;
}

/**
 * Validates uploaded file
 */
function validateFile(file: File | null): ValidationResult {
  const errors: string[] = [];

  if (!file) {
    errors.push("No file provided");
    return { isValid: false, errors };
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    errors.push("Only PDF files are allowed");
  }
  if (file.size > MAX_FILE_SIZE) {
    errors.push(
      `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Converts File object to base64 encoded PDF file data
 */
async function convertFileToBase64(file: File): Promise<PDFFileData> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const buffer = Buffer.from(uint8Array);
    const base64Content = buffer.toString("base64");

    return {
      filename: file.name,
      content: base64Content,
      mimeType: file.type,
    };
  } catch (error: any) {
    throw new Error(
      `Failed to convert file ${file.name} to base64: ${error.message || error}`,
    );
  }
}

/**
 * Creates a standardized error response
 */
function createErrorResponse(
  error: string,
  status: number,
  details?: string,
): NextResponse {
  return NextResponse.json(
    {
      error,
      ...(details && { details }),
    },
    { status },
  );
}

/**
 * POST handler for file uploads and text uploads
 * Accepts either:
 * - multipart/form-data with "files" or "file" (PDF)
 * - application/json with { text: string }
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let input: {
      pdfFile?: PDFFileData;
      textContent?: string;
      threadId?: string;
    };

    if (contentType.includes("application/json")) {
      // Text upload
      const body = await request.json();
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      const existingThreadId =
        typeof body?.threadId === "string" ? body.threadId : undefined;

      if (!text) {
        return createErrorResponse("Text content is required", 400);
      }

      // Use existing thread if provided, else create new
      const client = getServerLangGraphClient();
      const thread = existingThreadId
        ? { thread_id: existingThreadId }
        : await client.threads.create({
            graphId: retrievalAssistantId,
          });

      // Pass threadId in input as well as config - ensures it reaches Supabase
      input = {
        textContent: text,
        threadId: thread.thread_id,
      };

      const run = await client.runs.create(thread.thread_id, "upload_graph", {
        input,
        config: {
          configurable: {
            ...indexConfig,
            thread_id: thread.thread_id,
          },
        },
      });

      // Poll for run completion
      let finalStatus: string = run.status;
      let attempts = 0;
      const maxAttempts = 150;
      const POLL_INTERVAL_MS = 2000;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      while (finalStatus === "pending" || finalStatus === "running") {
        if (attempts >= maxAttempts) {
          throw new Error("Upload timeout: The upload is taking too long");
        }
        try {
          const runStatus = await client.runs.get(thread.thread_id, run.run_id);
          finalStatus = runStatus.status || finalStatus;
          attempts++;
          if (
            finalStatus === "success" ||
            finalStatus === "failed" ||
            finalStatus === "cancelled"
          ) {
            break;
          }
        } catch (pollError: any) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error(
              `Failed to get run status: ${pollError || "Unknown error"}`,
            );
          }
        }
        if (finalStatus === "pending" || finalStatus === "running") {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      }

      if (finalStatus === "failed") {
        throw new Error("The upload graph failed to process the document");
      } else if (finalStatus === "cancelled") {
        throw new Error("The upload was cancelled");
      } else if (finalStatus !== "success") {
        throw new Error(
          `Upload did not complete successfully. Status: ${finalStatus}`,
        );
      }

      return NextResponse.json({
        message: "Text added successfully",
        threadId: thread.thread_id,
        runId: run.run_id,
      });
    } else {
      // File upload
      const formData = await request.formData();
      const file = extractFileFromFormData(formData);
      const existingThreadId = formData.get("threadId");
      const threadIdForUpload =
        typeof existingThreadId === "string" ? existingThreadId : undefined;

      const validation = validateFile(file);
      if (!validation.isValid) {
        return createErrorResponse(
          validation.errors[0] || "Validation failed",
          400,
          validation.errors.join("; "),
        );
      }

      const pdfFile = await convertFileToBase64(file!);

      // Use existing thread if provided, else create new
      const client = getServerLangGraphClient();
      const thread = threadIdForUpload
        ? { thread_id: threadIdForUpload }
        : await client.threads.create({
            graphId: retrievalAssistantId,
          });

      // Pass threadId in input as well as config - ensures it reaches Supabase
      input = {
        pdfFile,
        threadId: thread.thread_id,
      };

      const run = await client.runs.create(thread.thread_id, "upload_graph", {
        input,
        config: {
          configurable: {
            ...indexConfig,
            thread_id: thread.thread_id,
          },
        },
      });

      // Poll for run completion using runs.get() (correct API for checking existing run status)
      let finalStatus: string = run.status;
      let attempts = 0;
      const maxAttempts = 150; // 5 minutes max (2 seconds per attempt)
      const POLL_INTERVAL_MS = 2000; // 2 seconds between polls

      // Wait before first poll to avoid immediate request
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      while (finalStatus === "pending" || finalStatus === "running") {
        if (attempts >= maxAttempts) {
          throw new Error("Upload timeout: The upload is taking too long");
        }

        try {
          const runStatus = await client.runs.get(thread.thread_id, run.run_id);
          finalStatus = runStatus.status || finalStatus;
          attempts++;

          if (
            finalStatus === "success" ||
            finalStatus === "failed" ||
            finalStatus === "cancelled"
          ) {
            break;
          }
        } catch (pollError: any) {
          // If we can't get status, wait a bit and retry
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error(
              `Failed to get run status: ${pollError || "Unknown error"}`,
            );
          }
        }

        // Wait before next poll (only if still pending/running)
        if (finalStatus === "pending" || finalStatus === "running") {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      }

      if (finalStatus === "failed") {
        throw new Error("The upload graph failed to process the document");
      } else if (finalStatus === "cancelled") {
        throw new Error("The upload was cancelled");
      } else if (finalStatus !== "success") {
        throw new Error(
          `Upload did not complete successfully. Status: ${finalStatus}`,
        );
      }

      const successMessage = input.textContent
        ? "Text added successfully"
        : "Document uploaded successfully";

      return NextResponse.json({
        message: successMessage,
        threadId: thread.thread_id,
        runId: run.run_id,
      });
    }
  } catch (error: any) {
    return createErrorResponse(
      "Failed to process file",
      500,
      error.message || "Unknown error",
    );
  }
}
