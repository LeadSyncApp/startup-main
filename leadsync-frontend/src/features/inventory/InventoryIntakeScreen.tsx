/**
 * Inventory Intake Screen - Multi-step visual framing & AI free-text intake
 * Calls POST /companies/:id/inventory/parse endpoint
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  PlusCircle,
  Lightbulb,
  ArrowRight,
  RotateCcw,
  Zap,
  Check,
  FileText
} from "lucide-react";
import { authedFetch } from "../../api/client";

export interface ProductVariantData {
  attribute_name: string;
  attribute_value: string;
  price_override: number | null;
  stock: number | null;
}

export interface ProductData {
  id?: string;
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
  hasVariants?: boolean;
  categories?: string[];
  imageUrl?: string | null;
  images?: any[];
  customFieldValues?: Record<string, any>;
}

interface IntakeResponse {
  products: ProductData[];
  unparsed_notes: string | null;
}

interface InventoryIntakeScreenProps {
  companyId?: string;
  onProceedToConfirm: (products: ProductData[]) => void;
}

const FORMAT_EXAMPLES = [
  "Cotton shirt, M/L/XL, 899 rs each",
  "Margherita pizza, small 200, medium 350"
];

export function InventoryIntakeScreen({ companyId, onProceedToConfirm }: InventoryIntakeScreenProps) {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("English");
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<IntakeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!text.trim()) {
      setError("Please enter some inventory text or select an example below.");
      return;
    }

    setIsParsing(true);
    setError(null);

    try {
      const response = await authedFetch(`/api/companies/${companyId}/inventory/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to parse inventory");
      }

      const result: IntakeResponse = await response.json();

      const mappedProducts = result.products.map(p => ({
        ...p,
        hasVariants: p.variants && p.variants.length > 0,
      }));

      const mappedResult = { ...result, products: mappedProducts };
      setParseResult(mappedResult);
      
      if (mappedResult.products.length > 0) {
        onProceedToConfirm(mappedResult.products);
      }
    } catch (err: any) {
      console.error("Parse API failed:", err.message);
      setError(err.message || "Failed to parse inventory. Please try again.");
      setParseResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddManualItem = () => {
    onProceedToConfirm([
      {
        brand: null,
        product_type: "",
        variants: [],
        attribute_name: null,
        description: null,
        price_inr: null,
        raw_source_fragment: "Manual Entry",
        hasVariants: false,
        categories: []
      }
    ]);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Multi-Step Wizard Navigation Header */}
      <div className="rounded-2xl p-4 sm:p-6 border backdrop-blur-sm shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider text-white" style={{ backgroundColor: 'var(--brand-saffron)' }}>
                Step 1 of 3
              </span>
              <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--app-text-muted)' }}>
                <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                AI Smart Assistant Active
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: 'var(--app-text)' }}>
              Add Products & Services
            </h1>
          </div>

          {/* Stepper Visual Pills */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border font-bold" style={{ backgroundColor: 'rgba(211, 107, 70, 0.12)', borderColor: 'var(--brand-saffron)', color: 'var(--brand-saffron)' }}>
              <span className="h-5 w-5 rounded-full bg-brand-saffron text-white flex items-center justify-center text-[10px] font-bold">1</span>
              <span>Intake</span>
            </div>
            <span style={{ color: 'var(--app-border)' }}>—</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border opacity-60" style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
              <span className="h-5 w-5 rounded-full border flex items-center justify-center text-[10px] font-bold" style={{ borderColor: 'var(--app-border)' }}>2</span>
              <span>Confirm</span>
            </div>
            <span style={{ color: 'var(--app-border)' }}>—</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border opacity-60" style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
              <span className="h-5 w-5 rounded-full border flex items-center justify-center text-[10px] font-bold" style={{ borderColor: 'var(--app-border)' }}>3</span>
              <span>Save</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dual-Pane Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Primary Pane: AI Free-Text Box */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl border space-y-5 shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-5 w-5" style={{ color: 'var(--brand-saffron)' }} />
                  <h2 className="text-lg font-bold" style={{ color: 'var(--app-text)' }}>
                    Just type it out as if you were talking to us
                  </h2>
                </div>
                <p className="text-xs sm:text-sm" style={{ color: 'var(--app-text-muted)' }}>
                  Describe your products, prices, variants, or services in plain natural language. AI parses your text into structured product data — brands, attributes, prices, and variants. Images are uploaded separately on the confirmation screen.
                </p>
              </div>
              <span
                className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: 'rgba(211, 107, 70, 0.1)', color: 'var(--brand-saffron)' }}
                title="AI parses your text into structured product data (names, prices, variants). It does not upload or generate images."
              >
                ✨ AI Powered
              </span>
            </div>

            {/* Format Guide */}
            <div className="pt-2">
              <label className="text-xs font-semibold flex items-center gap-1 mb-2" style={{ color: 'var(--app-text-muted)' }}>
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                Expected format — one product per line:
              </label>
              <div className="space-y-1.5">
                {FORMAT_EXAMPLES.map((example, idx) => (
                  <div
                    key={idx}
                    className="text-xs px-3 py-1.5 rounded-lg border font-mono"
                    style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
                  >
                    {example}
                  </div>
                ))}
              </div>
              <p className="text-[11px] mt-2" style={{ color: 'var(--app-text-muted)' }}>
                Product name, then attributes (size, color, duration, etc.), then price — comma-separated.
              </p>
            </div>

            {/* Input Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--app-text-muted)' }}>
                <span className="font-medium">Product / Service Free-Text Input</span>
                <div className="flex items-center gap-2">
                  <label className="font-medium" htmlFor="language-select">Output language:</label>
                  <select
                    id="language-select"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="px-2 py-1 rounded-lg border text-xs font-semibold cursor-pointer"
                    style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                  >
                    <option value="English">English</option>
                    <option value="Tamil">Tamil</option>
                    <option value="Telugu">Telugu</option>
                    <option value="Kannada">Kannada</option>
                    <option value="Malayalam">Malayalam</option>
                    <option value="Bengali">Bengali</option>
                  </select>
                  {text.length > 0 && (
                    <button
                      onClick={() => setText("")}
                      className="flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" /> Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder={"Type or paste your inventory descriptions here...\nExamples:\n• \"Otto full hand shirt black white navy M L XL 899 rupees\"\n• \"Haircut 30min 500rs, Haircut 60min 800rs\"\n• \"Pizza margherita small 200, medium 350, large 500\""}
                className="w-full px-4 py-3.5 rounded-xl border focus:ring-2 focus:ring-brand-saffron focus:outline-none transition-all text-sm font-sans"
                style={{
                  backgroundColor: 'var(--app-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              />
              <div className="flex justify-between items-center text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                <span>Supports multiple products separated by lines</span>
                <span>{text.length} characters</span>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3.5 rounded-xl border text-xs font-medium"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#dc2626' }}
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* CTA Button */}
            <div className="pt-2">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleParse}
                disabled={isParsing}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: 'var(--brand-saffron)' }}
              >
                {isParsing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>Extracting & Parsing Products...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Parse Inventory with AI</span>
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Right Secondary Pane: Alternate Entry Methods & Pro Tips */}
        <div className="space-y-6">
          {/* Card: Alternate Entry Methods */}
          <div className="p-6 rounded-2xl border space-y-4 shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
              <FileText className="h-4 w-4" style={{ color: 'var(--brand-saffron)' }} />
              Other Ways to Add
            </h3>

            {/* Manual Entry Button */}
            <button
              onClick={handleAddManualItem}
              className="w-full p-4 rounded-xl border flex items-center gap-3 text-left transition-all hover:scale-[1.01] cursor-pointer group"
              style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)' }}
            >
              <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(211, 107, 70, 0.1)', color: 'var(--brand-saffron)' }}>
                <PlusCircle className="h-5 w-5 transition-transform group-hover:scale-110" />
              </div>
              <div>
                <h4 className="text-xs font-bold" style={{ color: 'var(--app-text)' }}>
                  Manual Single Entry
                </h4>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                  Fill form fields directly step-by-step
                </p>
              </div>
            </button>

            {/* Import Excel / CSV Box */}
            <div
              className="w-full p-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center space-y-2 transition-all hover:border-brand-saffron cursor-pointer"
              style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)' }}
              onClick={() => alert("Excel / CSV batch import feature ready for file selection. Drag & drop file to import.")}
            >
              <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold" style={{ color: 'var(--app-text)' }}>
                  Import Excel / CSV
                </h4>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                  Upload `.xlsx` or `.csv` catalog files
                </p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded border" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
                Drag & Drop or Click
              </span>
            </div>
          </div>

          {/* Card: Pro Tips */}
          <div className="p-5 rounded-2xl border space-y-3" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            <h4 className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Pro Tips for High AI Accuracy
            </h4>
            <ul className="text-xs space-y-2 leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
              <li className="flex items-start gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Specify prices with currency symbols or "rs" / "rupees".</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>List attributes like sizes (S, M, L) or portions together on the same line.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Brand names at the beginning of lines help organize catalog search.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Parsed Products Live Preview Drawer/Cards */}
      <AnimatePresence>
        {parseResult && parseResult.products.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-6 rounded-2xl border space-y-4 shadow-sm"
            style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <h2 className="text-lg font-bold" style={{ color: 'var(--app-text)' }}>
                  Parsed Products Preview ({parseResult.products.length})
                </h2>
              </div>
              <button
                onClick={() => onProceedToConfirm(parseResult.products)}
                className="text-xs font-bold px-4 py-2 rounded-xl text-white flex items-center gap-1.5 shadow transition-transform hover:scale-[1.02] cursor-pointer"
                style={{ backgroundColor: 'var(--brand-saffron)' }}
              >
                <span>Proceed to Confirmation</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {parseResult.products.map((product, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border flex flex-col justify-between space-y-3"
                  style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)' }}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm" style={{ color: 'var(--app-text)' }}>
                        {product.brand && (
                          <span className="text-xs font-extrabold uppercase tracking-wide px-2 py-0.5 rounded mr-1.5" style={{ backgroundColor: 'rgba(211, 107, 70, 0.1)', color: 'var(--brand-saffron)' }}>
                            {product.brand}
                          </span>
                        )}
                        {product.product_type}
                      </h3>
                      {product.price_inr !== null && (
                        <span className="text-base font-extrabold shrink-0" style={{ color: 'var(--brand-saffron)' }}>
                          ₹{product.price_inr}
                        </span>
                      )}
                    </div>

                    {product.description && (
                      <p className="text-xs line-clamp-2" style={{ color: 'var(--app-text-muted)' }}>
                        {product.description}
                      </p>
                    )}

                    {product.variants && product.variants.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                          {product.attribute_name || "Variants"}:
                        </span>
                        {product.variants.map((v, vIdx) => (
                          <span key={vIdx} className="text-[10px] font-bold px-2 py-0.5 rounded border" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
                            {v.attribute_value} {v.price_override ? `(₹${v.price_override})` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t flex justify-end" style={{ borderColor: 'var(--app-border)' }}>
                    <button
                      onClick={() => onProceedToConfirm([product])}
                      className="text-xs font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                      style={{ color: 'var(--brand-saffron)' }}
                    >
                      Edit This Item →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
