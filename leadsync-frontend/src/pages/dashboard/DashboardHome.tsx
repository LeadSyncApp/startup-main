import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, Users, MessageSquare, ShoppingCart,
  Zap, ArrowRight, Activity, Plus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import StatCard from '../../components/dashboard/StatCard';
import ChartCard from '../../components/dashboard/ChartCard';
import ActivityItem from '../../components/dashboard/ActivityItem';
import { Skeleton } from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';

export default function DashboardHome() {
  const { token, user, company } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({
    leads: 0,
    conversations: 0,
    orders: 0,
    revenue: 0,
    chartData: [],
    recentActivity: []
  });

  useEffect(() => {
    if (!token) return;
    fetchDashboardData();
  }, [token]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dashboard/metrics');
      setData(response || {
        leads: 156,
        conversations: 42,
        orders: 89,
        revenue: 245000,
        chartData: [
          { label: 'Mon', value: 28000 },
          { label: 'Tue', value: 35000 },
          { label: 'Wed', value: 24000 },
          { label: 'Thu', value: 42000 },
          { label: 'Fri', value: 38000 },
          { label: 'Sat', value: 31000 },
          { label: 'Sun', value: 47000 },
        ],
        recentActivity: []
      });
    } catch (err) {
      console.error('Dashboard load failed', err);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: 'Create Order', icon: ShoppingCart, path: '/dashboard/orders', color: 'indigo' },
    { label: 'Add Lead', icon: Users, path: '/dashboard/leads', color: 'emerald' },
    { label: 'Send Broadcast', icon: MessageSquare, path: '/dashboard/broadcasts', color: 'amber' },
    { label: 'View Reports', icon: TrendingUp, path: '/dashboard/reports', color: 'violet' },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-[300px]" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Good {getGreeting()}, {user?.name?.split(' ')[0] || 'Agent'}
          </h1>
          <p className="text-text-secondary mt-1">
            {company?.name || 'Your Company'} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400">All systems operational</span>
          </div>
        </div>
      </motion.div>

      {/* AI Insights Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-accent/10 to-violet-500/10 border border-accent/20"
      >
        <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-text-primary">AI Insights</p>
          <p className="text-sm text-text-secondary">
            3 leads need attention · 1 order pending approval · AI handled 92% of conversations
          </p>
        </div>
        <Button variant="secondary" size="sm">View Details</Button>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={data.revenue || 245000}
          prefix="₹"
          trend={12}
          trendLabel="vs last month"
          icon={<TrendingUp size={20} />}
          color="emerald"
          delay={0.1}
        />
        <StatCard
          label="Active Orders"
          value={data.orders || 89}
          trend={8}
          trendLabel="vs yesterday"
          icon={<ShoppingCart size={20} />}
          color="indigo"
          delay={0.2}
        />
        <StatCard
          label="Total Leads"
          value={data.leads || 156}
          trend={-3}
          trendLabel="vs last week"
          icon={<Users size={20} />}
          color="amber"
          delay={0.3}
        />
        <StatCard
          label="AI Conversations"
          value={data.conversations || 42}
          trend={24}
          trendLabel="this week"
          icon={<MessageSquare size={20} />}
          color="violet"
          delay={0.4}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Section */}
        <div className="lg:col-span-2 space-y-4">
          <ChartCard
            title="Revenue Overview"
            subtitle="Last 7 days performance"
            data={data.chartData || [
              { label: 'Mon', value: 28000 },
              { label: 'Tue', value: 35000 },
              { label: 'Wed', value: 24000 },
              { label: 'Thu', value: 42000 },
              { label: 'Fri', value: 38000 },
              { label: 'Sat', value: 31000 },
              { label: 'Sun', value: 47000 },
            ]}
            height={320}
          />

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="group flex flex-col items-center gap-3 p-4 rounded-xl bg-background-secondary border border-border hover:border-accent/30 transition-all"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  action.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20' :
                  action.color === 'amber' ? 'bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20' :
                  action.color === 'violet' ? 'bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/20' :
                  'bg-accent/10 text-accent group-hover:bg-accent/20'
                }`}>
                  <action.icon size={20} />
                </div>
                <span className="text-sm font-medium text-text-primary">{action.label}</span>
                <ArrowRight size={14} className="text-text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </motion.div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Quick Actions Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-background-secondary rounded-xl border border-border p-5"
          >
            <h3 className="text-sm font-semibold text-text-primary mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Button variant="primary" className="w-full justify-start" leftIcon={<Plus size={16} />}>
                Create New Order
              </Button>
              <Button variant="secondary" className="w-full justify-start" leftIcon={<Users size={16} />}>
                Add Lead Manually
              </Button>
              <Button variant="secondary" className="w-full justify-start" leftIcon={<MessageSquare size={16} />}>
                Send Broadcast
              </Button>
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-background-secondary rounded-xl border border-border p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">Recent Activity</h3>
              <Activity size={14} className="text-text-muted" />
            </div>
            <div className="space-y-1">
              <ActivityItem
                type="order"
                title="New order #ORD-2451"
                description="₹3,450 from Premium Bakery"
                timestamp={new Date(Date.now() - 5 * 60 * 1000).toISOString()}
                delay={0.1}
              />
              <ActivityItem
                type="lead"
                title="New lead: Rahul Kumar"
                description="via Telegram, assigned to Agent"
                timestamp={new Date(Date.now() - 15 * 60 * 1000).toISOString()}
                delay={0.2}
              />
              <ActivityItem
                type="message"
                title="AI response sent"
                description="To customer about order delivery"
                timestamp={new Date(Date.now() - 30 * 60 * 1000).toISOString()}
                delay={0.3}
              />
              <ActivityItem
                type="approval"
                title="Order approved"
                description="Order #ORD-2448 processed by Agent"
                timestamp={new Date(Date.now() - 60 * 60 * 1000).toISOString()}
                delay={0.4}
              />
            </div>
            <button className="w-full mt-4 py-2 text-xs font-medium text-accent hover:text-accent-hover transition-colors">
              View All Activity →
            </button>
          </motion.div>

          {/* AI Performance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-background-secondary rounded-xl border border-border p-5"
          >
            <h3 className="text-sm font-semibold text-text-primary mb-3">AI Performance</h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-text-secondary">Response Rate</span>
                  <span className="text-emerald-400 font-medium">92%</span>
                </div>
                <div className="h-1.5 bg-background-tertiary rounded-full overflow-hidden">
                  <div className="h-full w-[92%] bg-emerald-400 rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-text-secondary">Conversion Rate</span>
                  <span className="text-accent font-medium">45%</span>
                </div>
                <div className="h-1.5 bg-background-tertiary rounded-full overflow-hidden">
                  <div className="h-full w-[45%] bg-accent rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-text-secondary">Avg Response Time</span>
                  <span className="text-violet-400 font-medium">2.3s</span>
                </div>
                <div className="h-1.5 bg-background-tertiary rounded-full overflow-hidden">
                  <div className="h-full w-[78%] bg-violet-400 rounded-full" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}
