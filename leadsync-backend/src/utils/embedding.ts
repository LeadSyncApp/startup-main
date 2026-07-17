/**
 * Embedding utility using @xenova/transformers with Xenova/multilingual-e5-small
 * Follows the pattern validated in scripts/test_local_embeddings.mjs
 */
import { pipeline, env, FeatureExtractionPipeline } from "@xenova/transformers";

// Model name for multilingual E5 small (384 dimensions)
const MODEL_NAME = "Xenova/multilingual-e5-small";

// Singleton pipeline instance - cached at module level
let extractor: FeatureExtractionPipeline | null = null;

/**
 * Get or create the embedding pipeline singleton
 */
export async function getEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", MODEL_NAME, {
      quantized: true, // Use ONNX quantized (smaller/faster)
    });
  }
  return extractor;
}

/**
 * Generate embeddings for text using multilingual-e5-small model
 * Returns a 384-dimensional normalized float array
 */
export async function embedText(text: string): Promise<number[]> {
  if (!text || typeof text !== "string") {
    throw new Error("Input must be a non-empty string");
  }

  const extractor = await getEmbeddingPipeline();
  
  const result = await extractor(text, { 
    pooling: "mean", 
    normalize: true 
  });
  
  return Array.from(result.data);
}