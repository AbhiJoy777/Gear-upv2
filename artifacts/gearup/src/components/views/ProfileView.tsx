import React, { memo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAuthActions } from '@/hooks/useAuth';
import { motion } from 'motion/react';
import { User, Mail, Shield, LogOut, ChevronRight, Phone } from 'lucide-react';

const ProfileView = memo(() => {
  const { user, profile } = useAuth();
  const { logout } = useAuthActions();

  const displayName = profile?.username || profile?.fullName || user?.displayName || 'User';
  const photoURL = profile?.photoURL || user?.photoURL;

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
        {/* Avatar */}
        <div className="w-20 h-20 rounded-[24px] bg-[#121212] flex items-center justify-center border-[0.5px] border-white/[0.04] overflow-hidden shrink-0">
          {photoURL ? (
            <img src={photoURL} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <User size={40} className="text-[#A855F7]" />
          )}
        </div>

        {/* Info */}
        <div className="space-y-0.5">
          <h2 className="text-[18px] font-bold tracking-tight text-white">{displayName}</h2>
          {profile?.fullName && profile?.username && (
            <p className="text-[13px] text-white/40 font-medium">{profile.fullName}</p>
          )}
          <p className="text-[13px] text-[#707070] font-medium">{profile?.email || user?.email}</p>
          {profile?.phone && (
            <p className="text-[12px] text-white/40 font-medium flex items-center gap-1.5 pt-0.5">
              <Phone size={12} className="text-white/30" />
              {profile.phone}
            </p>
          )}
        </div>
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
    </div>
  );
});

ProfileView.displayName = 'ProfileView';

export default ProfileView;
