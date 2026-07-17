import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'avatar' | 'button';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'text' }) => {
  const variantClasses: Record<string, string> = {
    text: 'h-4 w-full rounded',
    card: 'h-32 w-full rounded-xl',
    avatar: 'h-10 w-10 rounded-full',
    button: 'h-10 w-24 rounded-xl',
  };

  return (
    <div
      className={`animate-pulse bg-slate-200 ${variantClasses[variant]} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
};

export const SkeletonGroup: React.FC<{ count?: number; variant?: 'text' | 'card'; className?: string }> = ({
  count = 3,
  variant = 'text',
  className = '',
}) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} variant={variant} />
    ))}
  </div>
);