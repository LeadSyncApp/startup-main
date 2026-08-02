/**
 * Verification Script for:
 * 1. Part A: Column-separated Spreadsheet Table Data Generation for Test Cases
 * 2. Part B: Proactive In-Stock Variant Recommendation in AI Chat Reply
 */

import { generateShopReply } from "../../src/services/ai/ai.service";
import { tenantContextStorage, TenantContext } from "../../src/services/context/tenantContext.provider";

interface ProductVariantData {
  attribute_value: string;
  attributes?: Record<string, string>;
  price_override: number | null;
  stock: number | null;
}

interface ProductData {
  product_type: string;
  price_inr: number | null;
  raw_source_fragment: string;
  base_specifications?: Record<string, string>;
  variant_dimensions?: { name: string; options: string[] }[];
  variants?: ProductVariantData[];
}

interface SpreadsheetTableData {
  columns: string[];
  rows: ProductVariantData[];
}

function buildInitialSpreadsheetData(product: ProductData): SpreadsheetTableData {
  const columns: string[] = [];
  const optionMap = new Map<string, string[]>();

  // 1. Process variant_dimensions
  if (product.variant_dimensions && product.variant_dimensions.length > 0) {
    for (const dim of product.variant_dimensions) {
      if (dim.name && dim.options && dim.options.length > 0) {
        let colName = dim.name;
        if (columns.includes(colName)) {
          colName = `${dim.name} (${dim.options[0] || '2'})`;
        }
        columns.push(colName);
        optionMap.set(colName, dim.options);
      }
    }
  }

  // 2. Process base_specifications separately (do NOT merge values into one column)
  if (product.base_specifications) {
    for (const [k, v] of Object.entries(product.base_specifications)) {
      if (!v) continue;
      let colName = k;
      if (columns.includes(colName)) {
        colName = `${k} (${v})`;
      }
      columns.push(colName);
      optionMap.set(colName, [v]);
    }
  }

  // 3. Fallback to keys in product.variants if columns still empty
  if (columns.length === 0 && product.variants && product.variants.length > 0) {
    const keys = new Set<string>();
    product.variants.forEach(v => {
      if (v.attributes) {
        Object.keys(v.attributes).forEach(k => keys.add(k));
      }
    });
    if (keys.size > 0) {
      columns.push(...Array.from(keys));
    }
  }

  // 4. If product.variants already has populated rows with attributes matching existing state
  if (product.variants && product.variants.length > 0 && product.variants.some(v => v.attributes && Object.keys(v.attributes).length > 0)) {
    const rows = product.variants.map(v => {
      const attributes: Record<string, string> = { ...(v.attributes || {}) };
      columns.forEach(col => {
        if (!(col in attributes)) attributes[col] = "";
      });
      return {
        ...v,
        attributes,
        price_override: v.price_override ?? product.price_inr,
        stock: v.stock ?? null
      };
    });
    return { columns, rows };
  }

  // 5. Compute Cartesian product across optionMap
  if (columns.length > 0 && optionMap.size > 0) {
    const optionArrays = columns.map(col => optionMap.get(col) || []);
    if (optionArrays.every(arr => arr.length > 0)) {
      const cartesian = (args: string[][]): string[][] =>
        args.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())), [[]] as string[][]);

      const combinations = cartesian(optionArrays);
      const rows: ProductVariantData[] = combinations.map(combo => {
        const attributes: Record<string, string> = {};
        columns.forEach((col, idx) => {
          attributes[col] = combo[idx];
        });
        const compositeLabel = combo.join(" - ");
        return {
          attribute_value: compositeLabel,
          attributes,
          price_override: product.price_inr ?? null,
          stock: null // Stock is always blank by default!
        };
      });
      return { columns, rows };
    }
  }

  // Fallback: return empty columns and existing rows
  return { columns, rows: product.variants || [] };
}

