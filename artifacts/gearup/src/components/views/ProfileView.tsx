import React, { memo, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAuthActions } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { User, Mail, Shield, LogOut, ChevronRight, Phone, Pencil, X, Save } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/context/ToastContext';



const ProfileView = memo(() => {
  const { user, profile } = useAuth();
  const { logout } = useAuthActions();
  const { showToast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    setForm({
      name: profile?.name || profile?.username || user?.displayName || '',
      email: profile?.email || user?.email || '',
      phone: profile?.phone || '',
    });
  }, [profile, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      await setDoc(doc(db, 'users', user.uid), {
        name: form.name,
        username: form.name,
        email: form.email,
        phone: form.phone,
      }, { merge: true });

      showToast('Profile updated successfully.', 'success');
      setEditOpen(false);
    } catch (err) {
      console.error(err);
      showToast('Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const menuItems = [
    { icon: Shield, label: 'Identity Verification', status: 'Pending' },
    { icon: Mail, label: 'Email Preferences', status: 'Verified' },
  ];

  return (
    <div className="p-6 md:p-12 max-w-4xl mx-auto space-y-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-6"
      >
        <div className="w-20 h-20 rounded-[24px] bg-[#121212] flex items-center justify-center border-[0.5px] border-white/[0.04]">
          <User size={40} className="text-[#A855F7]" />
        </div>

        <div className="flex-1">
          <h2 className="text-[18px] font-bold tracking-tight text-white mb-1">
            {form.name || 'User'}
          </h2>
          <p className="text-[#707070] font-medium text-[13px]">
            {form.email || 'No email added'}
          </p>
          <p className="text-[#707070] font-medium text-[13px] mt-1 flex items-center gap-2">
            <Phone size={14} />
            {form.phone || 'No phone number added'}
          </p>
        </div>

        <button
          onClick={() => setEditOpen(true)}
          className="cursor-pointer px-5 py-3 bg-[#A855F7] text-white font-semibold rounded-[24px] hover:bg-[#9333EA] transition-all text-[13px] tracking-wide flex items-center gap-2 active:scale-95"
        >
          <Pencil size={16} />
          Edit Profile
        </button>
      </motion.div>

      <div className="grid gap-4">
        {menuItems.map((item, idx) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-[#121212] p-5 rounded-[24px] border-[0.5px] border-white/[0.04] flex items-center justify-between group cursor-pointer hover:border-[#A855F7]/30 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-black/40 rounded-lg text-white/50 group-hover:text-[#A855F7] transition-colors">
                <item.icon size={18} />
              </div>
              <span className="font-medium text-white tracking-tight text-[13px]">{item.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold tracking-wider text-[#707070]">{item.status}</span>
              <ChevronRight size={16} className="text-white/20" />
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="pt-8 border-t border-white/5"
      >
        <button 
          onClick={() => logout()}
          className="cursor-pointer w-full md:w-auto px-8 py-3.5 bg-transparent border-[0.5px] border-white/[0.04] text-red-500 font-medium rounded-[24px] hover:bg-red-500/10 hover:border-red-500/50 transition-all text-[13px] tracking-wide flex items-center justify-center gap-3 active:scale-95"
        >
          <LogOut size={18} />
          Sign Out of GearUp
        </button>
      </motion.div>

      <AnimatePresence>
        {editOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 w-full max-w-[440px] bg-[#121212] border border-white/10 rounded-[32px] shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              <div className="px-6 py-5 flex items-center justify-between border-b border-white/5">
                <h2 className="text-[16px] font-bold text-white tracking-tight">Edit Profile</h2>
                <button
                  onClick={() => setEditOpen(false)}
                  className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">
                    Username / Name
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-[16px] px-4 py-3.5 text-white text-[13px] outline-none focus:border-[#A855F7] transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">
                    Email
                  </label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-[16px] px-4 py-3.5 text-white text-[13px] outline-none focus:border-[#A855F7] transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">
                    Phone Number
                  </label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-[16px] px-4 py-3.5 text-white text-[13px] outline-none focus:border-[#A855F7] transition-colors"
                  />
                </div>
              </div>

              <div className="px-6 py-5 border-t border-white/5 flex justify-end gap-3">
                <button
                  onClick={() => setEditOpen(false)}
                  className="px-6 py-3 text-white/50 hover:text-white font-bold text-[13px] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-3 bg-[#A855F7] text-white font-bold rounded-[24px] hover:bg-[#9333EA] transition-all text-[13px] flex items-center gap-2 disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});



ProfileView.displayName = 'ProfileView';

export default ProfileView;
