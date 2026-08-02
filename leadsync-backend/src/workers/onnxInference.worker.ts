import { parentPort } from "node:worker_threads";

// MANDATORY: Polyfill self and lock ONNX WASM threads BEFORE importing @xenova/transformers
(global as any).self = global;

import {
  pipeline,
  env,
  FeatureExtractionPipeline,
  AutoTokenizer,
  AutoModelForSequenceClassification,
} from "@xenova/transformers";

// Limit internal ONNX WASM threads to 1 per worker thread to prevent thread contention
env.backends.onnx.wasm.numThreads = 1;
if (env.backends?.onnx) {
  (env.backends.onnx as any).preferNative = false;
}

const E5_MODEL_NAME = "Xenova/multilingual-e5-small";
const RERANKER_MODEL_NAME = "onnx-community/bge-reranker-v2-m3-ONNX";

let embeddingPipeline: FeatureExtractionPipeline | null = null;
let rerankerTokenizer: any = null;
let rerankerModel: any = null;

async function getEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline("feature-extraction", E5_MODEL_NAME, {
      quantized: true,
    });
  }
  return embeddingPipeline;
}

async function getReranker() {
  if (!rerankerTokenizer || !rerankerModel) {
    rerankerTokenizer = await AutoTokenizer.from_pretrained(RERANKER_MODEL_NAME);
    rerankerModel = await AutoModelForSequenceClassification.from_pretrained(RERANKER_MODEL_NAME);
  }
  return { tokenizer: rerankerTokenizer, model: rerankerModel };
}

function sigmoid(x: number): number {
  if (x >= 0) {
    return 1 / (1 + Math.exp(-x));
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

async function handleWarmup(): Promise<void> {
  await getEmbeddingPipeline();
  await getReranker();
}

async function handleEmbed(text: string): Promise<number[]> {
  if (!text || typeof text !== "string") {
    throw new Error("Input text must be a non-empty string");
  }
  const extractor = await getEmbeddingPipeline();
  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data);
}

async function handleRerank(query: string, documents: string[]): Promise<number[]> {
  if (!query || typeof query !== "string") {
    throw new Error("Query must be a non-empty string");
  }
  if (!Array.isArray(documents)) {
    throw new Error("Documents must be an array of strings");
  }

  const { tokenizer, model } = await getReranker();
  const scores: number[] = [];

  for (const doc of documents) {
    const inputs = await tokenizer([query], {
      text_pair: [doc],
      padding: true,
      truncation: true,
    });
    const output = await model(inputs);
    const logits = output.logits.tolist();
    const score = sigmoid(logits[0][0]);
    scores.push(score);
  }

  return scores;
}

if (!parentPort) {
  throw new Error("onnxInference.worker.ts must be run within a Worker thread.");
}

parentPort.on("message", async (msg: any) => {
  const { id, type } = msg;
  const start = Date.now();

  try {
    if (type === "WARMUP") {
      await handleWarmup();
      parentPort!.postMessage({ id, type: "WARMUP", status: "OK", durationMs: Date.now() - start });
    } else if (type === "EMBED") {
      const result = await handleEmbed(msg.text);
      parentPort!.postMessage({ id, type: "EMBED", result, durationMs: Date.now() - start });
    } else if (type === "RERANK") {
      const result = await handleRerank(msg.query, msg.documents);
      parentPort!.postMessage({ id, type: "RERANK", result, durationMs: Date.now() - start });
    } else {
      throw new Error(`Unknown ONNX worker task type: ${type}`);
    }
  } catch (err: any) {
    parentPort!.postMessage({
      id,
      error: err?.message || String(err),
      stack: err?.stack,
    });
  }
});
