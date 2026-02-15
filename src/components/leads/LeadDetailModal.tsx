/**
 * Lead Detail Modal - Full lead info with tabs (Details, Notes, Conversations)
 * Features:
 * - Framer Motion animations for modal entrance, tab transitions, and content
 * - Inline editing for notes with smooth transitions
 * - Confirmation prompt before delete actions with fade animation
 * - Tab switching with animated content transitions
 * - Message history with staggered animations
 * - Realtime placeholder: When Supabase Realtime is connected, messages will
 *   update dynamically. Parent should pass latest messages from shared inbox.
 * - Responsive form inputs with focus ring animations
 * - Color-coded priority badges with hover effects
 *
 * BACKEND PLACEHOLDER: Supabase queries replacements:
 *   - Update notes: supabase.from('leads').update({ notes }).eq('id', leadId)
 *   - Delete lead: supabase.from('leads').delete().eq('id', leadId)
 *   - Assign agent: supabase.from('leads').update({ agent_id }).eq('id', leadId)
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import { formatDateIN } from '../../utils/formatINR';
import type { Lead, Message, User } from '../../types';

interface LeadDetailModalProps {
  lead: Lead | null;
  agents: User[];
  messages: Message[];
  onClose: () => void;
  onAssignAgent: (leadId: string, agentId: string) => void;
  onAddNote: (leadId: string, note: string) => void;
}

export default function LeadDetailModal({
  lead,
  agents,
  messages,
  onClose,
  onAssignAgent,
  onAddNote,
}: LeadDetailModalProps) {
  const [newNote, setNewNote] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'notes' | 'conversations'>('details');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);

  if (!lead) return null;

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    onAddNote(lead.id, newNote.trim());
    setNewNote('');
    setIsEditingNote(false);
  };

  const handleDelete = () => {
    // TODO: Implement delete via Supabase
    // supabase.from('leads').delete().eq('id', lead.id).then(() => onClose())
    console.log('Delete lead:', lead.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  return (
    <Modal isOpen={!!lead} onClose={onClose} title={lead.name} size="xl">
      {/* Delete Confirmation Dialog with animation */}
      <AnimatePresence mode="wait">
        {showDeleteConfirm && (
          <motion.div
            key="delete-confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-xl bg-white p-6 shadow-2xl max-w-sm border border-slate-200/50"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.1 }}
                className="flex items-center gap-3 mb-4"
              >
                <div className="rounded-full bg-red-100 p-3">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Delete Lead?</h3>
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="mb-6 text-sm text-slate-600 font-medium"
              >
                This action cannot be undone. All associated conversations and deals will remain for audit purposes.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="flex gap-3"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDelete}
                  className="flex-1 rounded-lg bg-gradient-to-r from-red-600 to-red-700 px-4 py-2.5 text-sm font-bold text-white hover:from-red-700 hover:to-red-800 transition-all shadow-md"
                >
                  Delete
                </motion.button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs with animation */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="border-b border-slate-200/50 mb-6"
      >
        <div className="flex gap-8">
          {['details', 'notes', 'conversations'].map((tab, idx) => (
            <motion.button
              key={tab}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.1 + idx * 0.05 }}
              whileHover={{ color: activeTab === tab ? 'rgb(8, 145, 178)' : 'rgb(51, 65, 85)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`border-b-2 px-1 py-3 text-sm font-bold tracking-wide transition-all ${
                activeTab === tab
                  ? 'border-cyan-600 text-cyan-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Details Tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'details' && (
          <motion.div
            key="details-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.05, delayChildren: 0 }
                }
              }}
              className="grid gap-4 sm:grid-cols-2"
            >
              {/* Name Field */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 }
                }}
              >
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">Name</label>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="mt-2 text-slate-900 font-semibold text-base"
                >
                  {lead.name}
                </motion.p>
              </motion.div>

              {/* Email Field */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, x: 20 },
                  visible: { opacity: 1, x: 0 }
                }}
              >
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">Email</label>
                <motion.a
                  href={`mailto:${lead.email}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  className="mt-2 text-cyan-600 hover:text-cyan-700 font-medium hover:underline transition-all"
                >
                  {lead.email}
                </motion.a>
              </motion.div>

              {/* Phone Field */}
              {lead.phone && (
                <motion.div
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 }
                  }}
                >
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">Phone</label>
                  <motion.a
                    href={`tel:${lead.phone}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    whileHover={{ scale: 1.02 }}
                    className="mt-2 text-cyan-600 hover:text-cyan-700 font-medium hover:underline transition-all"
                  >
                    {lead.phone}
                  </motion.a>
                </motion.div>
              )}

              {/* Company Field */}
              {lead.company && (
                <motion.div
                  variants={{
                    hidden: { opacity: 0, x: 20 },
                    visible: { opacity: 1, x: 0 }
                  }}
                >
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">Business</label>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="mt-2 text-slate-900 font-semibold text-base"
                  >
                    {lead.company}
                  </motion.p>
                </motion.div>
              )}

              {/* Source Field */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 }
                }}
              >
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">Source</label>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mt-2 capitalize text-slate-900 font-semibold text-base"
                >
                  {lead.source}
                </motion.p>
              </motion.div>

              {/* Priority Badge */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, x: 20 },
                  visible: { opacity: 1, x: 0 }
                }}
              >
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">Priority</label>
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.2 }}
                  className={`mt-2 inline-flex rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-all ${
                    lead.priority === 'critical'
                      ? 'bg-red-100/80 text-red-700 border border-red-200/50'
                      : lead.priority === 'high'
                      ? 'bg-amber-100/80 text-amber-700 border border-amber-200/50'
                      : lead.priority === 'medium'
                      ? 'bg-sky-100/80 text-sky-700 border border-sky-200/50'
                      : 'bg-slate-100/80 text-slate-700 border border-slate-200/50'
                  }`}
                >
                  {lead.priority}
                </motion.span>
              </motion.div>

              {/* Created Date */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 }
                }}
              >
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">Created</label>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="mt-2 text-slate-900 font-semibold text-base"
                >
                  {formatDateIN(lead.createdAt)}
                </motion.p>
              </motion.div>
            </motion.div>

            {/* Assign Agent - Animated section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="border-t border-slate-200/50 pt-5"
            >
              <label className="block text-sm font-bold text-slate-900 mb-3 uppercase tracking-wide">Assign Agent</label>
              <motion.select
                whileFocus={{ boxShadow: '0 0 0 3px rgba(6, 182, 212, 0.1)' }}
                value={lead.agentId ?? ''}
                onChange={(e) => onAssignAgent(lead.id, e.target.value)}
                className="w-full rounded-lg border border-slate-300/50 bg-white px-4 py-2.5 text-slate-900 font-medium focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all cursor-pointer"
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </motion.select>
            </motion.div>

            {/* Delete Button - Animated section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="border-t border-slate-200/50 pt-5"
            >
              <motion.button
                whileHover={{ scale: 1.05, backgroundColor: 'rgb(127, 29, 29)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-red-50 hover:bg-red-100 px-4 py-2.5 text-sm font-bold text-red-600 transition-all"
              >
                <Trash2 className="h-4 w-4" />
                Delete Lead
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes Tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'notes' && (
          <motion.div
            key="notes-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <AnimatePresence mode="wait">
              {!isEditingNote ? (
                <motion.div
                  key="notes-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {lead.notes ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-lg bg-gradient-to-br from-slate-50 to-slate-100/50 p-5 text-slate-900 border border-slate-200/50 font-medium leading-relaxed"
                    >
                      {lead.notes}
                    </motion.div>
                  ) : (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-slate-500 italic"
                    >
                      No notes yet.
                    </motion.p>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsEditingNote(true)}
                    className="mt-4 rounded-lg border border-slate-300/50 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all"
                  >
                    {lead.notes ? 'Edit Note' : 'Add Note'}
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  key="notes-edit"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <motion.textarea
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Enter your note here..."
                    rows={5}
                    className="w-full rounded-lg border border-slate-300/50 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 caret-cyan-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all font-medium resize-none"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="flex gap-3"
                  >
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleAddNote}
                      className="flex-1 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-700 px-4 py-2.5 text-sm font-bold text-white hover:from-cyan-700 hover:to-cyan-800 transition-all shadow-md"
                    >
                      Save Note
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setIsEditingNote(false);
                        setNewNote('');
                      }}
                      className="flex-1 rounded-lg border border-slate-300/50 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all"
                    >
                      Cancel
                    </motion.button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversations Tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'conversations' && (
          <motion.div
            key="conversations-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <motion.label
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="block text-sm font-bold text-slate-900 uppercase tracking-wide"
            >
              Chat History
            </motion.label>
            <motion.div
              initial={{ opacity: 0, borderColor: 'rgba(148, 163, 184, 0)' }}
              animate={{ opacity: 1, borderColor: 'rgba(226, 232, 240, 0.5)' }}
              transition={{ duration: 0.3 }}
              className="max-h-96 overflow-y-auto rounded-lg border border-slate-200/50 bg-gradient-to-b from-white via-slate-50/30 to-slate-50 p-4 space-y-3"
            >
              {messages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center h-20"
                >
                  <p className="text-sm text-slate-500 italic">No messages yet.</p>
                </motion.div>
              ) : (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: { staggerChildren: 0.05 }
                    }
                  }}
                  className="space-y-3"
                >
                  {messages.map((m) => (
                    <motion.div
                      key={m.id}
                      variants={{
                        hidden: {
                          opacity: 0,
                          x: m.sender === 'lead' ? -20 : 20,
                          y: 10
                        },
                        visible: {
                          opacity: 1,
                          x: 0,
                          y: 0,
                          transition: { type: 'spring', stiffness: 400, damping: 30 }
                        }
                      }}
                      whileHover={{ x: m.sender === 'lead' ? -2 : 2 }}
                      className={`rounded-lg px-4 py-3 text-sm transition-all ${
                        m.sender === 'lead'
                          ? 'ml-0 mr-8 bg-slate-200/80 border border-slate-300/50 text-slate-900'
                          : m.sender === 'auto'
                          ? 'ml-8 mr-0 bg-amber-100/80 border border-amber-200/50 text-amber-900'
                          : 'ml-8 mr-0 bg-cyan-100/80 border border-cyan-200/50 text-cyan-900'
                      }`}
                    >
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.05 }}
                        className="text-xs font-bold text-slate-600 uppercase tracking-wider"
                      >
                        {m.sender === 'lead'
                          ? '📌 Potential Customer'
                          : m.sender === 'auto'
                          ? '🤖 Auto Response'
                          : '👤 Agent'}
                      </motion.span>
                      <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mt-2 font-medium leading-relaxed"
                      >
                        {m.content}
                      </motion.p>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.15 }}
                        className="mt-2 text-xs text-slate-600/70 font-medium"
                      >
                        {formatDateIN(m.timestamp)}{' '}
                        {new Date(m.timestamp).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </motion.p>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="w-full rounded-lg border border-slate-300/50 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all"
            >
              View Full Conversation
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
