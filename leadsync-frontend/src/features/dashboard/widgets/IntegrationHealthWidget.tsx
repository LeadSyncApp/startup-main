import React from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff } from 'lucide-react';

interface CompanyData {
  telegramConnected?: boolean;
  instagramConnected?: boolean;
  whatsAppPhoneNumberId?: string | null;
}

interface IntegrationHealthWidgetProps {
  data: CompanyData | null;
  loading?: boolean;
}

const channels = [
  { key: 'telegramConnected', label: 'Telegram', color: '#0088cc' },
  { key: 'instagramConnected', label: 'Instagram', color: '#E1306C' },
  { key: 'whatsAppPhoneNumberId', label: 'WhatsApp', color: '#25D366' },
] as const;

function Skeleton() {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
      <div className="h-4 w-28 rounded animate-pulse mb-3" style={{ backgroundColor: 'var(--app-border)' }} />
      <div className="flex gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 flex-1 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
        ))}
      </div>
    </div>
  );
}

export const IntegrationHealthWidget: React.FC<IntegrationHealthWidgetProps> = ({ data, loading }) => {
  if (loading) return <Skeleton />;
  if (!data) return null;

  const connectedCount = channels.filter(ch =>
    ch.key === 'whatsAppPhoneNumberId' ? !!data.whatsAppPhoneNumberId : !!data[ch.key]
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 transition-all duration-200 hover:shadow-sm"
      style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--app-text)' }}>Integrations</h2>
        <span className="text-2xs font-medium px-2 py-0.5 rounded-full" style={{
          backgroundColor: connectedCount === 3 ? 'rgba(134, 194, 50, 0.1)' : 'rgba(211, 107, 70, 0.08)',
          color: connectedCount === 3 ? 'var(--success-green)' : 'var(--brand-saffron)',
        }}>
          {connectedCount}/{channels.length}
        </span>
      </div>
      <div className="flex gap-2">
        {channels.map(ch => {
          const isConnected = ch.key === 'whatsAppPhoneNumberId'
            ? !!data.whatsAppPhoneNumberId
            : !!data[ch.key];
          return (
            <div
              key={ch.key}
              className="flex-1 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-2xs font-medium"
              style={{ backgroundColor: isConnected ? `${ch.color}10` : 'var(--app-bg-soft)' }}
            >
              {isConnected ? (
                <Wifi className="h-3 w-3 shrink-0" style={{ color: ch.color }} />
              ) : (
                <WifiOff className="h-3 w-3 shrink-0" style={{ color: 'var(--app-text-muted)' }} />
              )}
              <span className="truncate" style={{ color: isConnected ? ch.color : 'var(--app-text-muted)' }}>
                {ch.label}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
