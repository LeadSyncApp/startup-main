/**
 * Modal - Reusable animated modal overlay for forms and detail views
 * Features:
 * - Smooth Framer Motion entrance/exit animations
 * - Keyboard escape support
 * - Click-outside-to-close backdrop
 * - Responsive sizing with Tailwind CSS
 *
 * Usage:
 * const [isOpen, setIsOpen] = useState(false);
 * <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Add Lead" size="lg">
 *   <form> ... </form>
 * </Modal>
 *
 * TODO: Backend Integration
 * - Add onSubmit callback for form submissions
 * - Handle loading states while submitting
 * - Show error messages from API responses
 * - Implement success callback after data update
 */
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({ isOpen, onClose, title, children, size = 'md', showCloseButton = true }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with animation */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
          />

          {/* Modal content with animation */}
          <motion.div
            key="modal"
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div
              className={`relative w-full ${sizeClasses[size]} rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden pointer-events-auto`}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? 'modal-title' : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              {title && (
                <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
                  <h2 id="modal-title" className="text-xl font-semibold text-slate-900">{title}</h2>
                  {showCloseButton && (
                    <button
                      onClick={onClose}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      aria-label="Close modal"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="overflow-y-auto max-h-[calc(100vh-180px)] p-6">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
