import { motion } from 'framer-motion';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'gradient';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  pulse?: boolean;
  className?: string;
}

const Badge = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  pulse = false,
  className = ''
}: BadgeProps) => {
  const variants: Record<BadgeVariant, string> = {
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
    neutral: 'badge-neutral',
    gradient: 'badge-gradient',
  };

  const sizes: Record<BadgeSize, string> = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span className={`${variants[variant]} ${sizes[size]} ${className}`}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
      {pulse && (
        <motion.span
          className={`w-1.5 h-1.5 rounded-full ${
            variant === 'success' ? 'bg-success' :
            variant === 'warning' ? 'bg-warning' :
            variant === 'danger' ? 'bg-danger' :
            'bg-accent'
          }`}
          animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </span>
  );
};

export default Badge;
