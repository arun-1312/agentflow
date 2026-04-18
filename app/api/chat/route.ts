/**
 * app/api/chat/route.ts
 *
 * POST /api/chat
 * Supports multipart form with goal + files (txt, md, pdf, docx)
 */

import { NextRequest } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { getSupervisorGraph } from "@/lib/langgraph/supervisor";
import { addDocuments } from "@/lib/rag/vector-store";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import crypto from "node:crypto";

// --- NEW IMPORTS FOR FILE PARSING ---
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import * as mammoth from "mammoth";

export const runtime = "nodejs";

type ParsedRequest = { goal: string; files: File[] };

async function parseChatRequest(req: NextRequest): Promise<ParsedRequest> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await req.json();
    return { goal: (body.goal ?? "").trim(), files: [] };
  }

  // Multipart form data (with files)
  const form = await req.formData();
  const goal = String(form.get("goal") ?? "").trim();
  const files = form.getAll("files").filter((v): v is File => v instanceof File);

  return { goal, files };
}

async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  // --- TXT and MD ---
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return Buffer.from(arrayBuffer).toString("utf-8").trim();
  }

  // --- PDF ---
  if (name.endsWith(".pdf")) {
    try {
      // Convert standard File to web-friendly Blob
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      const loader = new WebPDFLoader(blob);
      const docs = await loader.load();
      // Combine all extracted pages into a single string
      return docs.map(doc => doc.pageContent).join("\n\n");
    } catch (error) {
      console.error("PDF Parsing Error:", error);
      throw new Error(`Failed to parse PDF document: ${file.name}`);
    }
  }

  // --- DOCX ---
  if (name.endsWith(".docx")) {
    try {
      // Mammoth extracts raw text directly from the Word buffer flawlessly
      const buffer = Buffer.from(arrayBuffer);
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
    } catch (error) {
      console.error("DOCX Parsing Error:", error);
      throw new Error(`Failed to parse Word document: ${file.name}`);
    }
  }

  // Fallback for any other file types
  return Buffer.from(arrayBuffer).toString("utf-8").trim();
}

export async function POST(req: NextRequest) {
  let goal: string;
  let files: File[] = [];

  try {
    const parsed = await parseChatRequest(req);
    goal = parsed.goal;
    files = parsed.files;

    if (!goal) {
      return Response.json({ error: "No goal provided." }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  // Quick Ollama health check
  try {
    const ping = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(3000),
    });
    if (!ping.ok) throw new Error();
  } catch {
    return new Response(
      "⚠️ Could not reach Ollama.\n\nMake sure Ollama is running and qwen2.5:7b is pulled.",
      { status: 503 }
    );
  }

  const encoder = new TextEncoder();

  const outputStream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          closed = true;
        }
      };

      try {
        const graph = getSupervisorGraph();
        const ragCollection = crypto.randomUUID();

        // Process uploaded files (Phase 3 RAG)
        if (files.length > 0) {
          send("§AGENT:researcher§Processing documents...\n\n");

          const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 900,
            chunkOverlap: 150,
          });

          const rawDocs: Document[] = [];

          for (const file of files) {
            try {
              const text = await extractTextFromFile(file);
              if (text) {
                rawDocs.push(
                  new Document({
                    pageContent: text,
                    metadata: { source: file.name },
                  })
                );
              }
            } catch (err: any) {
              send(`⚠️ ${err.message}\n\n`);
              // Continue with other files instead of failing completely
            }
          }

          if (rawDocs.length > 0) {
            const chunks = await splitter.splitDocuments(rawDocs);
            await addDocuments(ragCollection, chunks);
          }
        }

        // Run the full LangGraph workflow
        const stream = await graph.stream(
          { messages: [new HumanMessage(goal)], goal, ragCollection },
          { streamMode: "custom", signal: req.signal }
        );

        for await (const chunk of stream) {
          const text = typeof chunk === "string" ? chunk : "";
          if (text) send(text);
        }
      } catch (err: any) {
        console.error("[/api/chat] Error:", err);
        send(`\n⚠️ Workflow error: ${err.message || "Unknown error"}`);
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(outputStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
    },
  });
}