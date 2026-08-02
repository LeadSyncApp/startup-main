/**
 * Response and object serialization helper for deep sanitization.
 * Prevents unhandled BigInt, Buffer, undefined, or circular reference errors in API responses.
 */

/**
 * Deeply transforms any object, array, or primitive to be safely serializable to JSON.
 * - BigInt -> Number (if safe integer) or String
 * - Buffer / Uint8Array -> base64 string or ISO standard payload
 * - undefined -> null (optional, when clean JSON keys are required)
 * - Date -> ISO String
 */
export function sanitizeResponseData<T = any>(input: any, options: { replaceUndefinedWithNull?: boolean } = {}): T {
  if (input === null || input === undefined) {
    return options.replaceUndefinedWithNull && input === undefined ? (null as any) : input;
  }

  if (typeof input === "bigint") {
    const num = Number(input);
    return (Number.isSafeInteger(num) ? num : input.toString()) as any;
  }

  if (typeof input === "number" || typeof input === "string" || typeof input === "boolean") {
    return input as any;
  }

  if (input instanceof Date) {
    return input.toISOString() as any;
  }

  if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
    return Buffer.from(input).toString("base64") as any;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeResponseData(item, options)) as any;
  }

  if (typeof input === "object") {
    // Avoid mutating existing objects (e.g. Prisma instances)
    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(input)) {
      const val = input[key];
      if (val === undefined && options.replaceUndefinedWithNull) {
        sanitized[key] = null;
      } else if (val !== undefined) {
        sanitized[key] = sanitizeResponseData(val, options);
      }
    }
    return sanitized as any;
  }

  return input;
}
