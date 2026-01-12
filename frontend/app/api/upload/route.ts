// app/api/upload/route.ts
import { indexConfig } from "@/constants/graphConfigs.ts";
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
 * POST handler for file uploads
 */
export async function POST(request: NextRequest) {
  try {
    // Extract file from FormData
    const formData = await request.formData();
    const file = extractFileFromFormData(formData);

    // Validate file
    const validation = validateFile(file);
    if (!validation.isValid) {
      return createErrorResponse(
        validation.errors[0] || "Validation failed",
        400,
        validation.errors.join("; "),
      );
    }

    // Convert file to base64
    const pdfFile = await convertFileToBase64(file!);

    // Run the upload graph
    const client = getServerLangGraphClient();
    const thread = await client.threads.create({});
    await client.runs.create(thread.thread_id, "upload_graph", {
      input: {
        pdfFile,
      },
      config: {
        configurable: {
          ...indexConfig,
        },
      },
    });

    return NextResponse.json({
      message: "Document uploaded successfully",
      threadId: thread.thread_id,
    });
  } catch (error: any) {
    return createErrorResponse(
      "Failed to process file",
      500,
      error.message || "Unknown error",
    );
  }
}
