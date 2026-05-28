import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Users, MessageSquare, ShoppingCart, Command } from "lucide-react";
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

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    setQuery("");
    setResults([]);
    setSelectedIndex(0);

    return () => clearTimeout(timer);
  }, [open]);

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

        (Array.isArray(leads) ? leads : []).slice(0, 5).forEach((lead: any) => {
          mapped.push({
            type: "lead",
            id: lead.id,
            title: lead.name || lead.contact || "Unknown",
            subtitle: `${lead.channel || "—"} · ${lead.segment || "NEW"}`,
            link: lead.conversationId
              ? `/dashboard/conversations?conversationId=${lead.conversationId}`
              : "/dashboard/leads",
          });
        });

        const convItems = conversations?.items || conversations || [];
        (Array.isArray(convItems) ? convItems : []).slice(0, 5).forEach((conversation: any) => {
          mapped.push({
            type: "conversation",
            id: conversation.id,
            title: conversation.lead?.name || conversation.lead?.contact || "Conversation",
            subtitle: conversation.lastMessage?.substring(0, 60) || "No messages",
            link: `/dashboard/conversations?conversationId=${conversation.id}`,
          });
        });

        (Array.isArray(orders) ? orders : []).slice(0, 5).forEach((order: any) => {
          mapped.push({
            type: "order",
            id: order.id,
            title: order.summary?.substring(0, 50) || `Order ${order.id.substring(0, 8)}`,
            subtitle: `${order.status} · ₹${order.amount || 0}`,
            link: "/dashboard/orders",
          });
        });

        setResults(mapped);
        setSelectedIndex(0);
      } catch (error) {
        console.error("Search failed", error);
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
      setSelectedIndex((current) => Math.min(current + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((current) => Math.max(current - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      navigate(results[selectedIndex].link);
      setOpen(false);
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "lead":
        return <Users className="w-4 h-4 text-cyan-500" />;
      case "conversation":
        return <MessageSquare className="w-4 h-4 text-emerald-500" />;
      case "order":
        return <ShoppingCart className="w-4 h-4 text-violet-500" />;
      default:
        return <Search className="w-4 h-4 text-[var(--app-text-muted)]" />;
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-[var(--app-bg-soft)] hover:bg-[var(--app-bg-soft)]/80 border border-[var(--app-border)] rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] text-sm transition-all group"
      >
        <Search className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-[var(--app-text)]" />
        <span className="hidden sm:inline font-medium">Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[var(--app-border)]/50 rounded text-[10px] font-mono text-[var(--app-text-muted)]">
          <Command className="w-3 h-3" />K
        </kbd>
      </button>

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
            <div className="absolute inset-0 bg-[var(--app-backdrop)] backdrop-blur-sm" />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl shadow-2xl overflow-hidden text-[var(--app-text)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 border-b border-[var(--app-border)]">
                <Search className="w-5 h-5 text-[var(--app-text-muted)]" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search leads, conversations, orders..."
                  className="flex-1 py-4 bg-transparent text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] text-sm outline-none"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="text-[var(--app-text-muted)] hover:text-[var(--app-text)]">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                {loading && (
                  <div className="px-4 py-8 text-center text-[var(--app-text-muted)] text-sm">
                    <div className="inline-block w-5 h-5 border-2 border-[var(--app-border)] border-t-cyan-600 rounded-full animate-spin" />
                  </div>
                )}

                {!loading && query && results.length === 0 && (
                  <div className="px-4 py-8 text-center text-[var(--app-text-muted)] text-sm">
                    No results for "{query}"
                  </div>
                )}

                {!loading && results.length > 0 && (
                  <ul className="py-2">
                    {results.map((result, index) => (
                      <li
                        key={`${result.type}-${result.id}`}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          index === selectedIndex
                            ? "bg-cyan-50 text-[var(--app-text)] font-medium dark:bg-cyan-500/10"
                            : "text-[var(--app-text-muted)] hover:bg-[var(--app-bg-soft)]"
                        }`}
                        onClick={() => {
                          navigate(result.link);
                          setOpen(false);
                        }}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        {typeIcon(result.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{result.title}</p>
                          <p className="text-xs text-[var(--app-text-muted)] truncate mt-0.5">{result.subtitle}</p>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-[var(--app-text-muted)] font-medium bg-[var(--app-bg-soft)] px-1.5 py-0.5 rounded">
                          {result.type}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {!loading && !query && (
                  <div className="px-4 py-8 text-center text-[var(--app-text-muted)] text-sm">
                    Type to search across leads, conversations, and orders
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--app-border)] text-[10px] text-[var(--app-text-muted)] bg-[var(--app-bg-soft)]/50">
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    <kbd className="px-1 py-0.5 bg-[var(--app-surface)] border border-[var(--app-border)] rounded text-[var(--app-text-muted)] font-medium">↑↓</kbd> navigate
                  </span>
                  <span>
                    <kbd className="px-1 py-0.5 bg-[var(--app-surface)] border border-[var(--app-border)] rounded text-[var(--app-text-muted)] font-medium">↵</kbd> select
                  </span>
                  <span>
                    <kbd className="px-1 py-0.5 bg-[var(--app-surface)] border border-[var(--app-border)] rounded text-[var(--app-text-muted)] font-medium">esc</kbd> close
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
