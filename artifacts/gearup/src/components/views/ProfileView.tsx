import React, { memo, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAuthActions } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { User, Mail, Shield, LogOut, ChevronRight, Phone, Pencil, X, Save, MapPin, Plus, Home, Briefcase, Wallet, Trash2 } from 'lucide-react';
import { db, googleProvider } from '@/lib/firebase';
import { linkWithPopup } from 'firebase/auth';
import { arrayUnion, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/context/ToastContext';
import VerificationRequestModal from '../modals/VerificationRequestModal';
import PhoneVerificationModal from '../modals/PhoneVerificationModal';
import AddressModal from '../modals/AddressModal';
import { GearUpAddress, getDefaultAddress, mapsUrl } from '@/lib/address';

const VERIFICATION_LABELS: Record<string, string> = {
  not_started: 'Not started',
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
};

const VERIFICATION_STYLES: Record<string, string> = {
  not_started: 'text-white/50 border-white/10 bg-white/5',
  pending: 'text-[#F97316] border-[#F97316]/20 bg-[#F97316]/10',
  verified: 'text-[#2DD4BF] border-[#2DD4BF]/20 bg-[#2DD4BF]/10',
  rejected: 'text-red-400 border-red-500/20 bg-red-500/10',
};

const ProfileView = memo(({ onOpenWallet }: { onOpenWallet?: () => void }) => {
  const { user, profile } = useAuth();
  const { logout } = useAuthActions();
  const { showToast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [phoneVerificationOpen, setPhoneVerificationOpen] = useState(false);
  const [addressManagerOpen, setAddressManagerOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<GearUpAddress | null>(null);
  const [addressToDelete, setAddressToDelete] = useState<GearUpAddress | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const profileModalOpen = editOpen || addressManagerOpen || Boolean(addressToDelete);

  useEffect(() => {
    setForm({
      name: profile?.name || profile?.username || user?.displayName || '',
      email: profile?.email || user?.email || '',
      phone: profile?.phone || '',
    });
  }, [profile, user]);

  useEffect(() => {
    if (!profileModalOpen) return;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [profileModalOpen]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      await setDoc(doc(db, 'users', user.uid), {
        name: form.name,
        username: form.name,
        role: profile?.role || 'user',
        verificationStatus: profile?.verificationStatus || 'not_started',
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

  const verificationStatus = profile?.verificationStatus || 'not_started';
  const phoneVerified = !!profile?.phoneVerified;
  const authProviders = Array.isArray(profile?.authProviders) ? profile.authProviders : [];
  const googleConnected = !!profile?.emailVerified || authProviders.includes('google.com');
  const addresses: GearUpAddress[] = profile?.addresses || [];
  const defaultAddress = getDefaultAddress(addresses);
  const canRequestVerification = verificationStatus === 'not_started' || verificationStatus === 'rejected';
  const verificationAction =
    verificationStatus === 'not_started'
      ? 'Start Verification'
      : verificationStatus === 'pending'
        ? 'Verification Pending'
        : verificationStatus === 'verified'
          ? 'Verified'
          : 'Retry Verification';

  const menuItems = [
    { icon: Shield, label: 'Identity Verification', status: verificationAction, interactive: true },
    { icon: Phone, label: 'Phone Verification', status: phoneVerified ? 'Phone Verified' : 'Verify Phone', interactive: !phoneVerified, type: 'phone' },
    { icon: Mail, label: 'Google / Email', subtitle: 'Connect Google account', status: googleConnected ? 'Connected' : 'Connect Google', interactive: !googleConnected, type: 'google' },
    { icon: MapPin, label: 'Addresses', subtitle: 'Manage pickup addresses', status: 'Manage', interactive: true, type: 'addresses' },
    { icon: Wallet, label: 'Wallet', status: 'Open', interactive: true, type: 'wallet' },
  ];

  const setDefaultAddress = async (addressId: string) => {
    if (!user) return;
    try {
      const nextAddresses = addresses.map((address) => ({ ...address, isDefault: address.id === addressId }));
      const selectedAddress = nextAddresses.find((address) => address.id === addressId);
      await updateDoc(doc(db, 'users', user.uid), {
        addresses: nextAddresses,
        city: selectedAddress?.city || profile?.city || 'Hyderabad',
      });
      showToast('Default address updated.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update default address.', 'error');
    }
  };

  const deleteAddress = async () => {
    if (!user || !addressToDelete) return;
    try {
      const remainingAddresses = addresses.filter((address) => address.id !== addressToDelete.id);
      const nextAddresses = addressToDelete.isDefault && remainingAddresses.length > 0
        ? remainingAddresses.map((address, index) => ({ ...address, isDefault: index === 0 }))
        : remainingAddresses;
      const nextDefault = getDefaultAddress(nextAddresses);

      await updateDoc(doc(db, 'users', user.uid), {
        addresses: nextAddresses,
        city: nextDefault?.city || profile?.city || 'Hyderabad',
      });
      showToast('Address deleted.', 'success');
      setAddressToDelete(null);
    } catch (err) {
      console.error(err);
      showToast('Failed to delete address.', 'error');
    }
  };

  const handleConnectGoogle = async () => {
    if (!user) return;
    try {
      const result = await linkWithPopup(user, googleProvider);
      await setDoc(doc(db, 'users', user.uid), {
        email: result.user.email,
        emailVerified: Boolean(result.user.emailVerified || result.user.providerData.some((provider) => provider.providerId === 'google.com')),
        authProviders: arrayUnion('google.com'),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      showToast('Google account connected.', 'success');
    } catch (err: any) {
      console.error('Google account link failed:', {
        code: err?.code,
        message: err?.message,
        error: err,
      });
      if (err?.code === 'auth/credential-already-in-use' || err?.code === 'auth/account-exists-with-different-credential') {
        showToast('This Google account is already linked to another GearUp account.', 'error');
        return;
      }
      if (err?.code === 'auth/provider-already-linked') {
        showToast('Google account is already connected.', 'info');
        return;
      }
      showToast('Could not connect Google account. Please try again.', 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-12 max-w-4xl mx-auto space-y-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6"
      >
        <div className="w-20 h-20 rounded-[24px] bg-[#121212] flex items-center justify-center border-[0.5px] border-white/[0.04] shrink-0">
          <User size={40} className="text-[#A855F7]" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-[18px] font-bold tracking-tight text-white mb-1">
            {form.name || 'User'}
          </h2>
          <p className="text-[#707070] font-medium text-[13px] break-all">
            {form.email || 'No email added'}
          </p>
          <p className="text-[#707070] font-medium text-[13px] mt-1 flex items-center gap-2 break-all">
            <Phone size={14} />
            {form.phone || 'No phone number added'}
          </p>
          <div className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-[24px] border text-[11px] font-bold uppercase tracking-wider ${
            phoneVerified ? 'text-[#2DD4BF] border-[#2DD4BF]/20 bg-[#2DD4BF]/10' : 'text-[#F97316] border-[#F97316]/20 bg-[#F97316]/10'
          }`}>
            <Phone size={13} />
            {phoneVerified ? 'Phone Verified' : 'Phone Not Verified'}
          </div>
          <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-[24px] border text-[11px] font-bold uppercase tracking-wider ${VERIFICATION_STYLES[verificationStatus] || VERIFICATION_STYLES.not_started}`}>
            <Shield size={13} />
            {VERIFICATION_LABELS[verificationStatus] || 'Not started'}
          </div>
        </div>

        <button
          onClick={() => setEditOpen(true)}
          className="cursor-pointer w-full sm:w-auto px-5 py-3 bg-[#A855F7] text-white font-semibold rounded-[24px] hover:bg-[#9333EA] transition-all text-[13px] tracking-wide flex items-center justify-center gap-2 active:scale-95"
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
            onClick={() => {
              if (item.type === 'phone') {
                if (!phoneVerified) setPhoneVerificationOpen(true);
                return;
              }
              if (item.type === 'wallet') {
                onOpenWallet?.();
                return;
              }
              if (item.type === 'addresses') {
                setAddressManagerOpen(true);
                return;
              }
              if (item.type === 'google') {
                if (!googleConnected) handleConnectGoogle();
                return;
              }
              if (item.interactive && canRequestVerification) setVerificationOpen(true);
            }}
            className={`bg-[#121212] p-4 sm:p-5 rounded-[24px] border-[0.5px] border-white/[0.04] flex items-center justify-between gap-3 group transition-all ${
              item.type === 'wallet' || item.type === 'addresses' || (item.type === 'google' && !googleConnected) || (item.type === 'phone' && !phoneVerified) || (item.interactive && canRequestVerification) ? 'cursor-pointer hover:border-[#A855F7]/30' : ''
            }`}
          >
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="p-2.5 bg-black/40 rounded-lg text-white/50 group-hover:text-[#A855F7] transition-colors shrink-0">
                <item.icon size={18} />
              </div>
              <div className="min-w-0">
                <span className="font-medium text-white tracking-tight text-[13px] truncate block">{item.label}</span>
                {'subtitle' in item && item.subtitle && (
                  <span className="text-[#707070] text-[11px] truncate block mt-0.5">{item.subtitle}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <span className={`text-[11px] font-semibold tracking-wider ${
                item.type === 'phone'
                  ? (phoneVerified ? 'text-[#2DD4BF]' : 'text-[#F97316]')
                  : item.type === 'google' ? (googleConnected ? 'text-[#2DD4BF]' : 'text-[#F97316]')
                  : item.type === 'wallet' || item.type === 'addresses' ? 'text-[#707070]'
                  : item.interactive ? (VERIFICATION_STYLES[verificationStatus]?.split(' ')[0] || 'text-[#707070]') : 'text-[#707070]'
              }`}>{item.status}</span>
              {item.type === 'phone' && !phoneVerified && <ChevronRight size={16} className="text-white/20" />}
              {item.type === 'google' && !googleConnected && <ChevronRight size={16} className="text-white/20" />}
              {item.type === 'wallet' && <ChevronRight size={16} className="text-white/20" />}
              {item.type === 'addresses' && <ChevronRight size={16} className="text-white/20" />}
              {!item.type && item.interactive && canRequestVerification && <ChevronRight size={16} className="text-white/20" />}
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
                    disabled
                    readOnly
                    className="w-full bg-[#0A0A0A]/60 border border-white/5 rounded-[16px] px-4 py-3.5 text-white/35 text-[13px] outline-none cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">
                    Phone Number
                  </label>
                  <input
                    value={form.phone}
                    disabled
                    readOnly
                    className="w-full bg-[#0A0A0A]/60 border border-white/5 rounded-[16px] px-4 py-3.5 text-white/35 text-[13px] outline-none cursor-not-allowed"
                  />
                </div>
                <p className="text-[12px] leading-relaxed text-white/40">
                  Email and phone are linked to your verified login methods.
                </p>
              </div>

              <div className="px-6 py-5 border-t border-white/5 flex flex-col-reverse sm:flex-row justify-end gap-3">
                <button
                  onClick={() => setEditOpen(false)}
                  className="w-full sm:w-auto px-6 py-3 text-white/50 hover:text-white font-bold text-[13px] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full sm:w-auto px-6 py-3 bg-[#A855F7] text-white font-bold rounded-[24px] hover:bg-[#9333EA] transition-all text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {verificationOpen && (
          <VerificationRequestModal onClose={() => setVerificationOpen(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {phoneVerificationOpen && (
          <PhoneVerificationModal onClose={() => setPhoneVerificationOpen(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {addressManagerOpen && (
          <AddressManagerModal
            addresses={addresses}
            defaultAddress={defaultAddress}
            onClose={() => setAddressManagerOpen(false)}
            onAdd={() => { setEditingAddress(null); setAddressOpen(true); }}
            onEdit={(address) => { setEditingAddress(address); setAddressOpen(true); }}
            onSetDefault={setDefaultAddress}
            onDelete={setAddressToDelete}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {addressToDelete && (
          <div className="fixed inset-0 z-[270] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAddressToDelete(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative z-10 w-full max-w-[400px] bg-[#121212] border border-white/10 rounded-[28px] p-6 shadow-[0_0_70px_rgba(0,0,0,0.8)]"
            >
              <h3 className="text-white text-[16px] font-bold tracking-tight">Delete address?</h3>
              <p className="text-white/50 text-[13px] mt-2 leading-relaxed">This address will be removed from your address book.</p>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
                <button
                  onClick={() => setAddressToDelete(null)}
                  className="w-full sm:w-auto px-5 py-3 text-white/60 hover:text-white rounded-[18px] text-[13px] font-bold hover:bg-white/5"
                >
                  No
                </button>
                <button
                  onClick={deleteAddress}
                  className="w-full sm:w-auto px-5 py-3 bg-red-500 text-white rounded-[18px] text-[13px] font-bold hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AddressModal
        open={addressOpen}
        editAddress={editingAddress}
        onClose={() => { setAddressOpen(false); setEditingAddress(null); }}
      />
    </div>
  );
});



ProfileView.displayName = 'ProfileView';

export default ProfileView;

function AddressManagerModal({
  addresses,
  defaultAddress,
  onClose,
  onAdd,
  onEdit,
  onSetDefault,
  onDelete,
}: {
  addresses: GearUpAddress[];
  defaultAddress: GearUpAddress | null;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (address: GearUpAddress) => void;
  onSetDefault: (addressId: string) => void;
  onDelete: (address: GearUpAddress) => void;
}) {
  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 18 }}
        className="relative z-10 w-full max-w-[560px] max-h-[92dvh] bg-[#121212] border border-white/10 rounded-[28px] shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
      >
        <div className="px-5 sm:px-6 py-5 border-b border-white/5 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-white tracking-tight">Addresses</h2>
            <p className="text-[#707070] text-[12px] mt-1">
              {defaultAddress ? 'Manage pickup addresses for listings.' : 'Add a pickup address for faster listings.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          <button
            onClick={onAdd}
            className="w-full px-4 py-3 bg-[#A855F7] text-white font-bold rounded-[18px] text-[13px] flex items-center justify-center gap-2 hover:bg-[#9333EA] transition-all"
          >
            <Plus size={16} /> Add Address
          </button>

          {addresses.length === 0 ? (
            <div className="bg-[#0A0A0A] border border-white/10 rounded-[22px] p-5">
              <p className="text-white font-semibold text-[14px]">No addresses yet</p>
              <p className="text-white/45 text-[12px] mt-1">Add one address so GearUp can prefill pickup details during beta.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {addresses.map((address) => {
                const Icon = address.label === 'Work' ? Briefcase : Home;
                const addressText = address.formattedAddress || [address.houseOrBuilding, address.area, address.city, address.landmark].filter(Boolean).join(' • ');

                return (
                  <div key={address.id} className="bg-[#0A0A0A] border border-white/10 rounded-[22px] p-4 flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="w-10 h-10 rounded-[14px] bg-[#A855F7]/10 flex items-center justify-center shrink-0">
                      <Icon size={17} className="text-[#A855F7]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-white text-[14px] font-bold">{address.label}</p>
                        {address.isDefault && (
                          <span className="text-[10px] text-[#2DD4BF] border border-[#2DD4BF]/20 bg-[#2DD4BF]/10 rounded-full px-2 py-0.5 font-bold uppercase">Default</span>
                        )}
                      </div>
                      <p className="text-white/60 text-[12px] mt-1 leading-relaxed">{addressText}</p>
                      {address.instructions && <p className="text-white/35 text-[11px] mt-1">{address.instructions}</p>}
                      {address.lat && address.lng && (
                        <a href={mapsUrl(address.lat, address.lng)} target="_blank" rel="noreferrer" className="inline-flex mt-2 text-[11px] text-[#2DD4BF] font-bold hover:text-[#5EEAD4]">
                          Open in Google Maps
                        </a>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2">
                      {!address.isDefault && (
                        <button onClick={() => onSetDefault(address.id)} className="px-3 py-2 bg-white/5 text-white/70 rounded-[12px] text-[11px] font-bold hover:bg-white/10">
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() => onEdit(address)}
                        className="px-3 py-2 bg-white/5 text-white/70 rounded-[12px] text-[11px] font-bold hover:bg-white/10"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(address)}
                        className="px-3 py-2 bg-red-500/10 text-red-400 rounded-[12px] text-[11px] font-bold hover:bg-red-500/20 flex items-center justify-center gap-1"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
