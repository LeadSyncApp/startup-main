export const getInitialsColor = (name: string) => {
  const colors = [
    'from-blue-600 to-sky-500',
    'from-blue-500 to-indigo-600',
    'from-teal-500 to-cyan-600',
    'from-blue-700 to-blue-500',
    'from-emerald-500 to-teal-600',
    'from-cyan-500 to-blue-600'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % colors.length;
  return colors[idx];
};

export const getInitials = (name?: string | null, contact?: string) => {
  const val = name || contact || '?';
  return val.trim().charAt(0).toUpperCase();
};

export function formatTime(dateStr?: string) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function formatRelative(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export const isSystemLog = (content: string): boolean => {
  const text = content.toLowerCase();
  return (
    text.includes('switched mode') ||
    text.includes('operator updated') ||
    text.includes('claimed conversation') ||
    text.includes('conversation finalized') ||
    text.includes('assigned to') ||
    text.includes('switched operator') ||
    text.includes('status for') ||
    text.includes('assigned conversation') ||
    text.includes('mode updated') ||
    text.includes('has claimed') ||
    text.includes('resolved')
  );
};
