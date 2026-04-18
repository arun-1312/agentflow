/**
 * lib/langgraph/supervisor.ts
 *
 * Multi-agent supervisor graph powered by LangGraph.js + Ollama (qwen2.5:7b).
 *
 * Architecture:
 *   START → supervisor → researcher → supervisor → critic → supervisor →
 *           writer     → supervisor → editor     → supervisor → END
 *
 * Key design decisions:
 *  - Agents NEVER see supervisor bookkeeping messages — those are stripped.
 *  - Each agent is given a crystal-clear, role-specific system prompt that
 *    explicitly instructs it to build on the prior agent's output.
 *  - The Researcher node calls `retrieveSimilarDocuments` (RAG) and grounds
 *    all findings exclusively in retrieved excerpts.
 *  - ALL list output across every agent is strictly numbered (1., 2., 3. …).
 *    Bullet points (- or *) are explicitly banned in every system prompt.
 *  - The Editor performs real structural & stylistic work, not just polish.
 *  - Streaming uses streamMode "custom" + getWriter() so the API route receives
 *    §AGENT:name§ delimiters and raw text tokens — nothing else.
 */

import { ChatOllama } from "@langchain/ollama";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import {
  Annotation,
  END,
  START,
  StateGraph,
  getWriter,
  messagesStateReducer,
} from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import { retrieveSimilarDocuments } from "@/lib/rag/vector-store";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const AgentState = Annotation.Root({
  /**
   * Accumulating message history shared across all agents.
   * Every node reads from it and appends its output so downstream agents
   * are always grounded in prior work.
   */
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  /** Pipeline cursor — incremented by each agent node, read by supervisor */
  step: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),

  /** The user's original goal — stored once on first pass */
  goal: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  /** Per-agent outputs passed directly to the next stage */
  researcherOutput: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  criticOutput: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  writerOutput: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  /** Per-run Chroma collection name for RAG */
  ragCollection: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
});

type AgentStateType = typeof AgentState.State;
type AgentStateUpdate = typeof AgentState.Update;

// ---------------------------------------------------------------------------
// Model factory
// ---------------------------------------------------------------------------

const MODEL = "qwen2.5:7b";
const BASE_URL = "http://localhost:11434";

