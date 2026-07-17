import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'saffron' | 'ghost' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-navy hover:bg-brand-navy-light text-white',
  secondary: 'bg-app-surface border-2 border-app-border hover:border-app-border-strong text-app-text',
  saffron: 'bg-brand-saffron hover:bg-brand-saffron-light text-slate-900',
  ghost: 'bg-transparent hover:bg-app-bg-soft text-app-text-muted',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="h-4 w-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
      ) : icon ? (
        <span className="h-4 w-4">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};