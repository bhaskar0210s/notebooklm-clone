import { createClient } from "@supabase/supabase-js";
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

/**
 * GET /api/documents?threadId=xxx
 * Fetches document metadata for a given thread from Supabase.
 * Returns file names (PDFs) and text sources for display above the input.
 */
export async function GET(request: NextRequest) {
  const threadId = request.nextUrl.searchParams.get("threadId");
  if (!threadId) {
    return NextResponse.json(
      { error: "threadId is required" },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query documents by thread_id column
    const { data: rows, error } = await supabase
      .from("documents")
      .select("content, metadata")
      .eq("thread_id", threadId);

    if (error) {
      console.error("[documents API] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    const files: DocumentSource[] = [];
    const textChunks: string[] = [];

    for (const row of rows || []) {
      const metadata = (row.metadata as Record<string, unknown>) || {};
      const source = metadata.source as string | undefined;
      const filename = metadata.filename as string | undefined;

      if (source === "user_text") {
        const content = (row.content as string) || "";
        if (content.trim()) textChunks.push(content);
      } else if (filename || (source && source !== "user_text")) {
        const name = filename || (typeof source === "string" ? source : "document.pdf");
        if (!files.some((f) => f.name === name)) {
          files.push({ type: "file", name });
        }
      }
    }

    // Combine text chunks (from same paste, split by RecursiveCharacterTextSplitter)
    const combinedText =
      textChunks.length > 0 ? textChunks.join("\n\n") : "";
    const textSources: TextSource[] = combinedText
      ? [{ type: "text" as const, id: "loaded-text-0", text: combinedText }]
      : [];

    return NextResponse.json({
      files,
      textSources,
    } satisfies DocumentsResponse);
  } catch (err) {
    console.error("[documents API] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents?threadId=xxx&type=text
 * DELETE /api/documents?threadId=xxx&type=file&filename=doc.pdf
 * Deletes documents from Supabase for the given thread.
 */
export async function DELETE(request: NextRequest) {
  const threadId = request.nextUrl.searchParams.get("threadId");
  const type = request.nextUrl.searchParams.get("type"); // "text" | "file"
  const filename = request.nextUrl.searchParams.get("filename");

  if (!threadId) {
    return NextResponse.json(
      { error: "threadId is required" },
      { status: 400 }
    );
  }
  if (!type || (type !== "text" && type !== "file")) {
    return NextResponse.json(
      { error: "type must be 'text' or 'file'" },
      { status: 400 }
    );
  }
  if (type === "file" && !filename) {
    return NextResponse.json(
      { error: "filename is required when type is 'file'" },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: rows, error: selectError } = await supabase
      .from("documents")
      .select("id, metadata")
      .eq("thread_id", threadId);

    if (selectError) {
      console.error("[documents API] Delete select error:", selectError);
      return NextResponse.json(
        { error: "Failed to delete documents" },
        { status: 500 }
      );
    }

    const metadata = (row: { metadata?: unknown }) =>
      (row.metadata as Record<string, unknown>) || {};
    const ids = (rows || [])
      .filter((r) => {
        const m = metadata(r);
        if (type === "text") return m.source === "user_text";
        if (type === "file" && filename) return m.filename === filename;
        return false;
      })
      .map((r) => r.id)
      .filter((id): id is number => id != null);

    if (ids.length === 0) {
      return NextResponse.json({ success: true });
    }

    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .in("id", ids);

    if (deleteError) {
      console.error("[documents API] Delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete documents" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[documents API] Delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete documents" },
      { status: 500 }
    );
  }
}
