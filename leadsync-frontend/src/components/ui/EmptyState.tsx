import { motion } from 'framer-motion';
import { LucideIcon, Inbox, Search, ShoppingCart, Users, FileText, Megaphone } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export default function EmptyState({ icon: Icon = Inbox, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-background-tertiary flex items-center justify-center mb-5">
        <Icon className="w-8 h-8 text-text-muted" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-text-secondary max-w-sm mb-5">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="btn-primary"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

// Prebuilt empty states for common pages
export function EmptyLeads({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="No leads yet"
      description="Leads will appear here when customers message you through Telegram or Instagram."
      action={onAction ? { label: "Connect a Channel", onClick: onAction } : undefined}
    />
  );
}

export function EmptyConversations() {
  return (
    <EmptyState
      icon={Inbox}
      title="No conversations yet"
      description="When customers reach out, their conversations will appear here."
    />
  );
}

export function EmptyOrders() {
  return (
    <EmptyState
      icon={ShoppingCart}
      title="No orders yet"
      description="Orders created through conversations will show up here."
    />
  );
}

export function EmptySearch({ query }: { query: string }) {
  return (
    <EmptyState
      icon={Search}
      title={`No results for "${query}"`}
      description="Try searching with a different keyword."
    />
  );
}

export function EmptyReports() {
  return (
    <EmptyState
      icon={FileText}
      title="No reports available"
      description="Reports will appear here once you have some order and lead data."
    />
  );
}

export function EmptyBroadcasts() {
  return (
    <EmptyState
      icon={Megaphone}
      title="No broadcasts sent yet"
      description="Send your first broadcast message to reach all your leads at once."
    />
  );
}
