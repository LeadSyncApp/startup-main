import { forwardRef } from 'react';
import { motion } from 'framer-motion';

import type { HTMLMotionProps } from 'framer-motion';

interface CardProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'elevated' | 'glass' | 'bordered';
  hover?: boolean;
  glowOnHover?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({
    variant = 'default',
    hover = true,
    glowOnHover = false,
    children,
    className = '',
    ...props
  }, ref: React.Ref<HTMLDivElement>) => {
    const variants: Record<string, string> = {
      default: 'card',
      elevated: 'card-elevated',
      glass: 'card-glass',
      bordered: 'card border-2 border-border hover:border-accent/30',
    };

    const hoverEffects = hover ? 'hover:border-border-hover' : '';
    const glowEffect = glowOnHover ? 'hover:glow-accent' : '';

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        whileHover={hover ? { y: -2, transition: { duration: 0.2 } } : {}}
        className={`${variants[variant]} ${hoverEffects} ${glowEffect} ${className}`}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`flex items-center justify-between mb-4 ${className}`}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <h3 className={`text-lg font-semibold text-text-primary ${className}`}>
    {children}
  </h3>
);

export const CardDescription = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-sm text-text-secondary ${className}`}>
    {children}
  </p>
);

export const CardContent = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={className}>
    {children}
  </div>
);

export const CardFooter = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`flex items-center justify-between mt-4 pt-4 border-t border-border ${className}`}>
    {children}
  </div>
);

export default Card;
