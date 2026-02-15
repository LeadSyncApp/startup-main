/**
 * Loading Spinner - Reusable animated loading indicator
 * Features:
 * - Multiple size options (sm, md, lg)
 * - Smooth spinning animation
 * - Accessible with proper ARIA labels
 * - Customizable class names
 *
 * Usage:
 * <Spinner /> or <Spinner size="lg" className="text-cyan-600" />
 *
 * TODO: Track loading states and analytics
 */
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-4',
};

export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-cyan-500 border-t-transparent ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
