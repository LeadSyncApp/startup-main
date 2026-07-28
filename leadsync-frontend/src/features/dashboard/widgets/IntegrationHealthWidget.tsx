import React from 'react';
import { motion } from 'framer-motion';

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

function IntegrationSkeleton() {
  return (
    <div className="card-hover p-5" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
      <div className="h-5 w-36 rounded animate-pulse mb-3" style={{ backgroundColor: 'var(--app-border)' }} />
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-7 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
        ))}
      </div>
    </div>
  );
}

export const IntegrationHealthWidget: React.FC<IntegrationHealthWidgetProps> = ({ data, loading }) => {
  if (loading) return <IntegrationSkeleton />;

  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-hover p-5"
      style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
    >
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--app-text)' }}>Integrations</h2>
      <div className="space-y-2">
        {channels.map(ch => {
          const isConnected = ch.key === 'whatsAppPhoneNumberId'
            ? !!data.whatsAppPhoneNumberId
            : !!data[ch.key];
          return (
            <div key={ch.key} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ backgroundColor: 'var(--app-bg-soft)' }}>
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: isConnected ? ch.color : 'var(--app-border)' }}
              />
              <span className="text-xs font-medium flex-1" style={{ color: 'var(--app-text)' }}>{ch.label}</span>
              <span className="text-2xs font-medium" style={{ color: isConnected ? 'var(--success-green)' : 'var(--app-text-muted)' }}>
                {isConnected ? 'Connected' : 'Not connected'}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
