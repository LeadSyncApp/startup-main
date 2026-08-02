/**
 * Verification Script for Variant Column Separation Generalization
 * Tests 6 varied real phrasings against buildInitialSpreadsheetData
 * to prove generalization across different phrasings (with/without color, size/type/fit, numbers vs letter sizes).
 */

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

  const addDimension = (name: string, opts: string[]) => {
    if (!name || !opts || opts.length === 0) return;
    let colName = name;
    if (columns.includes(colName)) {
      colName = `${name} (${opts[0]})`;
    }
    columns.push(colName);
    optionMap.set(colName, opts);
  };

  // 1. Process variant_dimensions with automatic numeric vs letter size splitting safeguard
  if (product.variant_dimensions && product.variant_dimensions.length > 0) {
    for (const dim of product.variant_dimensions) {
      if (dim.name && dim.options && dim.options.length > 0) {
        const numOpts = dim.options.filter(o => /^\d+(\.\d+)?$/.test(o.trim()));
        const alphaOpts = dim.options.filter(o => !/^\d+(\.\d+)?$/.test(o.trim()));

        // If mixed numeric (32) and alpha (S, M, L) present in single dim array -> split into 2 separate columns!
        if (numOpts.length > 0 && alphaOpts.length > 0) {
          addDimension(dim.name, numOpts);
          addDimension(dim.name.toLowerCase() === "size" ? "Fit" : `${dim.name} Type`, alphaOpts);
        } else {
          addDimension(dim.name, dim.options);
        }
      }
    }
  }

  // 2. Process base_specifications separately (do NOT merge values into one column)
  if (product.base_specifications) {
    for (const [k, v] of Object.entries(product.base_specifications)) {
      if (!v) continue;
      addDimension(k, [v]);
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
          stock: null
        };
      });
      return { columns, rows };
    }
  }

  return { columns, rows: product.variants || [] };
}

// 6 Test inputs covering varied phrasings
const testCases: { name: string; input: ProductData }[] = [
  {
    name: "1. No color mentioned: 'crs shirts, rs 299, size 32, type l, m, s'",
    input: {
      product_type: "crs shirts",
      price_inr: 299,
      raw_source_fragment: "crs shirts, rs 299, size 32, type l, m, s",
      variant_dimensions: [
        { name: "Size", options: ["32"] },
        { name: "Type", options: ["L", "M", "S"] }
      ]
    }
  },
  {
    name: "2. Color present: 'abc pants, size 32, S/L/M, red'",
    input: {
      product_type: "abc pants",
      price_inr: 399,
      raw_source_fragment: "abc pants, size 32, S/L/M, red",
      base_specifications: { "Size": "32" },
      variant_dimensions: [
        { name: "Fit", options: ["S", "M", "L"] },
        { name: "Color", options: ["Red"] }
      ]
    }
  },
  {
    name: "3. Three dimensions: 'polo t-shirt, 499, size m, l, xl, fit regular, slim, colors black, white'",
    input: {
      product_type: "polo t-shirt",
      price_inr: 499,
      raw_source_fragment: "polo t-shirt, 499, size m, l, xl, fit regular, slim, colors black, white",
      variant_dimensions: [
        { name: "Size", options: ["M", "L", "XL"] },
        { name: "Fit", options: ["Regular", "Slim"] },
        { name: "Color", options: ["Black", "White"] }
      ]
    }
  },
  {
    name: "4. Numeric measurements: 'denim jeans 999 rupees waist 34, length 32, 34, dark blue'",
    input: {
      product_type: "denim jeans",
      price_inr: 999,
      raw_source_fragment: "denim jeans 999 rupees waist 34, length 32, 34, dark blue",
      variant_dimensions: [
        { name: "Waist", options: ["34"] },
        { name: "Length", options: ["32", "34"] },
        { name: "Color", options: ["Dark Blue"] }
      ]
    }
  },
  {
    name: "5. Numeric sizes only + color: 'cotton kurti rs 599, size 38, 40, 42, yellow'",
    input: {
      product_type: "cotton kurti",
      price_inr: 599,
      raw_source_fragment: "cotton kurti rs 599, size 38, 40, 42, yellow",
      variant_dimensions: [
        { name: "Size", options: ["38", "40", "42"] },
        { name: "Color", options: ["Yellow"] }
      ]
    }
  },
  {
    name: "6. Mixed single dimension fallback: 'size 32, S, M, L'",
    input: {
      product_type: "shirts",
      price_inr: 350,
      raw_source_fragment: "shirts, size 32, S, M, L",
      variant_dimensions: [
        { name: "Size", options: ["32", "S", "M", "L"] }
      ]
    }
  }
];

function runGeneralizationTests() {
  console.log("=========================================================================");
  console.log("GENERALIZATION VERIFICATION ACROSS 6 VARIED REAL PHRASINGS");
  console.log("=========================================================================\n");

  testCases.forEach((tc) => {
    console.log(`--- ${tc.name} ---`);
    const table = buildInitialSpreadsheetData(tc.input);
    console.log(`Columns (${table.columns.length}): ${table.columns.join(" | ")}`);
    console.log(`Rows Generated: ${table.rows.length}`);
    console.log("Rendered Table Output:");
    console.log(table.columns.join(" | ") + " | Price | Stock");
    console.log("-".repeat(50));
    table.rows.forEach((r) => {
      const colVals = table.columns.map((c) => r.attributes?.[c] ?? "").join(" | ");
      console.log(`${colVals} | ${r.price_override ?? tc.input.price_inr} | ${r.stock ?? "___"}`);
    });
    console.log("\n" + "-".repeat(73) + "\n");
  });
}

runGeneralizationTests();
