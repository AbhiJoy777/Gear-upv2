import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

const REPORT_REASONS: Record<'borrower' | 'owner', string[]> = {
  borrower: ['Wrong item', 'Unsafe behavior', 'Other'],
  owner: ['Gear damaged', 'Gear not returned', 'Unsafe behavior', 'Other'],
};

interface ReportIssueModalProps {
  context: {
    rental?: any;
    listing?: any;
    againstUserId?: string | null;
    reporterRole?: 'borrower' | 'owner';
  };
  onClose: () => void;
}

export default function ReportIssueModal({ context, onClose }: ReportIssueModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const reporterRole = context.reporterRole || 'borrower';
  const availableReasons = REPORT_REASONS[reporterRole];
  const [reason, setReason] = useState(availableReasons[0]);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const rental = context.rental;
  const listing = context.listing;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !description.trim()) {
      showToast('Add a short description before submitting.', 'warning');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: user.uid,
        reporterEmail: user.email || '',
        againstUserId: context.againstUserId || null,
        listingId: listing?.id || rental?.gearId || null,
        rentalId: rental?.id || null,
        reporterRole,
        reason,
        description: description.trim(),
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('Report submitted for review.', 'success');
      onClose();
    } catch (err) {
      console.error(err);
      showToast('Failed to submit report.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />

      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-[480px] bg-[#121212] border border-white/10 rounded-[28px] shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        <div className="px-5 md:px-6 py-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white tracking-tight">Report Issue</h2>
              <p className="text-[11px] text-white/40 line-clamp-1">
                {rental?.gearTitle || listing?.title || 'GearUp safety review'}
              </p>
            </div>
          </div>

          <button type="button" onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 md:px-6 py-5 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-[14px] px-4 py-3 text-white text-[13px] outline-none focus:border-[#A855F7] transition-colors"
            >
              {availableReasons.map((item) => (
                <option key={item} value={item} className="bg-[#0A0A0A] text-white">
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe what happened..."
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-[14px] px-4 py-3 text-white text-[13px] outline-none focus:border-[#A855F7] transition-colors resize-none"
            />
          </div>
        </div>

        <div className="px-5 md:px-6 py-4 border-t border-white/5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-3 text-white/50 hover:text-white font-bold text-[13px] transition-all">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-3 bg-red-500/90 hover:bg-red-500 text-white rounded-[14px] font-bold text-[13px] flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Submit Report
          </button>
        </div>
      </motion.form>
    </div>
  );
}
