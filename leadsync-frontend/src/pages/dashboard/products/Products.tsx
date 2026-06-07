import { useState, useEffect } from "react";
import { api } from "../../../lib/api";
import { Package, Plus, Sparkles, BrainCircuit, Box, Trash2, Wrench, X } from "lucide-react";
import { PageTransition } from "@/components/ui/Animations";
import { CommerceOnboardingSection } from "@/components/settings/CommerceOnboardingSection";
import { AdvancedTuningSection } from "@/components/settings/AdvancedTuningSection";
import toast from "react-hot-toast";

interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    category: string;
    stockQuantity: number;
    trackInventory: boolean;
    isActive: boolean;
}

interface MenuItem {
  name: string;
  price: number;
}

interface Category {
  name: string;
  items: MenuItem[];
}

interface StructuredMenu {
  categories: Category[];
}

export default function Products() {
    const [activeTab, setActiveTab] = useState<'CATALOG' | 'ONBOARDING' | 'AI_TUNING'>('CATALOG');
    
    // Product List State
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    
    // Form state
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [category, setCategory] = useState("");
    const [stockQuantity, setStockQuantity] = useState("");
    const [trackInventory, setTrackInventory] = useState(true);

    // Settings / Advanced State
    const [botBusinessType, setBotBusinessType] = useState("");
    const [botWelcomeMessage, setBotWelcomeMessage] = useState("");
    const [botKnowledgeBase, setBotKnowledgeBase] = useState("");
    const [botLearnedContext, setBotLearnedContext] = useState("");
    const [botPolicies, setBotPolicies] = useState("");
    const [isTraining, setIsTraining] = useState(false);

    // Onboarding State
    const [onboardingMode, setOnboardingMode] = useState<'PASTE' | 'MANUAL' | 'FILE'>('PASTE');
    const [shopDescription, setShopDescription] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [mergeWithExisting, setMergeWithExisting] = useState(true);
    const [previewMenu, setPreviewMenu] = useState<StructuredMenu | null>(null);

    // Edit Product State
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editName, setEditName] = useState("");
    const [editCategory, setEditCategory] = useState("");
    const [editPrice, setEditPrice] = useState("");
    const [editStockQuantity, setEditStockQuantity] = useState("");
    const [editTrackInventory, setEditTrackInventory] = useState(true);

    const handleStartEditProduct = (product: Product) => {
        setEditingProduct(product);
        setEditName(product.name);
        setEditCategory(product.category || "");
        setEditPrice(product.price.toString());
        setEditStockQuantity((product.stockQuantity ?? 999).toString());
        setEditTrackInventory(product.trackInventory);
    };

    const handleUpdateProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProduct) return;

        const toastId = toast.loading("Updating product...");
        try {
            await api.put(`/products/${editingProduct.id}`, {
                name: editName,
                description: editingProduct.description || "",
                price: parseFloat(editPrice) || 0,
                category: editCategory,
                stockQuantity: parseInt(editStockQuantity) || 0,
                trackInventory: editTrackInventory,
                isActive: editingProduct.isActive
            });

            toast.success("Product updated successfully! 📦", { id: toastId });
            setEditingProduct(null);
            const updatedList = await fetchProducts();
            handleSyncToKnowledge(updatedList);
        } catch (error: any) {
            toast.error(error.message || "Failed to update product", { id: toastId });
        }
    };

    const loadConfig = async () => {
        try {
            const configData = await api.get("/dashboard/bot-config");
            if (configData.company) {
                setBotBusinessType(configData.company.botBusinessType || "");
                setBotWelcomeMessage(configData.company.botWelcomeMessage || "");
                setBotKnowledgeBase(configData.company.botKnowledgeBase || "");
                setBotLearnedContext(configData.company.botLearnedContext || "");
                setBotPolicies(configData.company.botPolicies || "");
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const response = await api.get("/products");
            const data = response;
            const productList = Array.isArray(data) ? data : (data?.data && Array.isArray(data.data) ? data.data : []);
            setProducts(productList);
            return productList;
        } catch (error) {
            console.error(error);
            return [];
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'CATALOG') {
            fetchProducts();
        } else {
            loadConfig();
        }
    }, [activeTab]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!name.trim()) {
            toast.error("Product name is required");
            return;
        }

        const toastId = toast.loading("Creating product...");
        try {
            console.log("Submitting product:", { name, price, category, stockQuantity, trackInventory });
            const response = await api.post("/products", {
                name,
                description,
                price: parseFloat(price) || 0,
                category,
                stockQuantity: parseInt(stockQuantity) || 0,
                trackInventory
            });
            console.log("Product created successfully:", response);
            
            setShowForm(false);
            setName("");
            setDescription("");
            setPrice("");
            setCategory("");
            setStockQuantity("");
            setTrackInventory(true);
            
            const updatedList = await fetchProducts();
            
            // Auto-sync to AI Knowledge to keep both in sync as per user request
            handleSyncToKnowledge(updatedList);
            
            toast.success("Product created!", { id: toastId });
        } catch (error: any) {
            console.error("Error creating product:", error);
            const errorMsg = error.message || "Failed to create product";
            toast.error(errorMsg, { id: toastId });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this product?")) return;
        
        const toastId = toast.loading("Deleting product...");
        try {
            await api.delete(`/products/${id}`);
            const updatedList = await fetchProducts();
            
            // Auto-sync after deletion too
            handleSyncToKnowledge(updatedList);
            
            toast.success("Product deleted", { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete product", { id: toastId });
        }
    };

    const handleSyncToKnowledge = async (itemsToSync?: Product[]) => {
        const targetProducts = itemsToSync || products;
        
        if (targetProducts.length === 0) {
            console.log("No products to sync");
            return;
        }

        const toastId = toast.loading("Syncing catalog to AI knowledge...");
        try {
            // Group by category for a cleaner summary
            const categoriesMap: Record<string, string[]> = {};
            targetProducts.forEach(p => {
                const cat = p.category || "General";
                if (!categoriesMap[cat]) categoriesMap[cat] = [];
                categoriesMap[cat].push(`${p.name} (₹${p.price})`);
            });

            const summary = Object.entries(categoriesMap)
                .map(([cat, items]) => `${cat}: ${items.join(", ")}`)
                .join("\n");
            
            await api.patch("/dashboard/save-knowledge", {
                botKnowledgeBase: summary,
                botLearnedContext,
                botPolicies,
            });
            
            setBotKnowledgeBase(summary);
            toast.success("AI Knowledge updated from catalog!", { id: toastId });
        } catch (err) {
            toast.error("Failed to sync knowledge", { id: toastId });
        }
    };

    // --- Onboarding Handlers ---
    const handleAnalyzeSmartPaste = async () => {
        if (!shopDescription.trim()) return;
        setIsGenerating(true);
        const toastId = toast.loading("AI is normalizing your products...");
        try {
          const data = await api.post("/dashboard/analyze-menu", {
            rawText: shopDescription,
            mergeWithExisting: false
          });
          setPreviewMenu(data.menu);
          toast.success("Extraction complete! Review the preview below.", { id: toastId });
        } catch (err) {
          toast.error("Normalization failed. Please try a different format.", { id: toastId });
        } finally {
          setIsGenerating(false);
        }
    };

    const handleConfirmPreview = async () => {
        if (!previewMenu) return;
        
        const toastId = toast.loading("Syncing products to master catalog...");
        try {
          // Use the transactional dashboard endpoint instead of many individual POSTs
          // This ensures everything is saved correctly or nothing at all.
          await api.patch("/dashboard/save-edited-menu", {
              botBusinessType,
              botWelcomeMessage,
              structuredMenu: previewMenu,
              mergeProducts: mergeWithExisting
          });
          
          setPreviewMenu(null);
          setShopDescription("");
          
          toast.success("Catalog updated successfully! 🎉", { id: toastId });
          
          // Switch back to catalog to view items
          setActiveTab('CATALOG');
        } catch (err) {
          console.error(err);
          toast.error("Failed to sync catalog. Please try again.", { id: toastId });
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
    
        const toastId = toast.loading(`Uploading and analyzing ${file.name}...`);
    
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("mergeWithExisting", "false");
    
          const response = await api.post("/dashboard/upload-menu-file", formData);
    
          setPreviewMenu(response.menu);
          toast.success("File processed! Review the extracted items below.", { id: toastId });
        } catch (err: any) {
          toast.error(err.response?.data?.message || "Failed to process file", { id: toastId });
        } finally {
          e.target.value = "";
        }
    };

    const downloadCsvTemplate = () => {
        const csvContent = "Category,Name,Price\nCoffee,Cold Brew Coffee,250\nCoffee,Oat Milk Latte,300\nBakery,Cheddar Croissant,180";
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "menu_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const saveEditedMenu = async () => {
        try {
            await api.patch("/dashboard/save-edited-menu", {
              botBusinessType,
              botWelcomeMessage,
            });
            toast.success("Basic settings saved!");
        } catch {
            toast.error("Failed to save settings");
        }
    };

    // --- AI Tuning Handlers ---
    const handleTrainAI = async () => {
        if (!botKnowledgeBase.trim()) {
          toast.error("Enter items and descriptions first");
          return;
        }
        setIsTraining(true);
        const toastId = toast.loading("AI is learning your shop details...");
        try {
          const data = await api.post("/dashboard/train-ai", {
            botKnowledgeBase,
          });
          setBotLearnedContext(data.botLearnedContext);
          toast.success("AI Training complete! 🧠", { id: toastId });
        } catch (err) {
          toast.error("Training failed", { id: toastId });
        } finally {
          setIsTraining(false);
        }
    };
    
    const handleSaveKnowledge = async () => {
        try {
            await api.patch("/dashboard/save-knowledge", {
              botKnowledgeBase,
              botLearnedContext,
              botPolicies,
            });
            toast.success("Knowledge saved manually ✅");
        } catch {
            toast.error("Failed to save knowledge");
        }
    };

    return (
        <PageTransition className="h-[calc(100vh-6rem)] flex flex-col gap-4 lg:gap-6 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--app-text)]">Products & Knowledge</h1>
                    <p className="text-sm text-[var(--app-text-muted)] mt-1">
                        Manage your catalog, import menus, and teach the AI about your shop.
                    </p>
                </div>
            </div>

            {/* TAB NAVIGATION */}
            <div className="flex border-b border-app overflow-x-auto custom-scrollbar">
                <button
                    onClick={() => setActiveTab('CATALOG')}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'CATALOG' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                >
                    <Box className="w-4 h-4" /> Master Catalog
                </button>
                <button
                    onClick={() => setActiveTab('ONBOARDING')}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'ONBOARDING' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                >
                    <Sparkles className="w-4 h-4" /> Commerce Onboarding
                </button>
                <button
                    onClick={() => setActiveTab('AI_TUNING')}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'AI_TUNING' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                >
                    <BrainCircuit className="w-4 h-4" /> AI Shop Knowledge
                </button>
            </div>

            {/* TAB CONTENT: CATALOG */}
            {activeTab === 'CATALOG' && (
                <div className="flex flex-col gap-4 flex-1 h-full overflow-hidden">
                    <div className="flex justify-between items-center bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                                <Box className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-indigo-950">Master Catalog</h3>
                                <p className="text-xs text-indigo-600 font-medium">{products.length} Products configured</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => handleSyncToKnowledge()}
                                className="flex items-center gap-2 px-4 py-2 border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50 text-xs font-bold rounded-xl transition shadow-sm"
                            >
                                <Sparkles className="w-4 h-4" /> Sync to AI Knowledge
                            </button>
                            <button 
                                onClick={() => setShowForm(!showForm)} 
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg transition"
                            >
                                <Plus className="w-4 h-4" /> Add Product
                            </button>
                        </div>
                    </div>

                    {showForm && (
                        <div className="bg-app-surface p-6 rounded-2xl border border-app shadow-sm shrink-0">
                            <h2 className="text-lg font-bold mb-4">New Product</h2>
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Product Name</label>
                                        <input
                                            className="px-3 py-2 rounded-lg border border-app bg-app-bg text-sm outline-none focus:border-indigo-500"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category</label>
                                        <input
                                            className="px-3 py-2 rounded-lg border border-app bg-app-bg text-sm outline-none focus:border-indigo-500"
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Price (₹)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="px-3 py-2 rounded-lg border border-app bg-app-bg text-sm outline-none focus:border-indigo-500"
                                            value={price}
                                            onChange={(e) => setPrice(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stock Quantity</label>
                                        <input
                                            type="number"
                                            className="px-3 py-2 rounded-lg border border-app bg-app-bg text-sm outline-none focus:border-indigo-500"
                                            value={stockQuantity}
                                            placeholder="e.g. 100"
                                            onChange={(e) => setStockQuantity(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 mt-auto pb-2">
                                        <input
                                            type="checkbox"
                                            id="trackInventory"
                                            checked={trackInventory}
                                            onChange={(e) => setTrackInventory(e.target.checked)}
                                            className="w-4 h-4 rounded border-app bg-app-bg text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label htmlFor="trackInventory" className="text-sm font-medium text-[var(--app-text)]">
                                            Track Inventory
                                        </label>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-[var(--app-border)]">
                                    <button 
                                        onClick={() => setShowForm(false)} 
                                        type="button"
                                        className="px-4 py-2 border border-app rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg transition"
                                    >
                                        Create Product
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="bg-app-surface rounded-2xl border border-app shadow-sm overflow-hidden text-sm flex-1 flex flex-col min-h-0">
                        {loading ? (
                            <div className="p-8 text-center text-[var(--app-text-muted)] animate-pulse">
                                Loading catalog...
                            </div>
                        ) : products.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center justify-center h-full text-[var(--app-text-muted)]">
                                <Package className="w-12 h-12 mb-4 opacity-20" />
                                <p>No products found in the catalog.</p>
                                <p className="text-sm mt-1">Add your first product to start taking orders.</p>
                            </div>
                        ) : (
                            <div className="overflow-y-auto flex-1">
                                <table className="w-full text-left relative">
                                    <thead className="sticky top-0 bg-app-bg z-10 shadow-[0_1px_0_var(--app-border)]">
                                        <tr className="text-xs uppercase text-slate-500 tracking-wider">
                                            <th className="px-6 py-4 font-bold shrink-0">Product Details</th>
                                            <th className="px-6 py-4 font-bold">Category</th>
                                            <th className="px-6 py-4 font-bold text-right">Price</th>
                                            <th className="px-6 py-4 font-bold text-right">Stock</th>
                                            <th className="px-6 py-4 font-bold text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--app-border)] bg-app-surface">
                                        {products.map((product) => (
                                            <tr key={product.id} className="hover:bg-indigo-50/20 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-900">{product.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono tracking-tighter truncate max-w-[200px]">{product.id}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-wide">
                                                        {product.category || "General"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-black text-indigo-700 text-base">
                                                    ₹{product.price}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {product.trackInventory ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className={`text-sm font-bold ${product.stockQuantity <= 5 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                                {product.stockQuantity} units
                                                            </span>
                                                            <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                                                <div 
                                                                    className={`h-full ${product.stockQuantity <= 5 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                                                                    style={{ width: `${Math.min(100, product.stockQuantity)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-xs">Not tracked</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md hidden md:inline-block ${
                                                            product.isActive 
                                                                ? "bg-green-100 text-green-700" 
                                                                : "bg-red-100 text-red-700"
                                                        }`}>
                                                            {product.isActive ? "Active" : "Inactive"}
                                                        </span>
                                                        <button 
                                                            onClick={() => handleStartEditProduct(product)}
                                                            className="p-2 text-slate-350 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                            title="Edit & Restock Product"
                                                        >
                                                            <Wrench className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(product.id)}
                                                            className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                            title="Delete Product"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: ONBOARDING */}
            {activeTab === 'ONBOARDING' && (
                <div className="overflow-y-auto pb-12 custom-scrollbar">
                    <CommerceOnboardingSection 
                        onboardingMode={onboardingMode}
                        setOnboardingMode={setOnboardingMode}
                        shopDescription={shopDescription}
                        setShopDescription={setShopDescription}
                        isGenerating={isGenerating}
                        handleAnalyzeSmartPaste={handleAnalyzeSmartPaste}
                        mergeWithExisting={mergeWithExisting}
                        setMergeWithExisting={setMergeWithExisting}
                        handleFileUpload={handleFileUpload}
                        downloadCsvTemplate={downloadCsvTemplate}
                        botBusinessType={botBusinessType}
                        setBotBusinessType={setBotBusinessType}
                        botWelcomeMessage={botWelcomeMessage}
                        setBotWelcomeMessage={setBotWelcomeMessage}
                        saveEditedMenu={saveEditedMenu}
                        previewMenu={previewMenu}
                        setPreviewMenu={setPreviewMenu}
                        handleConfirmPreview={handleConfirmPreview}
                    />
                </div>
            )}

            {/* TAB CONTENT: AI TUNING */}
            {activeTab === 'AI_TUNING' && (
                <div className="overflow-y-auto pb-12 custom-scrollbar">
                    <AdvancedTuningSection 
                        botKnowledgeBase={botKnowledgeBase}
                        setBotKnowledgeBase={setBotKnowledgeBase}
                        botLearnedContext={botLearnedContext}
                        setBotLearnedContext={setBotLearnedContext}
                        isTraining={isTraining}
                        handleTrainAI={handleTrainAI}
                        handleSaveKnowledge={handleSaveKnowledge}
                        botPolicies={botPolicies}
                        setBotPolicies={setBotPolicies}
                        onSyncFromCatalog={() => handleSyncToKnowledge()}
                    />
                </div>
            )}
            {editingProduct && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 text-left">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                    <span>⚙️</span> Edit & Restock Product
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">Update price, category, or increase item units.</p>
                            </div>
                            <button 
                                onClick={() => setEditingProduct(null)}
                                className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateProduct} className="space-y-4 font-sans">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Product Name</label>
                                <input
                                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold outline-none focus:border-indigo-500 focus:bg-white transition"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category</label>
                                <input
                                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold outline-none focus:border-indigo-500 focus:bg-white transition"
                                    value={editCategory}
                                    onChange={(e) => setEditCategory(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Price (₹)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold outline-none focus:border-indigo-500 focus:bg-white transition"
                                        value={editPrice}
                                        onChange={(e) => setEditPrice(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Stock Quantity</label>
                                    <input
                                        type="number"
                                        className="px-3.5 py-2 rounded-xl border border-amber-200 bg-amber-50/40 text-amber-950 text-sm font-black outline-none focus:border-amber-500 focus:bg-white transition"
                                        value={editStockQuantity}
                                        onChange={(e) => setEditStockQuantity(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="editTrackInventory"
                                    checked={editTrackInventory}
                                    onChange={(e) => setEditTrackInventory(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label htmlFor="editTrackInventory" className="text-xs font-bold text-slate-600 cursor-pointer">
                                    Track Inventory & Auto-Deduct
                                </label>
                            </div>
                            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                                <button 
                                    onClick={() => setEditingProduct(null)} 
                                    type="button"
                                    className="px-4 py-2 hover:bg-slate-55 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg transition"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
        </PageTransition>
    );
}