function makeLLM(): ChatOllama {
  return new ChatOllama({
    model: MODEL,
    baseUrl: BASE_URL,
    temperature: 0.65,
    streaming: true,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferGoalFromMessages(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as unknown as {
      _getType?: () => string;
      content?: unknown;
    };
    if (
      typeof m._getType === "function" &&
      m._getType() === "human" &&
      typeof m.content === "string"
    ) {
      return m.content.trim();
    }
  }
  return "";
}

function formatConversationHistory(messages: BaseMessage[]): string {
  if (messages.length === 0) return "(no prior conversation)";
  return messages
    .map((m) => {
      const msg = m as unknown as {
        _getType?: () => string;
        name?: unknown;
        content?: unknown;
      };
      const type =
        typeof msg._getType === "function" ? msg._getType() : "message";
      const name =
        typeof msg.name === "string" ? ` (${msg.name})` : "";
      const content =
        typeof msg.content === "string"
          ? msg.content
          : "[non-text content]";
      return `[${type.toUpperCase()}${name}]: ${content}`;
    })
    .join("\n");
}

/** Shared numbered-list enforcement reminder appended to every system prompt */
const NUMBERED_LIST_RULE = `
ABSOLUTE FORMATTING RULE — NO EXCEPTIONS:
You MUST use numbered lists (1., 2., 3. …) for every list or enumeration.
You MUST NEVER use bullet points (-, *, •, –, or any dash/symbol prefix).
If you output a bullet point, your response will be rejected and the pipeline will fail.
`.trim();

// ---------------------------------------------------------------------------
// Pipeline definition
// ---------------------------------------------------------------------------

type AgentName = "researcher" | "critic" | "writer" | "editor";
const PIPELINE: Array<AgentName | typeof END> = [
  "researcher",
  "critic",
  "writer",
  "editor",
  END,
];

// ---------------------------------------------------------------------------
// Supervisor node
// ---------------------------------------------------------------------------

async function supervisorNode(
  state: AgentStateType,
  config: LangGraphRunnableConfig
): Promise<AgentStateUpdate> {
  const next = PIPELINE[state.step];
  const writer = getWriter(config);
  const inferredGoal =
    state.goal?.trim() || inferGoalFromMessages(state.messages);

  if (next === END) {
    writer?.(`§DONE§`);
  } else {
    writer?.(`§AGENT:${String(next)}§`);
  }

  // Return nothing to messages — agents must not see supervisor bookkeeping
  return { step: state.step, goal: inferredGoal };
}

function supervisorRouter(
  state: AgentStateType
): AgentName | typeof END {
  const next = PIPELINE[state.step];
  if (next === END) return END;
  return next as AgentName;
}

// ---------------------------------------------------------------------------
// Agent nodes
// ---------------------------------------------------------------------------

/**
 * RESEARCHER
 * Retrieves documents via RAG and produces a numbered list of grounded findings.
 */
async function researcherNode(
  state: AgentStateType,
  config: LangGraphRunnableConfig
): Promise<AgentStateUpdate> {
  const llm = makeLLM();
  const writer = getWriter(config);

  const goal =
    state.goal?.trim() || inferGoalFromMessages(state.messages);

  // Guard: no RAG collection uploaded
  const collection = state.ragCollection?.trim();
  if (!collection) {
    const fallback =
      `**Research Findings:**\n` +
      `1. Insufficient data: No documents were uploaded for retrieval.\n` +
      `2. Resolution: Upload at least one document and retry the pipeline.`;
    writer?.(fallback);
    return {
      messages: [new AIMessage({ name: "researcher", content: fallback })],
      researcherOutput: fallback,
      step: state.step + 1,
    };
  }

  // RAG retrieval
  const retrieved = await retrieveSimilarDocuments(collection, goal, 8);
  const retrievedText =
    retrieved.length > 0
      ? retrieved
          .map((d, i) => {
            const source = d.metadata?.source
              ? `source=${String(d.metadata.source)}`
              : "source=unknown";
            return `[${i + 1}] (${source})\n${d.pageContent}`;
          })
          .join("\n\n---\n\n")
      : "[No document excerpts retrieved — respond only with what is stated below]";

  const systemPrompt = `You are the Researcher Agent in a multi-agent pipeline. Your sole responsibility is to extract and report precise, concrete findings that directly address the user's goal.

MISSION:
Produce a numbered list of 15–18 research findings derived exclusively from the retrieved document excerpts provided below. Every finding must cite the specific excerpt(s) that support it using bracket notation (e.g., [2] or [1][4]).

STRICT RULES:
1. Use ONLY the retrieved excerpts as your source. Do not draw on prior knowledge, training data, or external assumptions.
2. If an excerpt does not directly support a claim, write: "Insufficient support in documents: <description of missing information>" — do not invent data.
3. Each numbered point must contain a specific, actionable insight — not vague summaries.
4. Every point must end with its excerpt citation(s) in square brackets.
5. Do not repeat the same information across multiple points.
6. Do not include meta-commentary such as "I have gathered..." or "Here are the findings...".

${NUMBERED_LIST_RULE}

OUTPUT FORMAT (strictly follow this structure):
**Research Findings:**
1. [Specific finding with concrete detail] ([excerpt citation])
2. [Specific finding with concrete detail] ([excerpt citation])
… (continue to 15–18 points)

CONVERSATION HISTORY (contextual reference only — do not quote verbatim):
${formatConversationHistory(state.messages)}

RETRIEVED DOCUMENT EXCERPTS (authoritative grounding — cite these):
${retrievedText}`;

  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`Research goal: ${goal}`),
  ];

  let fullText = "";
  const stream = await llm.stream(messages, { signal: config.signal });
  for await (const chunk of stream) {
    const token =
      typeof chunk.content === "string" ? chunk.content : "";
    if (token) {
      fullText += token;
      writer?.(token);
    }
  }

  const cleaned =
    fullText.trim() ||
    `**Research Findings:**\n1. Insufficient data: The model produced no output. Retry with clearer documents or goal.`;

  return {
    messages: [new AIMessage({ name: "researcher", content: cleaned })],
    researcherOutput: cleaned,
    step: state.step + 1,
  };
}

