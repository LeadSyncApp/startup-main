import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/error.middleware";

/**
 * Validates and normalizes user-provided custom field inputs
 * against the registered CustomFieldDefinitions for the company/module.
 * 
 * @param companyId Tenant identity
 * @param module CRM module type ("LEAD" | "ACCOUNT" | "DEAL")
 * @param inputCustomFields Input customFields object from client/body
 * @returns Clean, formatted JSON object with validated fields to be stored
 */
export async function validateAndSanitizeCustomFields(
  companyId: string,
  module: "LEAD" | "ACCOUNT" | "DEAL",
  inputCustomFields: any
): Promise<Record<string, any>> {
  // Fetch active custom fields schemas
  const definitions = await (prisma as any).customFieldDefinition.findMany({
    where: {
      companyId,
      module: module.toUpperCase(),
    },
  });

  const sanitized: Record<string, any> = {};
  const data = inputCustomFields || {};

  const errors: string[] = [];

  for (const def of definitions) {
    const rawVal = data[def.name];

    // 1. Check Required Constraint
    if (def.required && (rawVal === undefined || rawVal === null || rawVal === "")) {
      errors.push(`Custom field '${def.label}' (${def.name}) is required.`);
      continue;
    }

    // If not required and not provided, use default value if configured, otherwise skip
    if (rawVal === undefined || rawVal === null || rawVal === "") {
      if (def.defaultValue !== null && def.defaultValue !== undefined && def.defaultValue !== "") {
        // Apply default value
        sanitized[def.name] = castValue(def.defaultValue, def.type);
      }
      continue;
    }

    // 2. Validate Type & Range
    try {
      const parsedVal = validateAndCast(rawVal, def.label, def.type, def.options);
      sanitized[def.name] = parsedVal;
    } catch (err: any) {
      errors.push(err.message);
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, `Custom fields validation failed: ${errors.join(" ")}`);
  }

  return sanitized;
}

function castValue(val: string, type: string): any {
  if (type === "NUMBER") return Number(val);
  if (type === "BOOLEAN") return val.toLowerCase() === "true" || val === "1" || val === "true";
  if (type === "DATE") return new Date(val).toISOString();
  return val;
}

function validateAndCast(val: any, label: string, type: string, options: any): any {
  switch (type) {
    case "TEXT":
      return String(val);

    case "NUMBER": {
      const num = Number(val);
      if (isNaN(num)) {
        throw new Error(`The field '${label}' must be a numeric value.`);
      }
      return num;
    }

    case "BOOLEAN": {
      if (typeof val === "boolean") return val;
      if (String(val).toLowerCase() === "true" || val === 1 || String(val) === "1") return true;
      if (String(val).toLowerCase() === "false" || val === 0 || String(val) === "0") return false;
      throw new Error(`The field '${label}' must be a boolean (true/false).`);
    }

    case "DATE": {
      const timestamp = Date.parse(val);
      if (isNaN(timestamp)) {
        throw new Error(`The field '${label}' must be a valid calendar date.`);
      }
      return new Date(timestamp).toISOString();
    }

    case "DROPDOWN": {
      const opts = Array.isArray(options) ? (options as string[]) : [];
      const choice = String(val).trim();
      if (!opts.some(o => o.toLowerCase() === choice.toLowerCase())) {
        throw new Error(`The field '${label}' does not allow choice '${choice}'. Pick from [${opts.join(", ")}].`);
      }
      // Return option with correct casings
      const matched = opts.find(o => o.toLowerCase() === choice.toLowerCase());
      return matched || choice;
    }

    default:
      return val;
  }
}
