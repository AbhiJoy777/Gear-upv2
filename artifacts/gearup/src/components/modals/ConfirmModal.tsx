import { motion, AnimatePresence } from 'motion/react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            className="relative z-10 w-full max-w-[360px] bg-[#141414] border border-white/10 rounded-[24px] p-7 shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
          >
            <h3 className="text-[17px] font-bold text-white tracking-tight mb-2">{title}</h3>
            <p className="text-[13px] text-white/50 leading-relaxed mb-7">{message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={onCancel}
                className="px-5 py-2.5 text-[13px] font-semibold text-white/50 hover:text-white transition-colors bg-transparent border-none cursor-pointer rounded-[12px] hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="px-5 py-2.5 text-[13px] font-semibold text-white bg-rose-600/80 hover:bg-rose-600 border border-rose-500/30 rounded-[12px] transition-all active:scale-95 cursor-pointer"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
