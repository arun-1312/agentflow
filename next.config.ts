import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Opt LangGraph and LangChain out of Turbopack bundling.
  // These packages use complex exports maps that Turbopack can't fully resolve;
  // externalising them makes Next.js use native Node.js require() instead.
  serverExternalPackages: [
    "@langchain/core",
    "@langchain/langgraph",
    "@langchain/langgraph-checkpoint",
    "@langchain/ollama",
    "ollama",
  ],
};

export default nextConfig;
