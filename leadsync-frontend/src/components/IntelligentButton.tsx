import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check } from 'lucide-react';

interface IntelligentButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  successText?: string;
  isControlled?: boolean; // if true, rely strictly on manual isLoading and isSuccess props
  isLoading?: boolean;
  isSuccess?: boolean;
  onAsyncClick?: () => Promise<boolean | void>; // If provided, button handles state automatically
}

export const IntelligentButton: React.FC<IntelligentButtonProps> = ({
  children,
  onClick,
  onAsyncClick,
  successText = 'Done!',
  isControlled = false,
  isLoading: propsIsLoading = false,
  isSuccess: propsIsSuccess = false,
  className = '',
  disabled,
  ...props
}) => {
  const [localIsLoading, setLocalIsLoading] = useState(false);
  const [localIsSuccess, setLocalIsSuccess] = useState(false);

  const isLoading = isControlled ? propsIsLoading : localIsLoading;
  const isSuccess = isControlled ? propsIsSuccess : localIsSuccess;

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || isLoading || isSuccess) return;

    if (onAsyncClick) {
      e.preventDefault();
      setLocalIsLoading(true);
      try {
        const success = await onAsyncClick();
        if (success !== false) {
          setLocalIsLoading(false);
          setLocalIsSuccess(true);
        } else {
          setLocalIsLoading(false);
        }
      } catch (err) {
        setLocalIsLoading(false);
        console.error(err);
      }
    } else if (onClick) {
      onClick(e);
    }
  };

  useEffect(() => {
    if (!isControlled && localIsSuccess) {
      const timer = setTimeout(() => {
        setLocalIsSuccess(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [localIsSuccess, isControlled]);

  return (
    <button
      {...props}
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`relative overflow-hidden transition-all duration-200 cursor-pointer ${className} ${
        isSuccess ? 'bg-emerald-600 hover:bg-emerald-600 text-white border-emerald-500' : ''
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isLoading ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-center gap-1.5"
          >
            <Loader2 className="h-4 w-4 animate-spin text-current" />
            <span>Processing...</span>
          </motion.span>
        ) : isSuccess ? (
          <motion.span
            key="success"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-center gap-1.5 text-slate-100 font-extrabold"
          >
            <Check className="h-4 w-4 stroke-[3]" />
            <span>{successText}</span>
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-center gap-1.5 w-full"
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
};

// CSS shake keyframe helpers for inputs
export const shakeTransition = {
  type: "spring",
  stiffness: 500,
  damping: 15,
  mass: 0.5
};

export const shakeAnimation = {
  shake: {
    x: [0, -10, 10, -10, 10, -5, 5, 0],
    transition: shakeTransition
  }
};
