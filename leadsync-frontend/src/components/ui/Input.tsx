import { forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  onRightIconClick?: () => void;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      onRightIconClick,
      fullWidth = true,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses = `
      w-full rounded-lg border bg-background-tertiary text-text-primary
      placeholder:text-text-disabled
      focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none
      transition-all duration-200 ease-smooth
      disabled:bg-background-secondary disabled:cursor-not-allowed disabled:opacity-60
    `;

    const sizeClasses = 'py-3 px-4';
    const errorClasses = error
      ? 'border-danger focus:border-danger focus:ring-danger/20'
      : 'border-border hover:border-border-hover';

    const leftIconPadding = LeftIcon ? 'pl-10' : '';
    const rightIconPadding = RightIcon ? 'pr-12' : '';

    return (
      <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
        {label && (
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {label}
            {props.required && <span className="text-danger ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {LeftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
              <LeftIcon size={18} />
            </div>
          )}
          <input
            ref={ref}
            className={`${baseClasses} ${sizeClasses} ${errorClasses} ${leftIconPadding} ${rightIconPadding}`}
            disabled={disabled}
            {...props}
          />
          {RightIcon && (
            <button
              type="button"
              onClick={onRightIconClick}
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors ${
                onRightIconClick ? 'cursor-pointer' : 'cursor-default'
              }`}
              tabIndex={-1}
            >
              <RightIcon size={18} />
            </button>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-danger">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-sm text-text-muted">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
