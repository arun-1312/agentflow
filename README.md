# AgentFlow

**A beautiful, fully local multi-agent RAG system that turns your documents into intelligent research reports.**

Built from scratch as a **2027 placement project** — no paid APIs, no cloud credits, everything runs on your laptop.

![AgentFlow Demo](https://via.placeholder.com/800x400/111113/22d3ee?text=AgentFlow+Demo+Screenshot)  
*(Add your actual screenshot/GIF here — highly recommended)*

## ✨ What is AgentFlow?

AgentFlow is a **production-grade multi-agent AI workflow dashboard** that lets you:

- Upload your notes, research papers, PDFs, or lecture notes
- Give any goal in plain English
- Watch a team of specialized AI agents (Researcher → Critic → Writer → Editor) collaborate in real-time
- Get a clean, well-structured final report with proper reasoning trace

It uses **Retrieval-Augmented Generation (RAG)** so the agents stay grounded in *your* documents instead of hallucinating.

Everything runs **100% locally** using Ollama + LangGraph — zero cost, zero data leaves your laptop.

## Why I Built This

As a pre-final year CSE student, I wanted to build something that actually stands out in 2027 placements.  
Most students make basic chatbots or todo apps. I built a **real agentic system** that demonstrates:

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

Done! No environment variables, no API keys, no complicated setup.

How to Use

Upload Documents (optional but recommended)
Drag & drop .txt, .md, or .pdf files (or paste content into .txt files)

Write your goal

Click Start Workflow
Watch the agents work in real-time
Once finished, you can:
Copy the final answer
Download the full report as PDF


Architecture Overview

Supervisor → Decides which agent acts next
Researcher → Uses RAG to retrieve relevant information
Critic → Checks quality and reduces hallucinations
Writer → Creates structured response
Editor → Polishes the final output

All communication happens through a stateful LangGraph workflow.

Challenges I Faced & What I Learned

Handling proper streaming with LangGraph's custom stream mode
Making RAG reliable with local embeddings
Building a beautiful, responsive UI that feels premium
Debugging agent loops and state management
Making the entire system feel "alive" with real-time updates

This project taught me more about modern AI engineering than any course.
Future Improvements (Roadmap)

Docker + docker-compose one-click setup
Support for more file types (better PDF parsing)
Memory between sessions (persistent knowledge base)
Evaluation metrics dashboard
Export to Markdown/Notion

Built by Arun Eswaran
Pre-final year B.Tech CSE Student at SRM University
Passionate about AI agents, full-stack development, and building real products.

LinkedIn: linkedin.com/in/arun-eswaran-dev
GitHub: github.com/yourusername

If you're a recruiter or fellow student and find this project useful, feel free to connect or star the repo ⭐

Made with ❤️ and vibe coding.