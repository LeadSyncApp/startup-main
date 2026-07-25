import Groq from "groq-sdk";
import { prisma } from "../../lib/prisma";

// Sarvam chat-completions API endpoint
const SARVAM_CHAT_URL = "https://api.sarvam.ai/v1/chat/completions";

import { normalizeProductsArray, ProductData, ParsedData } from "./numeralConverter";

/**
 * Build BUSINESS TYPE RULES dynamically from a company's ProductFieldDefinition list.
 * Falls back to hardcoded rules if no custom fields are defined.
 */
export function buildBusinessTypeRules(
  businessType: string,
  productFieldDefs: Array<{
    fieldName: string;
    fieldType: string;
    appliesTo: string;
    options: string[];
  }>
): string {
  // If no custom fields defined, use hardcoded fallback rules
  if (!productFieldDefs || productFieldDefs.length === 0) {
    return `- RETAIL: Extract product_type (required), price_inr (required). Variants use attribute_name "Size" or "Color" (optional), with stock as a quantity number. Extract categories as a comma-separated list (e.g. "Sarees, Festive Wear").
- RESTAURANT: Extract product_type (required), price_inr (required, price per portion/plate). Variants use attribute_name "Portion" or "Duration" (optional). Products are available by default (no stock concept — leave stock null). Extract categories as a comma-separated list (e.g. "Starters, Main Course").
- SERVICES: Extract product_type (required), price_inr (required, price per duration). Variants use attribute_name "Duration" (e.g. "60 min", optional). Leave stock null. Extract categories as a comma-separated list (e.g. "Hair Services, Skin Care").`;
  }

  // Build dynamic rules from ProductFieldDefinition list
  const productFields = productFieldDefs.filter(f => f.appliesTo === "product");
  const variantFields = productFieldDefs.filter(f => f.appliesTo === "variant");

  const rules: string[] = [];

  // Core fields always present
  rules.push(`- product_type (required): The product or service name.`);
  rules.push(`- price_inr (required): The base price in INR.`);
  rules.push(`- description (optional): Any descriptive attributes.`);
  rules.push(`- categories (array): Category tags for the product.`);

  // Dynamic product-level fields
  for (const field of productFields) {
    if (field.fieldName === "brand") {
      rules.push(`- brand (optional): The brand or manufacturer name.`);
    } else if (field.fieldType === "select" && field.options.length > 0) {
      rules.push(`- ${field.fieldName} (optional): Extract from these options: ${field.options.join(", ")}.`);
    } else if (field.fieldType === "boolean") {
      rules.push(`- ${field.fieldName} (optional): true or false based on context.`);
    } else {
      rules.push(`- ${field.fieldName} (optional): Extract if mentioned in the text.`);
    }
  }

  // Variant fields
  if (variantFields.length > 0) {
    const variantAttrNames = variantFields.map(f => `"${f.fieldName}"`).join(" or ");
    rules.push(`- Variants use attribute_name ${variantAttrNames} (optional), with appropriate values.`);
    rules.push(`- Stock is tracked as a quantity number for each variant.`);
  } else {
    rules.push(`- Variants use attribute_name "Size" or "Color" (optional), with stock as a quantity number.`);
  }

  return rules.join("\n");
}

/**
 * Build field extraction instructions for the LLM based on a company's ProductFieldDefinitions.
 * Generates a prompt block telling the LLM what custom fields to extract into customFieldValues.
 * Returns empty string if no product-level fields are defined.
 */
export function buildFieldExtractionInstructions(
  productFieldDefs: Array<{
    fieldName: string;
    fieldType: string;
    appliesTo: string;
    options: string[];
  }>
): string {
  const productFields = productFieldDefs.filter(f => f.appliesTo === "product");

  if (productFields.length === 0) {
    return "";
  }

  const fieldList = productFields.map(f => {
    if (f.fieldType === "select" && f.options.length > 0) {
      return `${f.fieldName} (options: ${f.options.join(", ")})`;
    }
    return f.fieldName;
  }).join(", ");

  return `CUSTOM FIELDS EXTRACTION:
The shop owner's business has defined these custom product fields: ${fieldList}.
If any of these fields are mentioned in the input text, extract their values and place them in the "customFieldValues" object using the exact field name as the key.
Example: If the text says "Otto brand cotton shirt" and "Brand" is a defined field, set customFieldValues: {"Brand": "Otto"}.
If a field is not mentioned, do not include it in customFieldValues. Do not invent values.`;
}

/**
 * Shared parsing system prompt for product data extraction
 */