/**
 * CRITIC
 * Reviews the researcher's findings for completeness, accuracy, and depth.
 */
async function criticNode(
  state: AgentStateType,
  config: LangGraphRunnableConfig
): Promise<AgentStateUpdate> {
  const llm = makeLLM();
  const writer = getWriter(config);

  const goal =
    state.goal?.trim() || inferGoalFromMessages(state.messages);

  const systemPrompt = `You are the Critic Agent in a multi-agent pipeline. Your role is to perform a structured, rigorous quality review of the Researcher's findings before they are handed to the Writer.

MISSION:
Evaluate the Researcher's numbered findings below. Produce a numbered review with 10–12 points that each assess a specific finding or pattern across findings. For each review point, you must:
  a) Reference the specific finding number(s) from the Researcher's output (e.g., "Finding 3").
  b) State clearly whether it is a strength or a gap.
  c) Provide a concrete, actionable suggestion or confirmation.

EVALUATION CRITERIA (apply all):
1. Factual specificity — Is the finding backed by concrete data, names, or figures? Or is it vague?
2. Relevance — Does the finding directly address the stated goal?
3. Depth — Does it go beyond surface-level description to explain impact or significance?
4. Coverage gaps — What important angles, categories, or perspectives are missing entirely?
5. Redundancy — Are any findings repetitive or overlapping? Flag and suggest consolidation.
6. Citation quality — Are excerpt citations present and plausible?

STRICT RULES:
1. Reference the Researcher's findings by their exact number (e.g., "Finding 7").
2. Do not copy or paraphrase the Researcher's findings verbatim — evaluate them.
3. Do not introduce new facts, tools, or data not found in the Researcher's output.
4. Do not write generic phrases like "good job" or "well done" without specific justification.
5. Do not include meta-commentary such as "I have reviewed..." or "The review is complete".

${NUMBERED_LIST_RULE}

OUTPUT FORMAT:
**Quality Review:**
1. [Strength/Gap label — Finding X]: [Specific evaluation and concrete suggestion]
2. [Strength/Gap label — Finding X]: [Specific evaluation and concrete suggestion]
… (continue to 10–12 points)

RESEARCHER'S OUTPUT (review this exactly):
${state.researcherOutput || "[No researcher output received — flag all findings as missing]"}

USER GOAL: ${goal}`;

  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`Review the research findings for goal: ${goal}`),
  ];

  let fullText = "";
  writer?.("Critic is evaluating research quality and coverage...\n\n");
  const stream = await llm.stream(messages, { signal: config.signal });
  for await (const chunk of stream) {
    const token =
      typeof chunk.content === "string" ? chunk.content : "";
    if (token) {
      fullText += token;
      writer?.(token);
    }
  }

  const cleaned =
    fullText.trim() ||
    `**Quality Review:**\n1. No review produced: Critic returned empty output. Treat all research findings as unvalidated and proceed with caution.`;

  return {
    messages: [new AIMessage({ name: "critic", content: cleaned })],
    criticOutput: cleaned,
    step: state.step + 1,
  };
}

/**
 * WRITER
 * Synthesises researcher findings + critic review into a structured, numbered report.
 */
