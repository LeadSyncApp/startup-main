import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Users,
  MessageSquare,
  ShoppingCart,
  Command,
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

interface SearchResult {
  type: "lead" | "conversation" | "order";
  id: string;
  title: string;
  subtitle: string;
  link: string;
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { token } = useAuth();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Keyboard shortcut: Ctrl+K / Cmd+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim() || !token) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const [leads, conversations, orders] = await Promise.all([
          api.get(`/leads?search=${encodeURIComponent(q)}&limit=5`).catch(() => []),
          api.get(`/conversations?search=${encodeURIComponent(q)}&limit=5`).catch(() => ({ items: [] })),
          api.get(`/orders?search=${encodeURIComponent(q)}&limit=5`).catch(() => []),
        ]);

        const mapped: SearchResult[] = [];

        // Leads
        (Array.isArray(leads) ? leads : []).slice(0, 5).forEach((l: any) => {
          mapped.push({
            type: "lead",
            id: l.id,
            title: l.name || l.contact || "Unknown",
            subtitle: `${l.channel || "—"} · ${l.segment || "NEW"}`,
            link: l.conversationId
              ? `/dashboard/conversations?conversationId=${l.conversationId}`
              : `/dashboard/leads`,
          });
        });

        // Conversations
        const convItems = conversations?.items || conversations || [];
        (Array.isArray(convItems) ? convItems : []).slice(0, 5).forEach((c: any) => {
          mapped.push({
            type: "conversation",
            id: c.id,
            title: c.lead?.name || c.lead?.contact || "Conversation",
            subtitle: c.lastMessage?.substring(0, 60) || "No messages",
            link: `/dashboard/conversations?conversationId=${c.id}`,
          });
        });

        // Orders
        (Array.isArray(orders) ? orders : []).slice(0, 5).forEach((o: any) => {
          mapped.push({
            type: "order",
            id: o.id,
            title: o.summary?.substring(0, 50) || `Order ${o.id.substring(0, 8)}`,
            subtitle: `${o.status} · ₹${o.amount || 0}`,
            link: `/dashboard/orders`,
          });
        });

        setResults(mapped);
        setSelectedIndex(0);
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      navigate(results[selectedIndex].link);
      setOpen(false);
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "lead":
        return <Users className="w-4 h-4 text-blue-500" />;
      case "conversation":
        return <MessageSquare className="w-4 h-4 text-green-500" />;
      case "order":
        return <ShoppingCart className="w-4 h-4 text-purple-500" />;
      default:
        return <Search className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-slate-400 text-sm transition-all group"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-mono text-slate-500">
          <Command className="w-3 h-3" />K
        </kbd>
      </button>

      {/* Modal overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
            onClick={() => setOpen(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Input */}
              <div className="flex items-center gap-3 px-4 border-b border-white/10">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search leads, conversations, orders..."
                  className="flex-1 py-4 bg-transparent text-white placeholder-slate-500 text-sm outline-none"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="text-slate-500 hover:text-slate-300">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                {loading && (
                  <div className="px-4 py-8 text-center text-slate-500 text-sm">
                    <div className="inline-block w-5 h-5 border-2 border-slate-600 border-t-cyan-400 rounded-full animate-spin" />
                  </div>
                )}

                {!loading && query && results.length === 0 && (
                  <div className="px-4 py-8 text-center text-slate-500 text-sm">
                    No results for "{query}"
                  </div>
                )}

                {!loading && results.length > 0 && (
                  <ul className="py-2">
                    {results.map((r, i) => (
                      <li
                        key={`${r.type}-${r.id}`}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          i === selectedIndex
                            ? "bg-white/10 text-white"
                            : "text-slate-300 hover:bg-white/5"
                        }`}
                        onClick={() => {
                          navigate(r.link);
                          setOpen(false);
                        }}
                        onMouseEnter={() => setSelectedIndex(i)}
                      >
                        {typeIcon(r.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.title}</p>
                          <p className="text-xs text-slate-500 truncate">{r.subtitle}</p>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-600 font-medium">
                          {r.type}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {!loading && !query && (
                  <div className="px-4 py-8 text-center text-slate-600 text-sm">
                    Type to search across leads, conversations, and orders
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 text-[10px] text-slate-600">
                <div className="flex items-center gap-3">
                  <span><kbd className="px-1 py-0.5 bg-white/10 rounded">↑↓</kbd> navigate</span>
                  <span><kbd className="px-1 py-0.5 bg-white/10 rounded">↵</kbd> select</span>
                  <span><kbd className="px-1 py-0.5 bg-white/10 rounded">esc</kbd> close</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