export const PRODUCT_PARSING_PROMPT = `You are extracting structured product data from a shop owner's informal, free-text description. The text may mix languages, skip punctuation, and describe multiple products in one paragraph.

BUSINESS TYPE CONTEXT: {{BUSINESS_TYPE}}
This business type determines which fields are relevant. Extract ONLY the fields that apply to this business type and follow its rules below. Do NOT invent fields that are not part of this business type's template.

BUSINESS TYPE RULES:
{{BUSINESS_TYPE_RULES}}

{{FIELD_EXTRACTION_INSTRUCTIONS}}

Return ONLY valid JSON, no preamble, no markdown fences. Schema:
{
  "products": [
    {
      "product_type": string,
      "categories": string[],
      "customFieldValues": {},
      "base_specifications": { [key: string]: string },
      "variant_dimensions": [
        { "name": string, "options": string[] }
      ],
      "variants": [
        {
          "attributes": { [key: string]: string },
          "attribute_value": string,
          "price_override": number | null,
          "stock": number | null
        }
      ],
      "price_inr": number | null,
      "raw_source_fragment": string,
      "sku": string | null
    }
  ],
  "unparsed_notes": string | null
}

CRITICAL NUMERAL VERIFICATION RULE:
- If price_inr is extracted from spelled-out numerals (any Indian language), you MUST echo back the digit-by-digit reconstruction as a reasoning step BEFORE outputting the final JSON.
- Example: If you see "எழுநூற்று ஐம்பது ரூபாய்" (Tamil), write "NUMERAL VERIFICATION: எழுநூற்று=700 + ஐம்பது=50 = 750 rupees" then output the JSON with price_inr: 750.
- If you see "ஆயிரத்து இருநூறு ரூபாய்" (Tamil), write "NUMERAL VERIFICATION: ஆயிரத்து=1000 + இருநூறு=200 = 1200 rupees" then output the JSON with price_inr: 1200.
- This helps catch silent errors - the raw output should show your verification work.

LANGUAGE NORMALIZATION RULE:
- product_type, variant attribute names, and variant values MUST be output in English regardless of input language.
- Preserve the original phrase in raw_source_fragment for the owner-facing confirmation screen.
- Example: Tamil "நீல நிற பருத்தி சேலை" should output product_type="cotton saree", variant_dimensions with name="Color", options=["blue"].
- GARMENT TRANSLATION GUIDANCE: Use standard English garment terminology. For example:
  * "சேலை", "புடவை" → "saree" (NOT "dupatta" or "veil")
  * "ப்ளவுஸ்", "செட்" → "blouse" (e.g., "ஜரிகை ப்ளவுஸ்" → "zari blouse")
  * "வேஷ்டு" → "vest", "சாக்ஸ்" → "sock", etc.
- For uncommon or unseen vocabulary, translate to the closest standard English equivalent based on
  context and linguistic similarity. When in doubt, transliterate phonetically to English.

PRODUCT TITLE & BRAND PRESERVATION RULE:
- product_type MUST preserve the full product name, title, brand prefix, or model identifier provided by the merchant in raw text (e.g., "abc pants" → product_type: "abc pants", "ABS pants" → product_type: "ABS pants", "STS shirt" → product_type: "STS shirt", "Otto shirt" → product_type: "Otto shirt").
- Do NOT drop short alphabetic prefixes, acronyms, or brand codes (like "abc", "ABS", "STS", "Otto") from product_type. Keep the full merchant-stated title.

VARIANT DETECTION & MULTI-DIMENSIONAL RULES:
- Identify distinct variant attributes and tokens as typed/spoken by the merchant (e.g., "Size", "Color", "Portion", "Prep", "Duration", "Fit", "Type").
- DISTINCT ATTRIBUTE COLUMN SEPARATION RULE: Every distinct attribute category or measurement type mentioned by the merchant MUST be extracted as its own separate dimension object in 'variant_dimensions'.
  - If numeric sizing (e.g. "size 32", "waist 34") appears alongside lettered sizes, fits, or types (e.g. "type L, M, S", "fit S, M, L", "sizes S, M, L"), extract them as TWO separate dimensions (e.g., [{"name": "Size", "options": ["32"]}, {"name": "Type", "options": ["L", "M", "S"]}] or [{"name": "Size", "options": ["32"]}, {"name": "Fit", "options": ["S", "M", "L"]}]).
  - NEVER lump numeric measurements and letter sizes/types together into a single dimension array like ["32", "L", "M", "S"]. Separate distinct attribute descriptors into distinct dimensions.
  - Preserve merchant labels ("Size", "Fit", "Type", "Color", "Waist", "Length", etc.). If no distinct label word is given for an attribute type, name numeric dimensions "Size" (or "Waist") and letter/fit dimensions "Fit" (or "Type").
- SINGLE-DIMENSION PRESERVATION RULE: If only 1 attribute dimension is mentioned (e.g. "sizes S M L" or "sizes 30 32 34"), output ONLY 1 dimension in variant_dimensions: [{"name": "Size", "options": ["S", "M", "L"]}]. Never force artificial secondary dimensions when only one attribute is present.
- ZERO-VARIANT PRESERVATION RULE: If no variants are mentioned, return empty variant_dimensions: [] and empty variants: [].
- 3-DIMENSION HARD CAP & OVERFLOW WARNING RULE: A product can have at most 3 variant dimensions. If 4 or more dimensions are described (e.g., Size, Color, Fabric, Finish), extract ONLY the top 3 most important dimensions into variant_dimensions. Do NOT silently discard overflow dimensions; append an explicit warning to unparsed_notes: "⚠️ Maximum 3 variant dimensions supported per product. Excluded dimension(s): Finish (matte, glossy). Consider adding them as custom fields."
- For multi-dimensional variants, compute the Cartesian product of variant_dimensions and output individual variant items. attribute_value for each variant must be a composite string joining attribute values with " / " (e.g. "L / Red").
- price_inr is the base price. If individual variants have different prices, set price_override on those variants.
- stock is null for services, digital goods, or unstated inventory quantities so merchant can configure stock in matrix editor.

SKU EXTRACTION RULE:
- If the source text contains an explicit SKU, product code, or catalog number (e.g. "SKU: ABC-123", "code: TSHIRT-001", "ref# 456"), extract it into the "sku" field.
- Only extract if it is clearly a product identifier. Do NOT invent SKUs.
- If no explicit SKU is present, set "sku" to null. The system will auto-generate one if needed.

Rules:
- If a price is not explicitly stated for a product, use null. Never guess a price.
- Keep variants attached to the correct product — do not let attributes from one product bleed into another.
- If a fragment of text doesn't clearly belong to any product, put it in unparsed_notes instead of forcing a guess.
- raw_source_fragment should be the exact substring this product was extracted from, for traceability.

LANGUAGE OUTPUT RULE:
- Return product_type and categories in {{LANGUAGE}}.
- Return customFieldValues in {{LANGUAGE}}.
- Keep all JSON keys, numbers, and the rest of the structure in English/unchanged.

Input (business type: {{BUSINESS_TYPE}}):
"{{OWNER_TEXT}}"`;

