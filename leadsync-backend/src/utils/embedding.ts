import { onnxWorkerPool } from "./onnxWorkerPool";

/**
 * Generate embeddings for text using multilingual-e5-small model offloaded to ONNX worker pool.
 * Returns a 384-dimensional normalized float array.
 */
export async function embedText(text: string): Promise<number[]> {
  if (!text || typeof text !== "string") {
    throw new Error("Input must be a non-empty string");
  }

  return onnxWorkerPool.embed(text);
}