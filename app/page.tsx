"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import WorkflowForm from "@/components/WorkflowForm";
import StatusBar from "@/components/StatusBar";
import ResponseArea from "@/components/ResponseArea";

type WorkflowStatus = "idle" | "thinking" | "streaming" | "done";

const AGENT_DELIM_RE = /§AGENT:(\w+)§|§DONE§/g;

export default function HomePage() {
  const [status, setStatus] = useState<WorkflowStatus>("idle");
  const [responseContent, setResponseContent] = useState("");
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [currentGoal, setCurrentGoal] = useState<string>("");
  const [error, setError] = useState<string>(""); // ← New: Global error state

  const handleReset = useCallback(() => {
    setStatus("idle");
    setResponseContent("");
    setActiveAgent(null);
    setCurrentGoal("");
    setError("");
  }, []);

  const handleStream = useCallback(
    async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
      const decoder = new TextDecoder();
      let fullText = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;

          // Detect backend errors (they start with ⚠️)
          if (fullText.includes("⚠️")) {
            const errorMsg = fullText.split("⚠️")[1]?.trim() || "Unknown error occurred";
            setError(errorMsg);
          }

          // Track active agent
          const matches = [...fullText.matchAll(AGENT_DELIM_RE)];
          if (matches.length > 0) {
            const lastMatch = matches[matches.length - 1];
            if (lastMatch[0] === "§DONE§") {
              setActiveAgent(null);
            } else if (lastMatch[1]) {
              setActiveAgent(lastMatch[1]);
            }
          }

          setResponseContent(fullText);
        }

        setStatus("done");
        setActiveAgent(null);
      } catch {
        if (fullText) setStatus("done");
        else setStatus("idle");
        setActiveAgent(null);
      }
    },
    []
  );

  return (
    <div className="flex flex-col h-screen w-full bg-[#09090b] text-[#ededed] font-sans overflow-hidden selection:bg-cyan-500/30">
      
      {/* TOP BANNER - Modal-like "About This Project" Section */}
      <div className="w-full border-b border-white/10 bg-[#111113] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              AGENTFLOW
            </h1>
            <p className="text-xs text-[#8a8a8a] mt-0.5">
              A local multi-agent RAG pipeline for complex document synthesis
            </p>
          </div>
        </div>

        <div className="max-w-md text-xs text-[#a1a1aa] leading-relaxed hidden md:block">
          This project demonstrates a full-stack <span className="text-cyan-400">multi-agent system</span> using
          LangGraph, local Ollama, and ChromaDB RAG. It can research, critique, write, and polish reports
          from your own documents — completely offline.
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://www.linkedin.com/in/arun-eswaran-dev/"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            <span>Built by</span>
            <span className="text-cyan-400">Arun Eswaran</span>
          </a>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT COLUMN: CONTROL PANEL */}
        <div className="w-full lg:w-[35%] lg:min-w-[400px] lg:max-w-[500px] h-full flex flex-col border-b lg:border-b-0 lg:border-r border-white/10 bg-[#09090b] z-10 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col h-full p-6 lg:p-8 gap-8">
            
            {/* Form + Status */}
            <div className="flex flex-col gap-6 flex-1">
              <WorkflowForm
                onStream={handleStream}
                onStatusChange={(s) => setStatus(s)}
                onReset={handleReset}
                status={status}
                onGoalSubmit={(g) => setCurrentGoal(g)}
              />
              
              {status !== "idle" && (
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <StatusBar status={status} activeAgent={activeAgent} />
                </div>
              )}
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: OUTPUT CANVAS */}
        <div className="flex-1 h-full bg-[#09090b] relative overflow-y-auto custom-scrollbar">
          
          {/* Global Error Banner */}
          {error && (
            <div className="mx-6 mt-6 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl p-4 text-sm flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-medium">Something went wrong</p>
                <p className="text-red-300 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {status === "idle" && !responseContent && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl border border-white/10 bg-white/[0.02] flex items-center justify-center mb-4 shadow-2xl">
                <span className="text-2xl opacity-50">✨</span>
              </div>
              <h2 className="text-lg font-medium text-[#ededed] mb-2">Awaiting Instructions</h2>
              <p className="text-sm text-[#8a8a8a] max-w-[300px]">
                Upload a document and provide a goal in the left panel to trigger the agent workflow.
              </p>
            </div>
          )}

          {/* Output Area */}
          <div className="p-6 lg:p-12 max-w-4xl mx-auto w-full h-full">
            {(status !== "idle" || responseContent) && (
              <ResponseArea 
                content={responseContent} 
                isStreaming={status === "streaming"} 
                status={status} 
              />
            )}
          </div>
        </div>
      </div>

      {/* GLOBAL FOOTER */}
      <div className="h-12 border-t border-white/10 bg-[#09090b] flex items-center px-6 text-xs text-[#8a8a8a]">
  <div className="flex items-center gap-6 w-full">
    <p>
      Built by <span className="text-cyan-400 font-medium">Arun Eswaran</span>
    </p>

    <a
      href="https://www.linkedin.com/in/arun-eswaran-dev/"
      target="_blank"
      rel="noreferrer"
      className="hover:text-cyan-400 transition-colors flex items-center gap-1"
    >
      LinkedIn →
    </a>

    <a
      href="https://github.com/arun-1312" // 👈 replace this
      target="_blank"
      rel="noreferrer"
      className="hover:text-cyan-400 transition-colors flex items-center gap-1"
    >
      GitHub →
    </a>

    <div className="ml-auto text-[#666]">
      Vibe Coded • Local • Zero Cost
    </div>
  </div>
</div>
    </div>
  );
}