export interface ModelParseResult {
  model: string;
  raw_output: string;
  parsed: ParsedData | null;
  parse_success: boolean;
  error?: string;
  latency_ms?: number;
  finish_reason?: string;
  full_response?: any;
}

export interface ModelParseComparisonLog {
  id: string;
  input_text: string;
  model_name: string;
  raw_output: string;
  parsed_successfully: boolean;
  created_at: Date;
}

/**
 * Call Groq API with specified model
 */
async function callGroqModel(
  groq: Groq,
  model: string,
  ownerText: string
): Promise<ModelParseResult> {
  const startTime = Date.now();
  try {
    // Use fallback rules for comparison testing (no custom fields available)
    const fallbackRules = buildBusinessTypeRules("RETAIL", []);
    const userPrompt = PRODUCT_PARSING_PROMPT
      .replace("{{BUSINESS_TYPE}}", "RETAIL")
      .replace("{{BUSINESS_TYPE_RULES}}", fallbackRules)
      .replace("{{FIELD_EXTRACTION_INSTRUCTIONS}}", "")
      .replace("{{OWNER_TEXT}}", ownerText);
    
    const result = await groq.chat.completions.create({
      messages: [
        { role: "user", content: userPrompt }
      ],
      model,
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const rawOutput = result.choices[0]?.message?.content || "";
    const parsed = JSON.parse(rawOutput) as ParsedData;

    // Apply post-processing normalization
    const normalizedParsed: ParsedData = {
      ...parsed,
      products: normalizeProductsArray(parsed.products)
    };

    return {
      model,
      raw_output: rawOutput,
      parsed: normalizedParsed,
      parse_success: true,
      latency_ms: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      model,
      raw_output: "",
      parsed: null,
      parse_success: false,
      error: error.message,
      latency_ms: Date.now() - startTime,
    };
  }
}

/**
 * Call Sarvam AI chat completions API
 * Uses OpenAI-compatible chat completions endpoint
 */
async function callSarvamModel(
  apiKey: string,
  ownerText: string
): Promise<ModelParseResult> {
  const startTime = Date.now();
  try {
      const userPrompt = PRODUCT_PARSING_PROMPT
        .replace("{{BUSINESS_TYPE}}", "RETAIL")
        .replace("{{OWNER_TEXT}}", ownerText);
      
      const response = await fetch(SARVAM_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey,
      },
      body: JSON.stringify({
        model: "sarvam-30b",
        messages: [
          { 
            role: "system", 
            content: "Return ONLY valid JSON matching the provided schema. No explanations, no markdown." 
          },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sarvam API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    
    // Sarvam may return different response formats - handle OpenAI-compatible and native
    // Note: Sarvam may return content in reasoning_content when content is null
    let rawOutput: string | null = null;
    if (data.choices?.[0]?.message?.content) {
      rawOutput = data.choices[0].message.content;
    } else if (data.choices?.[0]?.message?.reasoning_content) {
      // Sarvam sometimes puts output in reasoning_content - extract the JSON from it
      const reasoning = data.choices[0].message.reasoning_content;
      
      // Use brace counting to find the FIRST complete balanced JSON object
      let firstValidJson: string | null = null;
      let depth = 0;
      let start = -1;
      
      for (let i = 0; i < reasoning.length; i++) {
        if (reasoning[i] === '{') {
          if (depth === 0) start = i;
          depth++;
        } else if (reasoning[i] === '}') {
          depth--;
          if (depth === 0 && start >= 0) {
            // Found a complete JSON object - check if it's valid and has products
            const candidate = reasoning.substring(start, i + 1);
            try {
              const parsed = JSON.parse(candidate);
              if (parsed.products && Array.isArray(parsed.products)) {
                firstValidJson = candidate;
                break; // Take the FIRST valid one
              }
            } catch (e) {
              // Not valid JSON or missing products, continue looking
            }
            start = -1;
          }
        }
      }
      rawOutput = firstValidJson;
    } else if (data.message?.content) {
      rawOutput = data.message.content;
    } else if (data.response) {
      rawOutput = data.response;
    }
    
    if (!rawOutput) {
      throw new Error(`Sarvam returned empty or unparsable response`);
    }
    
    // Extract finish_reason from the response for debugging
    const finishReason = data.choices?.[0]?.finish_reason || null;

    // Parse and apply post-processing normalization
    const parsed = JSON.parse(rawOutput) as ParsedData;
    const normalizedParsed: ParsedData = {
      ...parsed,
      products: normalizeProductsArray(parsed.products)
    };

    return {
      model: "sarvam-chat",
      raw_output: rawOutput,
      parsed: normalizedParsed,
      parse_success: true,
      latency_ms: Date.now() - startTime,
      finish_reason: finishReason,
      full_response: data,
    };
  } catch (error: any) {
    return {
      model: "sarvam-chat",
      raw_output: "",
      parsed: null,
      parse_success: false,
      error: error.message,
      latency_ms: Date.now() - startTime,
    };
  }
}

/**
 * Log comparison result to database
 */
async function logComparison(inputText: string, result: ModelParseResult): Promise<void> {
  // For now, just log to console - we can add DB logging later if needed
  console.log(`\n=== Model Parse Comparison Log ===`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Model: ${result.model}`);
  console.log(`Input: ${inputText.substring(0, 100)}...`);
  console.log(`Parse Success: ${result.parse_success}`);
  if (!result.parse_success) {
    console.log(`Error: ${result.error}`);
  }
  console.log(`Raw Output:\n${result.raw_output}`);
  console.log(`=== End Log ===\n`);
}

/**
 * Run product parsing comparison across multiple models in parallel
 */
export async function runParseComparison(ownerText: string): Promise<ModelParseResult[]> {
  const groqApiKey = process.env.GROQ_API_KEY;
  const sarvamApiKey = process.env.SARVAM_API_KEY;

  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY environment variable is required");
  }

  const groq = new Groq({ apiKey: groqApiKey });

  // Run all three model calls in parallel
  const results = await Promise.allSettled([
    // Groq llama-3.3-70b-versatile
    callGroqModel(groq, "llama-3.3-70b-versatile", ownerText),
    // Groq llama-3.1-8b-instant
    callGroqModel(groq, "llama-3.1-8b-instant", ownerText),
    // Sarvam chat
    sarvamApiKey 
      ? callSarvamModel(sarvamApiKey, ownerText)
      : Promise.resolve({
          model: "sarvam-chat",
          raw_output: "",
          parsed: null,
          parse_success: false,
          error: "SARVAM_API_KEY not configured"
        }),
  ]);

  // Process results and log them
  const comparisonResults: ModelParseResult[] = [];
  
  results.forEach((result, index) => {
    const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "sarvam-chat"];
    if (result.status === "fulfilled") {
      comparisonResults.push(result.value);
      logComparison(ownerText, result.value);
    } else {
      comparisonResults.push({
        model: models[index],
        raw_output: "",
        parsed: null,
        parse_success: false,
        error: result.reason?.message || "Unknown error",
      });
      logComparison(ownerText, comparisonResults[comparisonResults.length - 1]);
    }
  });

  return comparisonResults;
}