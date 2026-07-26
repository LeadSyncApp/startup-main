import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MapPin, 
  Tag as TagIcon, 
  Filter, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  MoreVertical,
  CheckSquare,
  Square,
  Download,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { authedFetch } from '../../api/client';

interface Lead {
  id: string;
  name: string;
  contact: string;
  city?: string;
  state?: string;
  tags: string[];
  totalSpend: number;
  orderCount: number;
  segment: string;
  lastActiveAt: string;
  lastConversationStatus: string;
}

export const CustomerList: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [minSpend, setMinSpend] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');

  const fetchAudience = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        ...(search && { search }),
        ...(stateFilter && { state: stateFilter }),
        ...(minSpend && { minSpend }),
        ...(segmentFilter && { segment: segmentFilter }),
      });

      const response = await authedFetch(`/api/leads/audience?${params.toString()}`);
      const result = await response.json();
      
      if (response.ok) {
        setLeads(result.data);
        setTotalPages(result.meta.totalPages);
        setTotalLeads(result.meta.total);
      }
    } catch (error) {
      console.error('Fetch audience error:', error);
      toast.error('Failed to load audience data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudience();
  }, [page, stateFilter, segmentFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (page !== 1) {
      setPage(1);
    } else {
      fetchAudience();
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedLeads(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map(l => l.id));
    }
  };

  const bulkTag = async (tag: string) => {
    if (selectedLeads.length === 0) return;
    try {
      const response = await authedFetch('/api/leads/bulk-tag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedLeads, tag, action: 'ADD' })
      });
      if (response.ok) {
        toast.success(`Tagged ${selectedLeads.length} leads as "${tag}"`);
        fetchAudience();
        setSelectedLeads([]);
      }
    } catch (error) {
      toast.error('Failed to update tags');
    }
  };

  const formatLTV = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const states = ["Maharashtra", "Karnataka", "Tamil Nadu", "Delhi", "Gujarat", "Uttar Pradesh", "West Bengal"];

  return (
    <div className="space-y-6">
      {/* Header & Stats Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="size-6 text-teal-600" />
            Customer List
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            {totalLeads > 0 
              ? `Manage and find your ${totalLeads.toLocaleString()} customers across India`
              : "Manage and find your customers across India"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm">
            <Download className="size-4" />
            Export CSV
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow-md shadow-slate-900/10">
            <Plus className="size-4" />
            Add Manual Lead
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select 
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-600 outline-none hover:border-slate-200 transition"
            >
              <option value="">All States</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select 
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-600 outline-none hover:border-slate-200 transition"
            >
              <option value="">All Segments</option>
              <option value="NEW">New Leads</option>
              <option value="REGULAR">Regulars</option>
              <option value="VIP">VIP Customers</option>
              <option value="CHURN_RISK">Churn Risk</option>
            </select>

            <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
              <span className="text-xs font-bold text-slate-400">Total Business {'>'}</span>
              <input 
                type="number" 
                placeholder="0"
                value={minSpend}
                onChange={(e) => setMinSpend(e.target.value)}
                className="w-16 bg-transparent text-sm font-black text-slate-700 outline-none"
              />
            </div>

            <button type="submit" className="p-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition">
              <Filter className="size-5" />
            </button>
          </div>
        </form>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedLeads.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-teal-600 text-white px-6 py-3 rounded-2xl flex items-center justify-between shadow-lg shadow-teal-600/20"
          >
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold">{selectedLeads.length} leads selected</span>
              <div className="h-4 w-px bg-white/20" />
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => bulkTag('Frequent Saree Buyers')}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <TagIcon className="size-3" />
                  Tag: Frequent Saree Buyers
                </button>
                <button 
                  onClick={() => bulkTag('Tier-1 City')}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <MapPin className="size-3" />
                  Tag: Tier-1 City
                </button>
              </div>
            </div>
            <button 
              onClick={() => setSelectedLeads([])}
              className="text-xs font-bold hover:underline"
            >
              Clear Selection
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-4 w-12 text-center">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-teal-600 transition">
                    {selectedLeads.length === leads.length && leads.length > 0 ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                  </button>
                </th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Business (₹)</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status/Tags</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-slate-50">
                    <td colSpan={6} className="p-8"><div className="h-4 bg-slate-100 rounded w-full" /></td>
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <Users className="size-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-400">No leads found matching these filters</p>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr 
                    key={lead.id} 
                    className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors ${selectedLeads.includes(lead.id) ? 'bg-teal-50/30' : ''}`}
                  >
                    <td className="p-4 text-center">
                      <button onClick={() => toggleSelection(lead.id)} className={`${selectedLeads.includes(lead.id) ? 'text-teal-600' : 'text-slate-300'} hover:text-teal-600 transition`}>
                        {selectedLeads.includes(lead.id) ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900">{lead.name}</span>
                        <span className="text-[10px] font-mono text-slate-500 font-bold tracking-tight">{lead.contact}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600 font-medium">
                      {(lead.city || lead.state) ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="size-3.5 text-slate-400" />
                          <span>{lead.city}{lead.city && lead.state ? ', ' : ''}{lead.state}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 italic text-xs">Unknown</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900">{formatLTV(lead.totalSpend)}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{lead.orderCount} Orders</span>
                          {lead.totalSpend > 5000 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                          lead.segment === 'VIP' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                          lead.segment === 'REGULAR' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                          'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          {lead.segment}
                        </span>
                        {lead.tags.map(tag => (
                          <span key={tag} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-100 flex items-center gap-1">
                            <TagIcon className="size-2.5" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <button className="text-slate-300 hover:text-slate-600 transition">
                        <MoreVertical className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100 bg-slate-50/30">
          <span className="text-xs font-bold text-slate-500 tracking-wide uppercase">
            Showing {(page - 1) * 15 + 1} - {Math.min(page * 15, totalLeads)} of {totalLeads}
          </span>
          <div className="flex items-center gap-2">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="p-2 border border-slate-200 rounded-xl hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="flex items-center gap-1 px-3">
              <span className="text-sm font-black text-teal-600">{page}</span>
              <span className="text-sm font-bold text-slate-300">/</span>
              <span className="text-sm font-bold text-slate-400">{totalPages}</span>
            </div>
            <button 
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-2 border border-slate-200 rounded-xl hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
