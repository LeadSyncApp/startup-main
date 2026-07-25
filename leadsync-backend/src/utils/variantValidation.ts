/**
 * Variant Validation Utility - Hard cap enforcement for multi-dimensional variants
 */

export const MAX_VARIANT_DIMENSIONS = 3;

/**
 * Validates that the number of variant dimensions per product does not exceed the hard cap of 3.
 * Throws an explicit error if the limit is exceeded.
 */
export function validateVariantDimensions(dimensionNames: string[] | null | undefined): void {
  if (!dimensionNames) return;
  if (dimensionNames.length > MAX_VARIANT_DIMENSIONS) {
    throw new Error(
      `A product can have at most ${MAX_VARIANT_DIMENSIONS} variant dimensions (e.g. Size, Color, Material). Received ${dimensionNames.length}.`
    );
  }
}
