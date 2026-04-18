# AgentFlow

**A beautiful, fully local multi-agent RAG system that turns your documents into intelligent research reports.**

Built from scratch - no paid APIs, no cloud credits, everything runs on your laptop.


## ✨ What is AgentFlow?

AgentFlow is a **production-grade multi-agent AI workflow dashboard** that lets you:

- Upload your notes, research papers, PDFs, or lecture notes
- Give any goal in plain English
- Watch a team of specialized AI agents (Researcher → Critic → Writer → Editor) collaborate in real-time
- Get a clean, well-structured final report with proper reasoning trace

It uses **Retrieval-Augmented Generation (RAG)** so the agents stay grounded in *your* documents instead of hallucinating.

Everything runs **100% locally** using Ollama + LangGraph — zero cost, zero data leaves your laptop.

## I built a **real agentic system** that demonstrates:

- Modern AI orchestration (LangGraph)
- Production-ready RAG pipeline
- Full-stack development with beautiful UI
- Local-first architecture (privacy + zero cost)

This project helped me deeply understand agentic workflows, streaming, state management, and what companies actually look for in GenAI roles.

## Features

- **Multi-Agent Collaboration** — Researcher, Critic, Writer & Editor work together
- **Real RAG** — Upload documents → agents retrieve relevant context
- **Live Streaming UI** — Watch agents think in real-time
- **Beautiful Collapsible Agent Trace** — Clean card-style interface
- **Final Synthesis** — Highlighted, polished final answer with Copy & Download as PDF
- **Error Handling** — Friendly messages if Ollama is not running
- **100% Local & Private** — No OpenAI, no API keys, no internet after setup
- **Modern Tech Stack** — Next.js 15 + TypeScript + Tailwind + shadcn/ui

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **AI Orchestration**: LangGraph.js + Ollama (local LLM)
- **RAG**: ChromaDB + nomic-embed-text embeddings
- **LLM**: Qwen2.5:7B (or any model you prefer via Ollama)
- **Deployment**: Docker-ready (one-command local setup)

## How to Run Locally (Super Simple)

### Prerequisites
- Node.js (v20 or above)
- Ollama installed and running (`ollama serve`)
- At least one model pulled: `ollama pull qwen2.5:7b`

### Step-by-step Setup

1. Clone the repo
   ```bash
   git clone https://github.com/yourusername/agentflow.git
   cd agentflow
2. Install dependencies
   ```bash
   npm install
3. Make sure Ollama is running and model is ready
   ```bash
   ollama pull qwen2.5:7b
4. Start the development server
   ```bash
   npm run dev
5. Open http://localhost:3000 in your browser

## Done! No environment variables, no API keys, no complicated setup.

## 🚀 How to Use

1. **Upload Documents** *(optional but recommended)*: Drag & drop `.txt`, `.md`, or `.pdf` files.
2. **Write your goal**: Tell the agents exactly what you need them to analyze.
3. **Trigger Workflow**: Click submit and watch the agents work and stream their thoughts in real-time!
4. **Export**: Once finished, you can copy the final answer or download the full synthesis report as a PDF.

---

## 🏗️ Architecture Overview

All inter-agent communication happens through a stateful **LangGraph** workflow.

* **Supervisor** ➔ Decides which agent acts next based on the pipeline state.
* **Researcher** ➔ Uses RAG to retrieve relevant, grounded information from the embedded documents.
* **Critic** ➔ Checks quality, evaluates gaps, and actively reduces hallucinations.
* **Writer** ➔ Creates a highly structured response utilizing only the approved research.
* **Editor** ➔ Polishes the final output for formatting, grammar, and tone.

---

## 🧠 Challenges I Faced & What I Learned

* Handling proper streaming with LangGraph's custom stream mode.
* Making RAG reliable with local embeddings and vector stores.
* Building a beautiful, responsive UI that feels premium and eliminates infinite scrolling.
* Debugging agent loops and managing complex state across multiple LLM calls.
* Making the entire system feel "alive" with real-time UI updates and trace logs.

> *This project taught me more about modern AI engineering and systems architecture than any course.*

---

## 🗺️ Future Improvements (Roadmap)

- [ ] Docker + `docker-compose` one-click setup
- [ ] Support for more complex file types (advanced PDF and image parsing)
- [ ] Memory between sessions (persistent knowledge base)
- [ ] Evaluation metrics dashboard
- [ ] Export to Markdown/Notion integrations

---

## 👨‍💻 About the Developer

Built by **Arun Eswaran** *Pre-final year B.Tech CSE core student at SRM University*

Passionate about AI agents, full-stack development, and building real-world products that solve complex problems.

* 🔗 **LinkedIn:** [linkedin.com/in/arun-eswaran-dev](https://www.linkedin.com/in/arun-eswaran-dev)
* 🐙 **GitHub:** [github.com/arun-1312](https://github.com/arun-1312)

If you're a recruiter or a fellow student and find this project interesting, feel free to connect or star the repo! ⭐

*Made with ❤️ and vibe coding.*
