/**
 * Numeral Converter Utility - Convert spelled-out numerals from Indian languages to digits
 * 
 * This is a deterministic, regex/dictionary-based converter for Tamil and other Indian language
 * numerals, which is more reliable than LLM inference for this specific sub-task.
 * 
 * Note: Product name/color/size translation is handled by the LLM directly via prompt instructions,
 * not by this dictionary-based approach. This file ONLY handles numeral conversion.
 */

// Tamil numeral word to digit mapping (based on actual Tamil number patterns)
// Tamil numerals work additively: எழுநூற்று ஐம்பது = 700 + 50 = 750
const TAMIL_NUMERALS: Record<string, number> = {
  // Units (1-9)
  'ஒன்று': 1, 'ஒரு': 1,
  'இரண்டு': 2, 'இரு': 2,
  'மூன்று': 3, 'மூண்டு': 3,
  'நான்கு': 4,
  'ஐக்கு': 5,
  'ஆறு': 6,
  'எழு': 7,
  'எண்': 8,
  'ஒண்': 9,
  // Tens
  'பத்து': 10,
  'ஐம்பது': 50,
  // Multiples of 100 (note: these are combined forms)
  'இருநூறு': 200,
  'முந்நூறு': 300,
  'நானூறு': 400,
  'ஐம்பதுநூறு': 500,
  'ஆறுநூறு': 600,
  'எழுநூறு': 700, 'எழுநூற்று': 700,
  'எண்ணூறு': 800,
  'ஒனூறு': 900,
  // 100 and 1000 base units
  'நூறு': 100,
  'ஆயிரம்': 1000, 'ஆயிரத்து': 1000,
};

// Hindi/Devanagari numeral words to digits
const HINDI_NUMERALS: Record<string, number> = {
  'एक': 1,
  'दो': 2,
  'तीन': 3,
  'चार': 4,
  'पाँच': 5, 'पांच': 5,
  'छह': 6,
  'सात': 7,
  'आठ': 8,
  'नौ': 9,
  'दस': 10,
  'बीस': 20,
  'तीस': 30,
  'चालीस': 40,
  'पचास': 50,
  'साठा': 60,
  'सत्ता': 70,
  'अस्सी': 80,
  'नबैस': 90,
  'सौं': 100, 'सौ': 100,
  'हजार': 1000,
  'लाख': 100000,
  'करोड़': 10000000,
};

// Combine all Indian language numerals (closed, fixed set - appropriate for dictionary)
const ALL_INDIAN_NUMERALS: Record<string, number> = {
  ...TAMIL_NUMERALS,
  ...HINDI_NUMERALS,
};

/**
 * Convert spelled-out Tamil/Indian numeral words to a numeric value.
 * Handles compounds like "எழுநூற்று ஐம்பது" (700 + 50 = 750)
 * 
 * Pattern: Compound numbers add together in Tamil (e.g., எழுநூறு=700, ஐம்பது=50 → 750)
 */
export function convertIndianNumeralsToNumber(text: string): number | null {
  if (!text) return null;
  
  // Normalize the text - remove common suffixes and clean up
  const normalized = text.trim()
    .replace(/[.,;:!?]$/g, '')
    .replace(/\s+/g, ' ');
  
  // Try to match compound patterns like "எழுநூற்று ஐம்பது" (700 + 50)
  const parts = normalized.split(/\s+/);
  let total = 0;
  let foundAny = false;
  
  for (const part of parts) {
    const value = ALL_INDIAN_NUMERALS[part];
    if (value !== undefined) {
      total += value;
      foundAny = true;
    }
  }
  
  return foundAny ? total : null;
}

/**
 * Find and convert any spelled-out numerals in a text to digits.
 * Returns the converted number. Used for price extraction.
 */
