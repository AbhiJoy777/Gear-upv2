import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Phone, AtSign } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

interface Props {
  onSkip: () => void;
}

export default function ProfileCompletionModal({ onSkip }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!username.trim() || !fullName.trim() || !phone.trim()) {
      showToast('Please fill in all fields.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        username: username.trim(),
        fullName: fullName.trim(),
        phone: phone.trim(),
        updatedAt: serverTimestamp(),
      });
      showToast('Profile saved!', 'success');
    } catch (e) {
      showToast('Failed to save profile. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full h-12 bg-[#0A0A0A] border border-white/5 rounded-[14px] px-4 text-white text-[14px] placeholder:text-white/20 focus:border-[#A855F7] outline-none transition-all';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ type: 'spring', stiffness: 460, damping: 36 }}
          className="relative z-10 w-full max-w-[420px] bg-[#121212] border border-white/5 rounded-[28px] p-8 shadow-[0_32px_80px_rgba(0,0,0,0.8)]"
        >
          {/* Header */}
          <div className="mb-7">
            <div className="w-12 h-12 rounded-[14px] bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center mb-4">
              <User size={22} className="text-[#A855F7]" />
            </div>
            <h2 className="text-[20px] font-bold text-white tracking-tight mb-1">Complete your profile</h2>
            <p className="text-[13px] text-white/40 leading-relaxed">Just a few details so others know who they're dealing with.</p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">Username</label>
              <div className="relative">
                <AtSign size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
                  placeholder="gearhead99"
                  className={`${inputClass} pl-9`}
                  maxLength={24}
                />
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Arjun Sharma"
                className={inputClass}
                maxLength={60}
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">Phone Number</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className={`${inputClass} pl-9`}
                  maxLength={20}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 h-11 bg-[#A855F7] hover:bg-[#9333EA] text-white font-semibold text-[13px] rounded-[14px] transition-all active:scale-95 disabled:opacity-50 cursor-pointer border-none"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
              <button
                type="button"
                onClick={onSkip}
                className="px-5 h-11 text-[13px] font-medium text-white/30 hover:text-white/60 transition-colors bg-transparent border-none cursor-pointer"
              >
                Skip
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
