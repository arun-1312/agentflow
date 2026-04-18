"use client";

import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowUp, StopCircle, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

const EXAMPLE_GOALS = [
  "Research AI tools for 2027 placements",
  "Analyze market trends for EV",
  "Study plan for system design",
];

interface WorkflowFormProps {
  onStream: (reader: ReadableStreamDefaultReader<Uint8Array>) => void;
  onStatusChange: (status: "idle" | "thinking" | "streaming" | "done") => void;
  onReset: () => void;
  status: "idle" | "thinking" | "streaming" | "done";
  onGoalSubmit?: (goal: string) => void;
}

export default function WorkflowForm({
  onStream,
  onStatusChange,
  onReset,
  status,
  onGoalSubmit,
}: WorkflowFormProps) {
  const [goal, setGoal] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isRunning = status === "thinking" || status === "streaming";

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.max(50, scrollHeight) + 'px';
    }
  }, [goal]);

  const handleGoalChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setGoal(e.target.value);
  };

  const acceptExt = [".pdf", ".txt", ".md", ".docx"];

  const addFiles = (incoming: File[]) => {
    const filtered = incoming.filter((f) => {
      const name = f.name?.toLowerCase?.() ?? "";
      return acceptExt.some((ext) => name.endsWith(ext));
    });
    setFiles((prev) => {
      const next = [...prev];
      for (const f of filtered) {
        if (!next.some((p) => p.name === f.name && p.size === f.size && p.lastModified === f.lastModified)) {
          next.push(f);
        }
      }
      return next;
    });
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const submitForm = async (textToSubmit: string) => {
    if (!textToSubmit.trim() || isRunning) return;

    onReset();
    onStatusChange("thinking");
    setGoal(textToSubmit);
    onGoalSubmit?.(textToSubmit.trim());

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const form = new FormData();
      form.set("goal", textToSubmit.trim());
      for (const f of files) form.append("files", f, f.name);

      const res = await fetch("/api/chat", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      onStatusChange("streaming");

      const reader = res.body.getReader();
      onStream(reader);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[WorkflowForm] fetch error:", err);
      onStatusChange("done");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitForm(goal);
  };

  const handleExampleClick = (example: string) => {
    setGoal(example);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    onStatusChange("done");
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Form Container */}
      <form onSubmit={handleSubmit} className="relative flex flex-col w-full group">
        <div className="relative w-full rounded-2xl bg-white/[0.02] backdrop-blur-sm border border-white/10 shadow-2xl transition-all duration-300 focus-within:border-cyan-500/50 focus-within:ring-4 focus-within:ring-cyan-500/10 overflow-hidden flex flex-col p-4">
          
          {/* Upload Documents Zone */}
          <div
            className={cn(
              "mb-4 rounded-xl border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-colors p-4",
              isRunning && "opacity-50 pointer-events-none"
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (isRunning) return;
              addFiles(Array.from(e.dataTransfer.files ?? []));
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <Upload className="w-4 h-4 text-[#8a8a8a]" />
                </div>
                <div className="flex flex-col">
                  <div className="text-[13px] font-medium text-[#ededed]">
                    Upload Documents
                  </div>
                  <div className="text-[11px] text-[#666]">
                    Drag & drop or browse ({acceptExt.join(", ")})
                  </div>
                </div>
              </div>

              <label className="text-[12px] font-medium px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-[#ededed] transition-colors hover:bg-white/10 hover:text-white cursor-pointer">
                Browse
                <input
                  type="file"
                  multiple
                  accept={acceptExt.join(",")}
                  className="hidden"
                  disabled={isRunning}
                  onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
                />
              </label>
            </div>

            {/* Attached Files List */}
            {files.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                {files.map((f, idx) => (
                  <div
                    key={`${f.name}-${f.size}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#000000]/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-[12px] text-cyan-50 truncate">{f.name}</div>
                      <div className="text-[10px] text-[#666] font-mono mt-0.5">
                        {(f.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      disabled={isRunning}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-[#777] hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Text Input */}
          <Textarea
            ref={textareaRef}
            value={goal}
            onChange={handleGoalChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your goal here..."
            className="min-h-[60px] max-h-[300px] w-full resize-none bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-1 text-[15px] leading-relaxed text-[#ededed] placeholder:text-white/20"
            disabled={isRunning}
            aria-label="Workflow goal input"
          />
          
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
            <div className="text-[11px] text-[#555] font-mono">
              Press Enter to send
            </div>
            
            {/* Submit / Stop Button */}
            <div className="flex items-center gap-2">
              {isRunning ? (
                <Button
                  type="button"
                  onClick={handleStop}
                  className="w-9 h-9 rounded-full p-0 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all"
                  title="Stop Generation"
                >
                  <StopCircle className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!goal.trim()}
                  className="w-9 h-9 rounded-full p-0 flex items-center justify-center transition-all bg-[#ededed] hover:bg-white text-black disabled:opacity-20 disabled:bg-white/10 disabled:text-white/40 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                  title="Send message"
                >
                  <ArrowUp className="w-4 h-4" strokeWidth={3} />
                </Button>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Examples - Monospace terminal tags */}
      {status === "idle" && (
        <div className="flex items-center flex-wrap gap-2 px-1">
          {EXAMPLE_GOALS.map((eg) => (
            <button
              key={eg}
              onClick={() => handleExampleClick(eg)}
              className="px-3 py-1.5 rounded-full border border-white/10 bg-transparent text-[#8a8a8a] text-[11px] font-mono transition-all hover:border-cyan-400/50 hover:text-cyan-400 hover:bg-cyan-400/5"
            >
              {eg}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}