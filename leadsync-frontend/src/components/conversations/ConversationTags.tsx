/**
 * ConversationTags — lightweight, localStorage-based colour-chip tag system.
 *
 * Exports
 *  • useConversationTags()   — hook to read/write tags per conversation
 *  • TagChips                — read-only tiny chips for the conversation list
 *  • TagPicker               — floating popover to toggle tags; add in chat header
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tag, X } from "lucide-react";

// ─── Config ─────────────────────────────────────────────────────────────────

export const PREDEFINED_TAGS = [
  { id: "follow_up",  label: "Follow-up",  color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { id: "hot_lead",   label: "Hot Lead",   color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  { id: "vip",        label: "VIP",        color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  { id: "support",    label: "Support",    color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  { id: "spam",       label: "Spam",       color: "bg-background-elevated text-text-muted border-border" },
  { id: "pending",    label: "Pending",    color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { id: "resolved",   label: "Resolved",   color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { id: "escalated",  label: "Escalated",  color: "bg-red-500/10 text-red-400 border-red-500/20" },
] as const;

type TagId = typeof PREDEFINED_TAGS[number]["id"];

// ─── Hook ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = "leadsync_conv_tags";

function loadAll(): Record<string, TagId[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, TagId[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Singleton subscription to force re-renders across hook instances
const listeners = new Set<() => void>();
function notifyAll() { listeners.forEach(fn => fn()); }

export function useConversationTags(convId: string) {
  const [, rerender] = useState(0);

  // Subscribe to cross-instance updates
  const subscribe = useCallback(() => {
    const fn = () => rerender(n => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useState(subscribe);

  const getTags = (): TagId[] => loadAll()[convId] || [];

  const toggle = (tagId: TagId) => {
    const all = loadAll();
    const current = all[convId] || [];
    const next = current.includes(tagId)
      ? current.filter(t => t !== tagId)
      : [...current, tagId];
    if (next.length === 0) {
      delete all[convId];
    } else {
      all[convId] = next;
    }
    saveAll(all);
    notifyAll();
  };

  const clear = () => {
    const all = loadAll();
    delete all[convId];
    saveAll(all);
    notifyAll();
  };

  return { tags: getTags(), toggle, clear };
}

// ─── TagChips — read-only display in conversation list ──────────────────────

interface TagChipsProps {
  convId: string;
  max?: number;
}

export function TagChips({ convId, max = 2 }: TagChipsProps) {
  const { tags } = useConversationTags(convId);
  if (tags.length === 0) return null;

  const visible = tags.slice(0, max);
  const overflow = tags.length - max;
  const lookup = Object.fromEntries(PREDEFINED_TAGS.map(t => [t.id, t]));

  return (
    <span className="flex items-center gap-1 flex-wrap">
      {visible.map(id => {
        const tag = lookup[id];
        if (!tag) return null;
        return (
          <span key={id} className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${tag.color}`}>
            {tag.label}
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-background-elevated text-text-muted border-border">
          +{overflow}
        </span>
      )}
    </span>
  );
}

// ─── TagPicker — popover for chat header ────────────────────────────────────

interface TagPickerProps {
  convId: string;
  onClose: () => void;
}

export function TagPicker({ convId, onClose }: TagPickerProps) {
  const { tags, toggle } = useConversationTags(convId);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.97 }}
        transition={{ duration: 0.15 }}
        className="absolute right-0 top-full mt-2 w-56 bg-background-secondary rounded-2xl shadow-2xl border border-border p-3 z-50"
      >
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[10px] font-black text-text-disabled uppercase tracking-widest">Tag conversation</span>
          <button onClick={onClose} className="p-1 hover:bg-background-tertiary rounded-lg transition text-text-disabled hover:text-text-primary">
            <X size={12} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {PREDEFINED_TAGS.map(tag => {
            const active = tags.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggle(tag.id)}
                className={`text-[10px] font-bold px-2 py-1.5 rounded-xl border text-left transition active:scale-95 ${
                  active
                    ? `${tag.color} ring-1 ring-offset-1 ring-current`
                    : "bg-background-secondary text-text-muted border-border hover:border-text-disabled"
                }`}
              >
                {active ? "✓ " : ""}{tag.label}
              </button>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── TagButton — icon button that opens the picker ──────────────────────────

interface TagButtonProps {
  convId: string;
}

export function TagButton({ convId }: TagButtonProps) {
  const [open, setOpen] = useState(false);
  const { tags } = useConversationTags(convId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Tag conversation"
        className={`p-2.5 rounded-2xl transition active:scale-90 relative ${
          tags.length > 0
            ? "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20"
            : "bg-background-tertiary text-text-muted hover:bg-background-elevated"
        }`}
      >
        <Tag size={16} />
        {tags.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-indigo-500 text-white text-[9px] font-black flex items-center justify-center">
            {tags.length}
          </span>
        )}
      </button>
      {open && (
        <>
          {/* Click-away */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="z-50 relative">
            <TagPicker convId={convId} onClose={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}
