// app/api/upload/route.ts
import {
  indexConfig,
  retrievalAssistantId,
} from "@/constants/graphConfigs.ts";
import { getServerLangGraphClient } from "@/lib/langgraph.ts";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Configuration constants - 2MB limit as per notes.md
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_FILE_TYPES = ["application/pdf"];
const MAX_TEXT_LENGTH = 20_000;
const MAX_ID_LENGTH = 200;
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150;
const PDF_SIGNATURE = "%PDF-";

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

interface UploadGraphInput extends Record<string, unknown> {
  pdfFile?: PDFFileData;
  textContent?: string;
  threadId?: string;
  textId?: string;
}

function isSupportedUploadContentType(contentType: string): boolean {
  return (
    contentType.includes("application/json") ||
    contentType.includes("multipart/form-data")
  );
}

function toOptionalId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
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
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    errors.push("Only .pdf files are allowed");
  }
  if (file.size <= 0) {
    errors.push("File is empty");
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

function isPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < PDF_SIGNATURE.length) return false;
  return buffer.subarray(0, PDF_SIGNATURE.length).toString("utf8") === PDF_SIGNATURE;
}

/**
 * Converts File object to base64 encoded PDF file data
 */
async function convertFileToBase64(file: File): Promise<PDFFileData> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const buffer = Buffer.from(uint8Array);

    if (!isPdfBuffer(buffer)) {
      throw new Error("Invalid PDF file contents");
    }

    const base64Content = buffer.toString("base64");

    return {
      filename: file.name,
      content: base64Content,
      mimeType: file.type,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to convert file ${file.name} to base64: ${message}`,
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

async function waitForRunCompletion(
  client: ReturnType<typeof getServerLangGraphClient>,
  threadId: string,
  runId: string,
  initialStatus: string,
): Promise<void> {
  let finalStatus: string = initialStatus;
  let attempts = 0;
  await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

  while (finalStatus === "pending" || finalStatus === "running") {
    if (attempts >= MAX_POLL_ATTEMPTS) {
      throw new Error("Upload timeout: The upload is taking too long");
    }

    attempts++;

    try {
      const runStatus = await client.runs.get(threadId, runId);
      finalStatus = runStatus.status || finalStatus;
    } catch {
      if (attempts >= MAX_POLL_ATTEMPTS) {
        throw new Error("Failed to get upload status");
      }
    }

    if (finalStatus === "pending" || finalStatus === "running") {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  if (finalStatus === "failed") {
    throw new Error("The upload graph failed to process the document");
  }
  if (finalStatus === "cancelled") {
    throw new Error("The upload was cancelled");
  }
  if (finalStatus !== "success") {
    throw new Error(`Upload did not complete successfully. Status: ${finalStatus}`);
  }
}

/**
 * POST handler for file uploads and text uploads
 * Accepts either:
 * - multipart/form-data with "files" or "file" (PDF)
 * - application/json with { text: string, threadId?: string, textId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (!isSupportedUploadContentType(contentType)) {
      return createErrorResponse("Unsupported content type", 415);
    }

    let input: UploadGraphInput;
    const client = getServerLangGraphClient();

    if (contentType.includes("application/json")) {
      // Text upload
      const body = await request.json();
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      const existingThreadId = toOptionalId(body?.threadId);
      const incomingTextId = toOptionalId(body?.textId);

      if (!text) {
        return createErrorResponse("Text content is required", 400);
      }
      if (text.length > MAX_TEXT_LENGTH) {
        return createErrorResponse(
          `Text content must be <= ${MAX_TEXT_LENGTH} characters`,
          400,
        );
      }
      if (existingThreadId && existingThreadId.length > MAX_ID_LENGTH) {
        return createErrorResponse("Invalid threadId", 400);
      }
      if (incomingTextId && incomingTextId.length > MAX_ID_LENGTH) {
        return createErrorResponse("Invalid textId", 400);
      }

      const textId = incomingTextId || crypto.randomUUID();

      // Use existing thread if provided, else create new
      const thread = existingThreadId
        ? { thread_id: existingThreadId }
        : await client.threads.create({
            graphId: retrievalAssistantId,
          });

      // Pass threadId in input as well as config - ensures it reaches Supabase
      input = {
        textContent: text,
        threadId: thread.thread_id,
        textId,
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

      await waitForRunCompletion(client, thread.thread_id, run.run_id, run.status);

      return NextResponse.json({
        message: "Text added successfully",
        threadId: thread.thread_id,
        runId: run.run_id,
        textId,
      });
    } else {
      // File upload
      const formData = await request.formData();
      const file = extractFileFromFormData(formData);
      const existingThreadId = formData.get("threadId");
      const threadIdForUpload =
        typeof existingThreadId === "string" ? existingThreadId.trim() : undefined;

      if (threadIdForUpload && threadIdForUpload.length > MAX_ID_LENGTH) {
        return createErrorResponse("Invalid threadId", 400);
      }

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

      await waitForRunCompletion(client, thread.thread_id, run.run_id, run.status);

      return NextResponse.json({
        message: "Document uploaded successfully",
        threadId: thread.thread_id,
        runId: run.run_id,
      });
    }
  } catch (error) {
    console.error("[upload API] Error:", error);
    return createErrorResponse("Failed to process upload", 500);
  }
}