async function runVerification() {
  console.log("=========================================================================");
  console.log("PART A: FRONTEND SPREADSHEET TABLE GENERATION VERIFICATION");
  console.log("=========================================================================\n");

  // Test Case 1: T-shirt, sizes M and L, colors red and blue, 500 rupees
  const test1Input: ProductData = {
    product_type: "T-shirt",
    price_inr: 500,
    raw_source_fragment: "T-shirt, sizes M and L, colors red and blue, 500 rupees",
    variant_dimensions: [
      { name: "Size", options: ["M", "L"] },
      { name: "Color", options: ["Red", "Blue"] }
    ],
    variants: []
  };

  const table1 = buildInitialSpreadsheetData(test1Input);
  console.log("--- TEST CASE 1: 'T-shirt, sizes M and L, colors red and blue, 500 rupees' ---");
  console.log(`Columns (${table1.columns.length}):`, table1.columns.join(" | "));
  console.log(`Rows generated: ${table1.rows.length}\n`);
  console.log("Literal Rendered Table Contents:");
  console.log("# | " + table1.columns.join(" | ") + " | Price (₹) | Stock Qty");
  console.log("-".repeat(50));
  table1.rows.forEach((r: ProductVariantData, idx: number) => {
    const colVals = table1.columns.map((c: string) => r.attributes?.[c] ?? "").join(" | ");
    const price = r.price_override ?? test1Input.price_inr;
    const stock = r.stock ?? "___";
    console.log(`${idx + 1} | ${colVals} | ${price} | ${stock}`);
  });

  console.log("\n" + "=".repeat(73) + "\n");

  // Test Case 2: abc pants, size 32, S/L/M, red
  const test2Input: ProductData = {
    product_type: "abc pants",
    price_inr: 399,
    raw_source_fragment: "abc pants, size 32, S/L/M, red",
    base_specifications: { "Size": "32" },
    variant_dimensions: [
      { name: "Fit", options: ["S", "M", "L"] },
      { name: "Color", options: ["Red"] }
    ],
    variants: []
  };

  const table2 = buildInitialSpreadsheetData(test2Input);
  console.log("--- TEST CASE 2: 'abc pants, size 32, S/L/M, red' ---");
  console.log(`Columns (${table2.columns.length}):`, table2.columns.join(" | "));
  console.log(`Rows generated: ${table2.rows.length}\n`);
  console.log("Literal Rendered Table Contents:");
  console.log("Size (32) | Fit | Color | Price | Stock");
  console.log("-".repeat(50));
  table2.rows.forEach((r: ProductVariantData) => {
    const colVals = table2.columns.map((c: string) => r.attributes?.[c] ?? "").join(" | ");
    const price = r.price_override ?? test2Input.price_inr;
    const stock = r.stock ?? "___";
    console.log(`${colVals} | ${price} | ${stock}`);
  });

  console.log("\n" + "=".repeat(73) + "\n");

  // Test Case 3: STS shirt
  const test3Input: ProductData = {
    product_type: "STS shirt",
    price_inr: 450,
    raw_source_fragment: "STS shirt",
    variant_dimensions: [],
    variants: []
  };

  const table3 = buildInitialSpreadsheetData(test3Input);
  console.log("--- TEST CASE 3: 'STS shirt' ---");
  console.log(`Columns (${table3.columns.length}):`, table3.columns.length > 0 ? table3.columns.join(" | ") : "[No variant columns]");
  console.log(`Rows generated: ${table3.rows.length}`);
  console.log("Literal Rendered Table Contents:");
  if (table3.rows.length === 0) {
    console.log("[Empty table with '+ Add Column' and '+ Add Row' controls ready]");
  } else {
    table3.rows.forEach((r: ProductVariantData, idx: number) => {
      const colVals = table3.columns.map((c: string) => r.attributes?.[c] ?? "").join(" | ");
      console.log(`${idx + 1} | ${colVals || "Standard"} | ${r.price_override ?? test3Input.price_inr} | ${r.stock ?? "___"}`);
    });
  }

  console.log("\n=========================================================================");
  console.log("PART B: CUSTOMER AI PROACTIVE OOS VARIANT RECOMMENDATION VERIFICATION");
  console.log("=========================================================================\n");

  // Mock product scenario with 1 OOS variant (Large-Red) and 1 IN_STOCK variant (Medium-Red)
  const mockMenuSnapshot = `Matched Product: Red Dress — Confidence: HIGH
Available Variants & Live Stock Breakdown:
  - Variant "Red - Large": Price ₹1200, Stock: 0 units (OUT_OF_STOCK)
  - Variant "Red - Medium": Price ₹1200, Stock: 8 units (IN_STOCK)
  - Variant "Red - Small": Price ₹1200, Stock: 15 units (IN_STOCK)`;

  const mockMatchedProduct = {
    productId: "mock-dress-uuid",
    name: "Red Dress",
    variant: "Red - Large",
    stock: 23,
    stockStatus: "OUT_OF_STOCK",
    score: 0.95,
    confidenceTier: "HIGH",
    matchReason: "Matches requested red dress in Large size",
    variants: [
      { attributeValue: "Red - Large", price: 1200, stock: 0, stockStatus: "OUT_OF_STOCK" },
      { attributeValue: "Red - Medium", price: 1200, stock: 8, stockStatus: "IN_STOCK" },
      { attributeValue: "Red - Small", price: 1200, stock: 15, stockStatus: "IN_STOCK" }
    ]
  };

  const customerQuery = "do you have red dress in Large?";
  console.log(`Customer Message: "${customerQuery}"`);
  console.log("Mock Menu Snapshot provided to LLM:\n" + mockMenuSnapshot + "\n");

  console.log("Generating AI shop reply...");

  const mockContext: TenantContext = {
    companyId: "mock-company-id",
    currencyCode: "INR",
    currencySymbol: "₹",
    timezone: "Asia/Kolkata",
    priorityRules: null,
    templates: {},
    aiModelTarget: "llama-3.1-8b-instant",
    outputProtocolSchema: "JSON_ONLY"
  };

  await tenantContextStorage.run(mockContext, async () => {
    try {
      const aiResponse = await generateShopReply({
        tenant_id: "mock-company-id",
        user_message: customerQuery,
        menu_snapshot: mockMenuSnapshot,
        matched_product: mockMatchedProduct,
        detected_language: "en",
        conversation_history: []
      });

      console.log("\n-------------------------------------------------------------------------");
      console.log("LITERAL AI RESPONSE TEXT:");
      console.log("-------------------------------------------------------------------------");
      console.log(`"${aiResponse.replyText}"`);
      console.log("-------------------------------------------------------------------------");
    } catch (err: any) {
      console.error("AI Generation Error:", err.message);
    }
  });

  process.exit(0);
}

runVerification().catch(console.error);