async function writerNode(
  state: AgentStateType,
  config: LangGraphRunnableConfig
): Promise<AgentStateUpdate> {
  const llm = makeLLM();
  const writer = getWriter(config);

  const goal =
    state.goal?.trim() || inferGoalFromMessages(state.messages);

  const systemPrompt = `You are the Writer Agent in a multi-agent pipeline. Your role is to synthesise the validated research into a structured, authoritative, publication-ready report that directly answers the user's goal.

MISSION:
Using the Research Findings as your primary source and the Critic's Review as your editorial guide, produce a cohesive numbered report. Every claim you include MUST trace back to the Research Findings — do not invent facts, tools, names, statistics, or dates.

SYNTHESIS APPROACH:
1. Open with a direct-answer paragraph (3–5 sentences) that summarises the core answer to the goal.
2. Follow with a numbered list of the top findings/items relevant to the goal.
3. For each numbered item include:
   a. A clear, descriptive name or label.
   b. A 2–3 sentence explanation of what it is and why it matters for the goal.
   c. Any relevant caveats flagged by the Critic (e.g., "Note: evidence is limited to [source]").
4. Incorporate all actionable Critic suggestions that improve accuracy or depth — ignore suggestions that would require inventing new data.

STRICT RULES:
1. Ground every item in the Research Findings. If a Critic suggestion cannot be satisfied by the existing research, write: "Insufficient data: [topic]" rather than fabricating content.
2. Do not copy the Researcher's or Critic's output verbatim — synthesise and rewrite in your own voice.
3. Do not use hedging language like "Based on the above..." or "As noted by the critic...".
4. Do not include meta-commentary, sign-offs, or editorial notes about your own writing process.
5. Write in a professional, confident, third-person editorial voice.

${NUMBERED_LIST_RULE}

OUTPUT FORMAT:
**Structured Response:**
[Opening paragraph — 3–5 sentences answering the goal directly]

1. [Item name]: [2–3 sentence description + relevance to goal]
2. [Item name]: [2–3 sentence description + relevance to goal]
… (cover all well-supported findings, typically 8–12 items)

RESEARCH FINDINGS (primary source — use exclusively):
${state.researcherOutput || "[No research findings available — output: Insufficient data to produce a grounded report.]"}

CRITIC'S REVIEW (editorial guidance — incorporate where research supports it):
${state.criticOutput || "[No critic review available — proceed using research findings only.]"}

USER GOAL: ${goal}`;

  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`Write a structured report for: ${goal}`),
  ];

  let fullText = "";
  writer?.("Writer is drafting a structured, grounded report...\n\n");
  const stream = await llm.stream(messages, { signal: config.signal });
  for await (const chunk of stream) {
    const token =
      typeof chunk.content === "string" ? chunk.content : "";
    if (token) {
      fullText += token;
      writer?.(token);
    }
  }

  const cleaned =
    fullText.trim() ||
    `**Structured Response:**\nInsufficient data: No grounded content could be produced from the available research.`;

  return {
    messages: [new AIMessage({ name: "writer", content: cleaned })],
    writerOutput: cleaned,
    step: state.step + 1,
  };
}

/**
 * EDITOR
 * Performs substantive structural editing, consistency enforcement, and final polish.
 * This is real editorial work — not just grammar fixes.
 */
