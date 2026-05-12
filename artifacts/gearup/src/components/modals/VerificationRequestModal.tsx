import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, Send } from 'lucide-react';
import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

const ID_TYPES = ['Aadhaar', 'PAN', 'Driving License'];

export default function VerificationRequestModal({ onClose }: { onClose: () => void }) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(profile?.fullName || profile?.name || profile?.username || '');
  const [idType, setIdType] = useState(ID_TYPES[0]);
  const [idNumber, setIdNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (profile?.verificationStatus === 'verified') {
      showToast('Your profile is already verified.', 'info');
      return;
    }
    if (profile?.verificationStatus === 'pending') {
      showToast('You already have a pending verification request.', 'warning');
      onClose();
      return;
    }
    if (!fullName.trim() || !idNumber.trim()) {
      showToast('Please fill in your legal name and ID number.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const pendingQuery = query(
        collection(db, 'verificationRequests'),
        where('uid', '==', user.uid)
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      if (pendingSnapshot.docs.some((docSnap) => docSnap.data().status === 'pending')) {
        showToast('You already have a pending verification request.', 'warning');
        onClose();
        return;
      }

      await addDoc(collection(db, 'verificationRequests'), {
        uid: user.uid,
        userEmail: user.email || profile?.email || '',
        fullName: fullName.trim(),
        idType,
        idNumber: idNumber.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'users', user.uid), {
        role: profile?.role || 'user',
        verificationStatus: 'pending',
      }, { merge: true });

      showToast('Verification request submitted.', 'success');
      onClose();
    } catch (err) {
      console.error(err);
      showToast('Failed to submit verification request.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-[#0A0A0A] border border-white/10 rounded-[14px] px-4 py-3 text-white text-[13px] outline-none focus:border-[#A855F7] transition-colors';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[230] flex items-center justify-center p-3 sm:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative z-10 w-full max-w-[500px] bg-[#121212] border border-white/10 rounded-[24px] sm:rounded-[32px] shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden"
        >
          <div className="px-5 md:px-6 py-4 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#A855F7]/10 flex items-center justify-center">
                <ShieldCheck size={18} className="text-[#A855F7]" />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-white tracking-tight">Identity Verification</h2>
                <p className="text-[11px] text-white/40">Submit your details for admin review.</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="px-5 md:px-6 py-5 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">Full Legal Name</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">Government ID Type</label>
                <select value={idType} onChange={(e) => setIdType(e.target.value)} className={inputClass}>
                  {ID_TYPES.map((type) => (
                    <option key={type} value={type} className="bg-[#0A0A0A] text-white">
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">ID Number</label>
                <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className={inputClass} />
              </div>

            </div>

            <div className="px-5 md:px-6 py-4 border-t border-white/5 flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button type="button" onClick={onClose} className="w-full sm:w-auto px-6 py-3 text-white/50 hover:text-white font-bold text-[13px] transition-all">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-6 py-3 bg-[#A855F7] text-white font-bold rounded-[24px] hover:bg-[#9333EA] transition-all text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send size={16} />
                {saving ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
