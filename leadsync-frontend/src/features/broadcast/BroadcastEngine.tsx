import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Send, 
  History, 
  Users, 
  CheckCircle2,
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

interface Broadcast {
  id: string;
  title: string;
  message: string;
  recipientCount: number;
  targetTags: string[];
  targetSegments: string[];
  createdAt: string;
}

export const BroadcastEngine: React.FC = () => {
  const [view, setView] = useState<'compose' | 'history'>('compose');
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/broadcasts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setBroadcasts(data);
      }
    } catch (error) {
      console.error('History fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'history') {
      fetchHistory();
    }
  }, [view]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message) {
      toast.error('Please enter a message');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/broadcasts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title: title || 'Quick Update',
          message,
          targetTags: selectedTags,
          targetSegments: selectedSegments
        })
      });

      const result = await response.json();
      if (response.ok) {
        toast.success(result.message);
        setMessage('');
        setTitle('');
        setSelectedTags([]);
        setSelectedSegments([]);
        setView('history');
      } else {
        toast.error(result.message || 'Failed to send broadcast');
      }
    } catch (error) {
      toast.error('Connection error');
    } finally {
      setSending(false);
    }
  };

  const segments = [
    { id: 'NEW', label: 'New Leads' },
    { id: 'REGULAR', label: 'Regular Customers' },
    { id: 'VIP', label: 'VIPs' }
  ];

  const commonTags = [
    'Frequent Saree Buyers',
    'Tier-1 City',
    'Tier-2 City',
    'Bakery Regulars'
  ];

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const toggleSegment = (seg: string) => {
    setSelectedSegments(prev => 
      prev.includes(seg) ? prev.filter(s => s !== seg) : [...prev, seg]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Zap className="size-6 text-amber-500 fill-amber-500" />
            Broadcast Engine
          </h2>
          <p className="text-sm text-slate-500 font-medium">Message all your customers at once</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setView('compose')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${view === 'compose' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Compose
          </button>
          <button 
            onClick={() => setView('history')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${view === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            History
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'compose' ? (
          <motion.div 
            key="compose"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <form onSubmit={handleSend} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Campaign Title (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Fresh Brownies Batch"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-amber-500/20 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Your Message</label>
                    <textarea 
                      placeholder="Type the message you want to send to your customers..."
                      rows={6}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-amber-500/20 outline-none transition resize-none lg:text-base font-medium"
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-[10px] text-slate-400 font-bold">Tip: Personalized messages get 3x more replies</p>
                      <span className="text-[10px] font-mono font-bold text-slate-400">{message.length}/4096</span>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={sending || !message}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition disabled:opacity-50 shadow-xl shadow-slate-900/20"
                  >
                    {sending ? (
                      <div className="size-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="size-4" />
                        Send Broadcast Now
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div className="bg-amber-50/50 border border-amber-100 rounded-3xl p-6 flex gap-4">
                <AlertCircle className="size-6 text-amber-500 shrink-0" />
                <div>
                  <h4 className="text-sm font-black text-amber-900">Broadcast Guidelines</h4>
                  <p className="text-xs text-amber-700/80 font-medium leading-relaxed mt-1">
                    Please avoid sending too many messages. Telegram may temporarily block your bot if too many customers report your messages as spam. Aim for high-value updates like sales or fresh stock.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                  <Users className="size-4 text-slate-400" />
                  Target Audience
                </h3>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">By Segment</label>
                    <div className="flex flex-wrap gap-2">
                      {segments.map(seg => (
                        <button 
                          key={seg.id}
                          onClick={() => toggleSegment(seg.id)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition ${
                            selectedSegments.includes(seg.id) 
                            ? 'bg-slate-900 text-white border-slate-900' 
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {seg.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">By Tags</label>
                    <div className="flex flex-wrap gap-2">
                      {commonTags.map(tag => (
                        <button 
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition ${
                            selectedTags.includes(tag) 
                            ? 'bg-amber-500 text-white border-amber-500' 
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                    <span>Recipients Estimate</span>
                    <span className="text-slate-900">~{selectedTags.length > 0 || selectedSegments.length > 0 ? 'Loading...' : 'All Customers'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 rounded-3xl p-6 text-white overflow-hidden relative">
                <div className="relative z-10">
                  <h4 className="text-sm font-black mb-1">New: WhatsApp Flow</h4>
                  <p className="text-[10px] text-white/60 font-medium leading-relaxed">
                    Broadcasts are now also supporting Instagram. Reach your audience wherever they are.
                  </p>
                </div>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <MessageSquare className="size-16" />
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm"
          >
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center space-y-4">
                <div className="size-8 border-3 border-slate-100 border-t-amber-500 rounded-full animate-spin" />
                <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">Loading History...</span>
              </div>
            ) : broadcasts.length === 0 ? (
              <div className="p-12 text-center">
                <History className="size-12 text-slate-100 mx-auto mb-4" />
                <h3 className="text-sm font-black text-slate-400">No broadcasts sent yet</h3>
                <p className="text-xs text-slate-300 font-bold mt-1 uppercase tracking-wider">Start your first campaign to see it here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Broadcast Details</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Audience</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Recipients</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sent Date</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {broadcasts.map((b) => (
                      <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition shadow-sm hover:shadow-none">
                        <td className="p-4">
                          <div className="flex flex-col max-w-xs">
                            <span className="text-sm font-black text-slate-900">{b.title || 'Broadcast'}</span>
                            <span className="text-[10px] text-slate-500 font-medium line-clamp-1 mt-0.5">{b.message}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {b.targetSegments.map(s => (
                              <span key={s} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold border border-blue-100">{s}</span>
                            ))}
                            {b.targetTags.map(t => (
                              <span key={t} className="px-1.5 py-0.5 bg-teal-50 text-teal-600 rounded text-[9px] font-bold border border-teal-100">{t}</span>
                            ))}
                            {b.targetSegments.length === 0 && b.targetTags.length === 0 && (
                              <span className="px-1.5 py-0.5 bg-slate-50 text-slate-400 rounded text-[9px] font-bold border border-slate-100">All Customers</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-slate-900">{b.recipientCount}</span>
                            <Users className="size-3 text-slate-300" />
                          </div>
                        </td>
                        <td className="p-4 text-xs font-bold text-slate-500">
                          {new Date(b.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 text-emerald-600">
                            <CheckCircle2 className="size-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Successful</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