async function editorNode(
  state: AgentStateType,
  config: LangGraphRunnableConfig
): Promise<AgentStateUpdate> {
  const llm = makeLLM();
  const writer = getWriter(config);

  const goal =
    state.goal?.trim() || inferGoalFromMessages(state.messages);

  const systemPrompt = `You are the Editor Agent — the final stage of a multi-agent pipeline. You are a senior editorial professional responsible for transforming the Writer's draft into the definitive, authoritative final answer.

Your role goes beyond proofreading. You must perform substantive editorial work across four dimensions:

━━━ DIMENSION 1: STRUCTURAL INTEGRITY ━━━
Audit the report's architecture:
- Does the opening paragraph directly and completely answer the goal in 3–5 sentences? If not, rewrite it so it does.
- Are the numbered items in a logical, coherent sequence (e.g., most important first, or thematically grouped)? If not, reorder them.
- Are any items redundant, overlapping, or off-topic? Merge or remove them.
- Are any critical angles missing that the research clearly supports? Insert them using only content already present in the draft.

━━━ DIMENSION 2: PROSE QUALITY ━━━
Elevate every sentence:
- Eliminate passive voice where active voice is stronger.
- Replace vague qualifiers ("very", "quite", "somewhat", "various") with precise language.
- Ensure each numbered item starts with a strong, specific noun or verb — not filler phrases.
- Break up run-on sentences. Combine choppy fragments into smooth, confident prose.
- Ensure consistent tense (present tense preferred for timeless statements).

━━━ DIMENSION 3: CONSISTENCY & PRECISION ━━━
- Standardise all terminology — if a tool or concept is named two different ways, pick one and apply it throughout.
- Ensure all numbered items follow a consistent internal structure (name → description → relevance).
- Verify that any caveats ("Insufficient data: …") are clearly labelled and not buried mid-sentence.
- Remove any residual meta-commentary, hedging phrases, or process language ("As the writer noted", "Based on the above", "This completes", "End of report").

━━━ DIMENSION 4: GOAL ALIGNMENT ━━━
- Re-read the user's original goal. Does the final answer DIRECTLY address it?
- If the opening paragraph drifts from the goal, sharpen it.
- If numbered items don't connect back to the goal, add a one-sentence "relevance to [goal]" tag at the end of that item.

STRICT RULES:
1. Do NOT add new facts, statistics, tool names, or claims not already present in the Writer's draft.
2. Do NOT remove factual content — only restructure, rephrase, or reorder.
3. Do NOT include any of the following in your output: "I have edited...", "This completes...", "The report is now...", "Note:", "End of Report", or any process commentary.
4. Output ONLY the finished report — clean, complete, and ready to publish.
5. The first line of your output must be the heading: **Final Answer:**

${NUMBERED_LIST_RULE}

OUTPUT FORMAT:
**Final Answer:**
[Polished opening paragraph — 3–5 sentences, directly answering the goal]

1. [Item name]: [Polished 2–3 sentence description + goal relevance]
2. [Item name]: [Polished 2–3 sentence description + goal relevance]
… (all items, reordered and refined as needed)

WRITER'S DRAFT (edit this — you may reorder, rewrite, merge, or split items, but do not fabricate):
${state.writerOutput || "[No writer draft received — output: **Final Answer:**\nInsufficient data: No draft was produced by the Writer agent.]"}

USER GOAL (final alignment check): ${goal}`;

  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    new HumanMessage(
      `Perform full editorial review and produce the final answer for: ${goal}`
    ),
  ];

  let fullText = "";
  writer?.(
    "Editor is performing structural review and final polish...\n\n"
  );
  const stream = await llm.stream(messages, { signal: config.signal });
  for await (const chunk of stream) {
    const token =
      typeof chunk.content === "string" ? chunk.content : "";
    if (token) {
      fullText += token;
      writer?.(token);
    }
  }

  const cleaned =
    fullText.trim() ||
    `**Final Answer:**\nInsufficient data: The editor produced no output. Review upstream agent outputs for failures.`;

  return {
    messages: [new AIMessage({ name: "editor", content: cleaned })],
    step: state.step + 1,
  };
}

// ---------------------------------------------------------------------------
// Graph construction
// ---------------------------------------------------------------------------

function buildSupervisorGraph() {
  const graph = new StateGraph(AgentState)
    .addNode("supervisor", supervisorNode)
    .addNode("researcher", researcherNode)
    .addNode("critic", criticNode)
    .addNode("writer", writerNode)
    .addNode("editor", editorNode)

    .addEdge(START, "supervisor")

    .addConditionalEdges("supervisor", supervisorRouter, {
      researcher: "researcher",
      critic: "critic",
      writer: "writer",
      editor: "editor",
      [END]: END,
    })

    .addEdge("researcher", "supervisor")
    .addEdge("critic", "supervisor")
    .addEdge("writer", "supervisor")
    .addEdge("editor", "supervisor");

  return graph.compile();
}

// Lazy singleton — compiled once per process lifetime
let _graph: ReturnType<typeof buildSupervisorGraph> | null = null;

export function getSupervisorGraph() {
  if (!_graph) {
    _graph = buildSupervisorGraph();
  }
  return _graph;
}