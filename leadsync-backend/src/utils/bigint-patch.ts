/**
 * Global BigInt JSON serialization patch.
 * Ensures JavaScript BigInt primitives are automatically serialized during JSON.stringify
 * and Express res.json() calls without throwing "TypeError: Do not know how to serialize a BigInt".
 *
 * Safe integer values (<= Number.MAX_SAFE_INTEGER) are converted to standard JSON Numbers.
 * Larger values beyond safe integer limits are converted to Strings to prevent precision loss.
 */
if (!(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function (this: bigint) {
    const num = Number(this);
    return Number.isSafeInteger(num) ? num : this.toString();
  };
}

export {};
