import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageSquare, ShoppingCart, UserPlus, ArrowRightLeft,
  CheckCircle, AlertCircle
} from 'lucide-react';

interface ActivityItemProps {
  type: 'message' | 'order' | 'lead' | 'status' | 'approval' | 'alert';
  title: string;
  description?: string;
  timestamp: string;
  meta?: string;
  delay?: number;
}

const iconMap = {
  message: { icon: MessageSquare, color: 'text-blue-400 bg-blue-400/10' },
  order: { icon: ShoppingCart, color: 'text-emerald-400 bg-emerald-400/10' },
  lead: { icon: UserPlus, color: 'text-indigo-400 bg-indigo-400/10' },
  status: { icon: ArrowRightLeft, color: 'text-amber-400 bg-amber-400/10' },
  approval: { icon: CheckCircle, color: 'text-emerald-400 bg-emerald-400/10' },
  alert: { icon: AlertCircle, color: 'text-rose-400 bg-rose-400/10' },
};

const ActivityItem = ({
  type,
  title,
  description,
  timestamp,
  meta,
  delay = 0
}: ActivityItemProps) => {
  const { icon: Icon, color } = iconMap[type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex items-start gap-3 p-3 rounded-lg hover:bg-background-tertiary/50 transition-colors group cursor-pointer"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={16} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-text-primary truncate">{title}</p>
          <span className="text-xs text-text-muted flex-shrink-0">
            {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
          </span>
        </div>

        {description && (
          <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{description}</p>
        )}

        {meta && (
          <p className="text-xs text-accent mt-1">{meta}</p>
        )}
      </div>
    </motion.div>
  );
};

export default ActivityItem;