export function extractAndConvertPriceNumeral(text: string): number | null {
  if (!text) return null;
  
  // Extract Tamil words from the text (Tamil Unicode block: U+0B80 to U+0BFF)
  const tamilWords = text.match(/[\u0B80-\u0BFF]+/g);
  if (tamilWords) {
    const converted = convertIndianNumeralsToNumber(tamilWords.join(' '));
    if (converted !== null && converted > 0) return converted;
  }
  
  // Extract Hindi words from the text
  const hindiWords = text.match(/[\u0900-\u097F]+/g);
  if (hindiWords) {
    const converted = convertIndianNumeralsToNumber(hindiWords.join(' '));
    if (converted !== null && converted > 0) return converted;
  }
  
  return null;
}

/**
 * Product variant data - flexible, business-agnostic
 */
export interface ProductVariantData {
  attribute_name: string;
  attribute_value: string;
  price_override: number | null;
  stock: number | null;
  sku?: string;
}

/**
 * Product data interface - business-agnostic
 */
export interface ProductData {
  brand: string | null;
  product_type: string;
  variants: ProductVariantData[];
  attribute_name: string | null;
  description: string | null;
  price_inr: number | null;
  raw_source_fragment: string;
  isAvailable?: boolean;
  sku?: string;
  colors?: string[];
  sizes?: string[];
  categories?: string[];
}

/**
 * ParsedData interface for complete parsed output
 */
export interface ParsedData {
  products: ProductData[];
  unparsed_notes: string | null;
}

/**
 * Normalized product data with optional correction info
 */
export interface NormalizedProductData extends ProductData {
  original_price_text?: string;
}

/**
 * Helper function to normalize an array of products
 */
export function normalizeProductsArray(products: ProductData[]): NormalizedProductData[] {
  return products.map((p: ProductData) => normalizeProductData(p));
}

/**
 * Comprehensive normalization of product data.
 * - Converts spelled-out numerals to digits in price_inr and variant price_override
 * - Does NOT translate product_type/variants (handled by LLM prompt)
 */
export function normalizeProductData(product: ProductData): NormalizedProductData {
  const result: NormalizedProductData = { ...product };
  
  // Check if price_inr is null but raw_source_fragment contains Tamil/Hindi numerals
  if (result.price_inr === null && result.raw_source_fragment) {
    const convertedPrice = extractAndConvertPriceNumeral(result.raw_source_fragment);
    if (convertedPrice !== null) {
      result.price_inr = convertedPrice;
    }
  } else if (result.price_inr !== null && result.raw_source_fragment) {
    const convertedPrice = extractAndConvertPriceNumeral(result.raw_source_fragment);
    if (convertedPrice !== null && convertedPrice !== result.price_inr) {
      result.original_price_text = `LLM extracted ${result.price_inr}, corrected to ${convertedPrice}`;
      result.price_inr = convertedPrice;
    }
  }

  // Normalize variant price_override via numeral conversion if raw_source_fragment has it
  if (result.variants && result.variants.length > 0 && result.price_inr !== null) {
    // If variants have no price_override, set them to base price
    result.variants = result.variants.map(v => ({
      ...v,
      price_override: v.price_override ?? result.price_inr
    }));
  }

  // Backward compat: if LLM returned old format (colors/sizes), convert to variants
  if ((!result.variants || result.variants.length === 0) && result.colors && result.colors.length > 0) {
    result.variants = result.colors.map(c => ({
      attribute_name: "Color",
      attribute_value: c,
      price_override: result.price_inr,
      stock: null
    }));
    result.attribute_name = "Color";
  }
  if ((!result.variants || result.variants.length === 0) && result.sizes && result.sizes.length > 0) {
    const sizeVariants = result.sizes.map(s => ({
      attribute_name: "Size",
      attribute_value: s,
      price_override: result.price_inr,
      stock: null
    }));
    result.variants = [...(result.variants || []), ...sizeVariants];
    result.attribute_name = result.attribute_name || "Size";
  }
  
  return result;
}