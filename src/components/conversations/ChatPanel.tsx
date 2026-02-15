/**
 * Chat Panel - Shared inbox chat per lead
 * Features:
 * - Framer Motion animations for message entrance (sliding, fade)
 * - Message sender badges with color-coded styling (lead, agent, auto)
 * - Manual & auto response toggle
 * - Auto-scroll to latest message
 * - Message grouping by date
 * - Timestamp formatting with Indian locale
 * - Attachment and read receipt placeholders
 * - Responsive layout with Tailwind CSS
 * - Smooth transitions and hover effects
 *
 * TODO: Supabase Realtime - Real-time message updates
 * When connected, implement real-time subscriptions:
 *   const channel = supabase
 *     .channel(`lead:${leadId}`)
 *     .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
 *       setMessages((prev) => [...prev, payload.new]);
 *       // Auto-scroll will trigger automatically due to useEffect dependency
 *     })
 *     .subscribe();
 *   Hook cleanup: supabase.removeChannel(channel);
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip } from 'lucide-react';
import type { Message, LeadPriority } from '../../types';

interface ChatPanelProps {
  leadId: string;
  leadName: string;
  leadEmail?: string;
  leadPriority?: LeadPriority;
  messages: Message[];
  onSendMessage: (content: string, isAuto: boolean) => void;
}

export default function ChatPanel({
  leadId: _leadId,
  leadName,
  leadEmail,
  leadPriority,
  messages,
  onSendMessage,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [useAuto, setUseAuto] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message when new messages arrive
  // TODO: Replace with Framer Motion scroll animation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim(), useAuto);
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const groupedMessages: Record<string, Message[]> = {};
  messages.forEach((msg) => {
    const date = new Date(msg.timestamp).toDateString();
    if (!groupedMessages[date]) groupedMessages[date] = [];
    groupedMessages[date].push(msg);
  });

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col rounded-xl border border-slate-200/50 bg-white shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header with lead info - enhanced styling */}
      <div className="flex flex-col justify-between border-b border-slate-200/50 bg-gradient-to-r from-slate-50 via-white to-cyan-50/30 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 shadow-sm">
        <div className="min-w-0 flex-1">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-bold text-slate-900 truncate">{leadName}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {leadEmail && <p className="text-xs text-slate-500 truncate">{leadEmail}</p>}
                  {leadPriority && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                        leadPriority === 'critical'
                          ? 'bg-red-100 text-red-700'
                          : leadPriority === 'high'
                          ? 'bg-amber-100 text-amber-700'
                          : leadPriority === 'medium'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {leadPriority}
                    </motion.span>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">🔒 Shared inbox — all agents see messages</p>
          </motion.div>
        </div>

        {/* Auto-response toggle */}
        <motion.label
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900 transition-colors py-2 sm:py-0 sm:whitespace-nowrap"
        >
          <input
            type="checkbox"
            checked={useAuto}
            onChange={(e) => setUseAuto(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
          />
          <span className="font-medium">Auto response</span>
        </motion.label>
      </div>

      {/* Messages Container - with enhanced padding and gradient background */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-white via-slate-50/50 to-white scroll-smooth"
      >
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="flex h-full flex-col items-center justify-center"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="text-6xl mb-4"
            >
              💬
            </motion.div>
            <p className="text-sm font-medium text-slate-500">No messages yet</p>
            <p className="text-xs text-slate-400 mt-1">Start the conversation by sending a message</p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {Object.entries(groupedMessages).map(([date, dateMessages]) => (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Date separator */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="flex items-center justify-center py-2 origin-center"
                >
                  <div className="border-t border-slate-300 flex-1"></div>
                  <span className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {new Date(date).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <div className="border-t border-slate-300 flex-1"></div>
                </motion.div>

                {/* Messages for this date with staggered animations */}
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.05,
                      },
                    },
                  }}
                  className="space-y-3"
                >
                  {dateMessages.map((m) => (
                    <motion.div
                      key={m.id}
                      variants={{
                        hidden: { opacity: 0, y: 20, x: m.sender === 'lead' ? -20 : 20 },
                        visible: {
                          opacity: 1,
                          y: 0,
                          x: 0,
                          transition: { type: 'spring', stiffness: 350, damping: 30 },
                        },
                      }}
                      className={`flex items-end gap-2 ${m.sender === 'lead' ? 'justify-start' : 'justify-end'}`}
                    >
                      {/* Message bubble with enhanced styling */}
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className={`flex flex-col gap-1 max-w-xs sm:max-w-sm md:max-w-md ${
                          m.sender === 'lead' ? 'items-start' : 'items-end'
                        }`}
                      >
                        {/* Sender badge */}
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 }}
                          className="px-3 py-1 flex items-center gap-1.5"
                        >
                          {m.sender === 'lead' && (
                            <>
                              <span className="inline-flex h-2 w-2 rounded-full bg-gray-400"></span>
                              <span className="text-xs font-semibold text-gray-600">Lead</span>
                            </>
                          )}
                          {m.sender === 'agent' && (
                            <>
                              <span className="inline-flex h-2 w-2 rounded-full bg-cyan-500 animate-pulse"></span>
                              <span className="text-xs font-semibold text-cyan-600">Agent</span>
                            </>
                          )}
                          {m.sender === 'auto' && (
                            <>
                              <span className="inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
                              <span className="text-xs font-semibold text-amber-600">Auto</span>
                            </>
                          )}
                        </motion.div>

                        {/* Message bubble */}
                        <motion.div
                          whileHover={{ boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                          className={`rounded-2xl px-4 py-2.5 transition-all duration-200 shadow-sm ${
                            m.sender === 'lead'
                              ? 'rounded-bl-none bg-slate-100 text-slate-900'
                              : m.sender === 'auto'
                              ? 'rounded-br-none bg-amber-100 text-amber-900'
                              : 'rounded-br-none bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-md'
                          }`}
                        >
                          <p className="text-sm break-words leading-normal">{m.content}</p>
                        </motion.div>

                        {/* Timestamp */}
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          className={`text-xs font-medium ${
                            m.sender === 'lead'
                              ? 'text-gray-500'
                              : m.sender === 'auto'
                              ? 'text-amber-600'
                              : 'text-cyan-600'
                          }`}
                        >
                          {new Date(m.timestamp).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </motion.p>
                      </motion.div>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            ))}
            {/* Auto-scroll anchor */}
            <div ref={messagesEndRef} />
          </AnimatePresence>
        )}
      </div>

      {/* Sticky Input Area - Enhanced styling */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="border-t border-slate-200/50 bg-gradient-to-t from-white to-slate-50/30 p-4 space-y-3 shadow-lg"
      >
        {/* Auto-response hint */}
        {useAuto && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 400 }}
            className="flex items-start gap-2 rounded-lg bg-gradient-to-r from-amber-50 to-amber-100/50 px-3 py-2.5 border border-amber-200/50 shadow-sm"
          >
            <span className="text-lg shrink-0 animate-pulse">⚡</span>
            <p className="text-xs text-amber-800 font-semibold leading-relaxed">
              Auto-response mode enabled: Template will send automatically after your message.
            </p>
          </motion.div>
        )}

        {/* Input controls with animation */}
        <motion.div
          layout
          className="flex gap-2"
        >
          <div className="flex-1 relative">
            <motion.input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              whileFocus={{ scale: 1.01 }}
              className="w-full rounded-lg border border-slate-300/50 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 caret-cyan-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all duration-150"
            />
          </div>

          {/* Attachment button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              // TODO: Implement attachment upload
            }}
            className="rounded-lg border border-slate-300/50 bg-white px-3 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 transition-all duration-150 shrink-0 shadow-sm"
            title="Attach file (future implementation)"
            aria-label="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </motion.button>

          {/* Send button */}
          <motion.button
            whileHover={{ scale: input.trim() ? 1.05 : 1 }}
            whileTap={{ scale: input.trim() ? 0.95 : 1 }}
            onClick={handleSend}
            disabled={!input.trim()}
            className="rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-700 px-4 py-2.5 text-white hover:from-cyan-700 hover:to-cyan-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shrink-0 font-semibold text-sm shadow-md hover:shadow-lg"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </motion.button>
        </motion.div>

        {/* Character count hint */}
        {input.length > 0 && input.length > 500 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-amber-600 font-medium"
          >
            Message is getting long ({input.length} chars)
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
