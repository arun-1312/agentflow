"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Copy, Download, Loader2, CheckCheck, ChevronDown, ChevronRight, Search, FlaskConical, PenLine, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResponseAreaProps {
  content: string;
  isStreaming: boolean;
  status: "idle" | "thinking" | "streaming" | "done";
}

// Agent config
const AGENT_CONFIG: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  researcher: { label: "Researcher", Icon: Search, color: "text-blue-400" },
  critic:     { label: "Critic", Icon: FlaskConical, color: "text-amber-400" },
  writer:     { label: "Writer", Icon: PenLine, color: "text-violet-400" },
  editor:     { label: "Final Polish", Icon: Sparkles, color: "text-cyan-400" },
};

// Markdown renderer
function renderMarkdown(text: string, isFinalAnswer: boolean = false): React.ReactNode[] {
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    if (line.trim() === "") return <div key={idx} className={isFinalAnswer ? "h-4" : "h-2"} />;

    if (/^\d+\.\s/.test(line)) {
      const [, num, rest] = line.match(/^(\d+)\.\s(.*)/) ?? ["", "", line];
      return (
        <div key={idx} className={cn("flex gap-3 mt-3 leading-relaxed", isFinalAnswer ? "text-[15px]" : "text-[13px]")}>
          <span className="text-cyan-400 font-mono font-medium shrink-0 text-right select-none w-6">{num}.</span>
          <span className="text-white/80">{rest}</span>
        </div>
      );
    }

    return (
      <div key={idx} className={cn("leading-relaxed text-white/70", isFinalAnswer ? "text-[15px]" : "text-[13px]")}>
        {line}
      </div>
    );
  });
}

// Parse blocks
interface AgentBlock {
  agent: string;
  content: string;
  done: boolean;
}

const AGENT_DELIM_RE = /§AGENT:(\w+)§|§DONE§/g;

function parseAgentBlocks(raw: string): AgentBlock[] {
  if (!raw) return [];
  const blocks: AgentBlock[] = [];
  let lastIndex = 0;
  let currentAgent: string | null = null;

  const matches = [...raw.matchAll(AGENT_DELIM_RE)];

  for (const match of matches) {
    const before = raw.slice(lastIndex, match.index).trim();
    if (currentAgent && before) {
      blocks.push({ agent: currentAgent, content: before, done: true });
      currentAgent = null;
    }
    lastIndex = (match.index ?? 0) + match[0].length;

    if (match[0] === "§DONE§") currentAgent = null;
    else currentAgent = match[1];
  }

  if (currentAgent) {
    const tail = raw.slice(lastIndex).trim();
    blocks.push({ agent: currentAgent, content: tail, done: false });
  }
  return blocks;
}

export default function ResponseArea({ content, isStreaming, status }: ResponseAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  const blocks = useMemo(() => parseAgentBlocks(content), [content]);
  const traceBlocks = useMemo(() => blocks.filter(b => b.agent !== "editor"), [blocks]);
  const editorBlock = blocks.find(b => b.agent === "editor");

  const activeAgent = useMemo(() => {
    const last = traceBlocks[traceBlocks.length - 1];
    return last && !last.done ? last.agent : null;
  }, [traceBlocks]);

  // Auto-expand currently active agent
  useEffect(() => {
    if (activeAgent) {
      setExpandedAgents(prev => {
        const newSet = new Set(prev);
        newSet.add(activeAgent);
        return newSet;
      });
    }
  }, [activeAgent]);

  useEffect(() => {
    if (isStreaming) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [content, isStreaming]);

  const toggleExpand = (agent: string) => {
    setExpandedAgents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(agent)) newSet.delete(agent);
      else newSet.add(agent);
      return newSet;
    });
  };

  const handleCopy = () => {
    const text = editorBlock?.content ?? content;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadPdf = async () => {
    const text = (editorBlock?.content ?? content).trim();
    if (!text) return;
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 48;
      const maxWidth = 595 - margin * 2;
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(lines, margin, margin);
      doc.save("agentflow-report.pdf");
    } finally {
      setDownloading(false);
    }
  };

  // Show backend error if any
  const errorMatch = content.match(/⚠️\s*(.+)/);
  if (errorMatch) {
    return (
      <div className="p-8 text-center">
        <div className="max-w-md mx-auto bg-red-500/10 border border-red-400/30 rounded-2xl p-6">
          <div className="text-red-400 text-4xl mb-4">⚠️</div>
          <h3 className="font-semibold text-red-400 mb-2">Workflow Error</h3>
          <p className="text-red-300 text-sm leading-relaxed">{errorMatch[1]}</p>
          <Button onClick={() => window.location.reload()} className="mt-6" variant="outline">
            Restart Workflow
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* Top Actions */}
      <div className="absolute right-0 top-0 z-10 flex items-center gap-2 bg-[#09090b]/90 backdrop-blur-md px-3 py-2 rounded-bl-2xl border-b border-l border-white/10">
        <Button variant="ghost" size="icon" onClick={handleCopy} className="h-8 w-8">
          {copied ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={handleDownloadPdf} disabled={downloading} className="h-8 w-8">
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        </Button>
      </div>

      <ScrollArea className="flex-1 pr-6">
        <div className="flex flex-col gap-8 pb-20 pt-4">

          {traceBlocks.length > 0 && (
            <div>
              <h3 className="text-xs font-mono uppercase tracking-widest text-white/40 mb-4 px-1">Agent Thought Trace</h3>
              <div className="space-y-3">
                {traceBlocks.map((block, i) => {
                  const config = AGENT_CONFIG[block.agent];
                  if (!config) return null;
                  const isExpanded = expandedAgents.has(block.agent);
                  const isActive = !block.done && isStreaming;

                  return (
                    <div key={`${block.agent}-${i}`} className="group border border-white/10 rounded-2xl bg-[#111113] overflow-hidden transition-all hover:border-white/20">
                      <button
                        onClick={() => toggleExpand(block.agent)}
                        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/5 transition-colors text-left"
                      >
                        <config.Icon className={cn("w-4 h-4", config.color)} />
                        <span className="font-medium text-sm text-white/90">{config.label}</span>
                        <div className="flex-1" />
                        {isActive && <Loader2 className="w-3.5 h-3.5 animate-spin text-white/60" />}
                        {block.done && <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />}
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
                      </button>

                      {isExpanded && (
                        <div className="px-5 pb-5 border-t border-white/10 pt-3 text-sm">
                          {block.content ? (
                            <div className="leading-relaxed text-white/80">
                              {renderMarkdown(block.content)}
                            </div>
                          ) : (
                            <span className="text-white/30 font-mono text-xs">Waiting for output...</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Final Synthesis */}
          {editorBlock && (
            <div className="rounded-3xl border border-cyan-400/30 bg-gradient-to-b from-cyan-950/10 to-transparent shadow-2xl shadow-cyan-500/10 overflow-hidden">
              <div className="bg-cyan-500/10 px-6 py-4 flex items-center gap-3 border-b border-cyan-400/20">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <span className="font-semibold tracking-widest uppercase text-cyan-300 text-sm">Final Synthesis</span>
                {(!editorBlock.done && isStreaming) && <Loader2 className="w-4 h-4 animate-spin text-cyan-400 ml-auto" />}
              </div>

              <div className="p-7 md:p-9 text-[15px] leading-relaxed">
                {editorBlock.content ? (
                  renderMarkdown(editorBlock.content, true)
                ) : (
                  <div className="text-cyan-400/60 font-light italic">Polishing the final report...</div>
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} className="h-8" />
        </div>
      </ScrollArea>
    </div>
  );
}