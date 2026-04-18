import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OllamaEmbeddings } from "@langchain/ollama";
import type { Document } from "@langchain/core/documents";

const EMBED_MODEL = "nomic-embed-text";
const OLLAMA_BASE_URL = "http://localhost:11434";
const CHROMA_URL = process.env.CHROMA_URL ?? "http://localhost:8000";

function getEmbeddings() {
  return new OllamaEmbeddings({
    model: EMBED_MODEL,
    baseUrl: OLLAMA_BASE_URL,
  });
}

async function getVectorStore(collectionName: string) {
  const embeddings = getEmbeddings();

  return await Chroma.fromExistingCollection(embeddings, {
    collectionName,
    url: CHROMA_URL,
  });
}

export async function addDocuments(collectionName: string, docs: Document[]) {
  const embeddings = getEmbeddings();
  const store = await Chroma.fromDocuments(docs, embeddings, {
    collectionName,
    url: CHROMA_URL,
  });
  // Some Chroma implementations require explicit persist; call if present.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maybePersist = (store as any)?.persist;
  if (typeof maybePersist === "function") {
    await maybePersist.call(store);
  }
}

export async function retrieveSimilarDocuments(
  collectionName: string,
  query: string,
  k = 6
): Promise<Document[]> {
  const store = await getVectorStore(collectionName);
  return await store.similaritySearch(query, k);
}

