import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
  [key: `data-${string}`]: string | undefined;
}

const paddingClasses = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const Card: React.FC<CardProps> = (props) => {
  const { children, className = '', padding = 'md', hover = false, onClick, ...rest } = props;
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={`rounded-xl border border-app-border bg-app-surface shadow-sm ${
        hover ? 'transition-all duration-200 hover:shadow-md-custom hover:border-app-border-strong' : ''
      } ${paddingClasses[padding]} ${onClick ? 'cursor-pointer text-left w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </Comp>
  );
};

export const CardHeader: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, action, className = '' }) => (
  <div className={`flex items-start justify-between mb-4 ${className}`}>
    <div>
      <h3 className="text-base font-bold text-app-text">{title}</h3>
      {subtitle && <p className="text-sm text-app-text-muted mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);