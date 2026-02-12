import { indexConfig } from "@/constants/graphConfigs.ts";
import { getServerLangGraphClient } from "@/lib/langgraph.ts";
import { NextRequest, NextResponse } from "next/server";

export interface DocumentSource {
  type: "file";
  name: string;
}

export interface TextSource {
  type: "text";
  id: string;
  text: string;
}

export interface DocumentsResponse {
  files: DocumentSource[];
  textSources: TextSource[];
}

interface UploadGraphDocumentsResponse {
  files?: DocumentSource[];
  textSources?: TextSource[];
  success?: boolean;
}

interface UploadGraphValues {
  documentsResponse?: UploadGraphDocumentsResponse;
}

type DocumentsOperationInput =
  | {
      operation: "list";
      threadId: string;
    }
  | {
      operation: "delete";
      threadId: string;
      deleteType: "text" | "file";
      filename?: string;
    };

async function runDocumentsOperation(input: DocumentsOperationInput) {
  const client = getServerLangGraphClient();
  return client.runs.wait(null, "upload_graph", {
    input,
    config: {
      configurable: {
        ...indexConfig,
        thread_id: input.threadId,
      },
    },
  });
}

function normalizeDocumentsResponse(values: unknown): DocumentsResponse {
  const response = (values as UploadGraphValues | null)?.documentsResponse;
  return {
    files: Array.isArray(response?.files) ? response.files : [],
    textSources: Array.isArray(response?.textSources) ? response.textSources : [],
  };
}

/**
 * GET /api/documents?threadId=xxx
 * Fetches document metadata for a given thread from backend.
 */
export async function GET(request: NextRequest) {
  const threadId = request.nextUrl.searchParams.get("threadId");
  if (!threadId) {
    return NextResponse.json(
      { error: "threadId is required" },
      { status: 400 },
    );
  }

  try {
    const values = await runDocumentsOperation({
      operation: "list",
      threadId,
    });

    return NextResponse.json(
      normalizeDocumentsResponse(values) satisfies DocumentsResponse,
    );
  } catch (err) {
    console.error("[documents API] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/documents?threadId=xxx&type=text
 * DELETE /api/documents?threadId=xxx&type=file&filename=doc.pdf
 * Deletes documents via backend service for the given thread.
 */
export async function DELETE(request: NextRequest) {
  const threadId = request.nextUrl.searchParams.get("threadId");
  const type = request.nextUrl.searchParams.get("type");
  const filename = request.nextUrl.searchParams.get("filename");

  if (!threadId) {
    return NextResponse.json(
      { error: "threadId is required" },
      { status: 400 },
    );
  }
  if (!type || (type !== "text" && type !== "file")) {
    return NextResponse.json(
      { error: "type must be 'text' or 'file'" },
      { status: 400 },
    );
  }
  if (type === "file" && !filename) {
    return NextResponse.json(
      { error: "filename is required when type is 'file'" },
      { status: 400 },
    );
  }

  try {
    const values = await runDocumentsOperation({
      operation: "delete",
      threadId,
      deleteType: type,
      ...(filename ? { filename } : {}),
    });

    const response = (values as UploadGraphValues | null)?.documentsResponse;
    if (response?.success === false) {
      throw new Error("Delete operation failed");
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[documents API] Delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete documents" },
      { status: 500 },
    );
  }
}
