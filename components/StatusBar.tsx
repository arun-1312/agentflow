"use client";

import { Check, CircleDashed, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBarProps {
  status: "idle" | "thinking" | "streaming" | "done";
  activeAgent?: string | null;
}

const AGENTS = [
  { id: "researcher", label: "Researcher (RAG Extraction)" },
  { id: "critic",     label: "Critic (Quality Review)" },
  { id: "writer",     label: "Writer (Drafting Report)" },
  { id: "editor",     label: "Editor (Final Polish)" },
];

export default function StatusBar({ status, activeAgent }: StatusBarProps) {
  const isThinking  = status === "thinking";
  const isStreaming = status === "streaming";
  const isDone      = status === "done";
  const isActive    = isThinking || isStreaming;

  if (status === "idle") return null;

  const activeIdx = AGENTS.findIndex(a => a.id === activeAgent);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Top Status Header */}
      <div className="flex items-center gap-2.5">
        {isActive ? (
          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
        ) : isDone ? (
          <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Check className="w-3 h-3 text-emerald-400" />
          </div>
        ) : null}

        <span className="text-[14px] font-semibold text-white tracking-wide">
          {isThinking
            ? "Initializing Agent Pipeline..."
            : isStreaming
            ? activeAgent
              ? `${activeAgent.charAt(0).toUpperCase() + activeAgent.slice(1)} is working...`
              : "Agents are thinking..."
            : "Workflow Completed"}
        </span>
      </div>

      {/* Vertical Timeline Steps */}
      <div className="relative flex flex-col gap-3 pl-1.5 pt-1">
        {/* Connecting Vertical Line */}
        <div className="absolute left-[11px] top-3 bottom-4 w-px bg-white/5" />

        {AGENTS.map((agent, i) => {
          // If we haven't hit the first agent yet, but it's thinking, index is -1
          const isCompleted = isDone || (isActive && activeIdx > i);
          const isCurrent   = isActive && activeIdx === i;
          const isPending   = !isCompleted && !isCurrent;

          return (
            <div key={agent.id} className="relative z-10 flex items-center gap-4 group">
              {/* Timeline Node */}
              <div
                className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center border transition-all duration-300",
                  isCompleted
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : isCurrent
                    ? "bg-cyan-500/20 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)] animate-pulse"
                    : "bg-[#09090b] border-white/10"
                )}
              >
                {isCompleted ? (
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                ) : isCurrent ? (
                  <CircleDashed className="w-2.5 h-2.5 text-cyan-400 animate-[spin_3s_linear_infinite]" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                )}
              </div>

              {/* Agent Label */}
              <span
                className={cn(
                  "text-[12px] font-mono tracking-tight transition-all duration-300",
                  isCompleted
                    ? "text-[#8a8a8a]"
                    : isCurrent
                    ? "text-cyan-50 font-medium"
                    : "text-[#555]"
                )}
              >
                {agent.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}