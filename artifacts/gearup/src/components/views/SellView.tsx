import React, { memo, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, CheckCircle2, Cpu, Gamepad2, ImagePlus, Laptop, Lock, Monitor, Package, Plus, Trash2, X } from 'lucide-react';
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatAddress, GearUpAddress, getDefaultAddress } from '@/lib/address';

const SELL_CATEGORIES = [
  { name: 'Laptops', Icon: Laptop },
  { name: 'GPUs', Icon: Cpu },
  { name: 'Consoles', Icon: Gamepad2 },
  { name: 'Gaming PCs', Icon: Cpu },
  { name: 'Monitors', Icon: Monitor },
  { name: 'Cameras', Icon: Camera },
  { name: 'Camera Gear', Icon: Camera },
  { name: 'Accessories', Icon: Package },
  { name: 'Other Tech Gear', Icon: Package },
];

const CONDITIONS = ['Like New', 'Excellent', 'Good', 'Fair', 'Needs Repair'];
const CITIES = ['Hyderabad', 'Bangalore', 'Mumbai'];
const TABS = ['Selling', 'Sold', 'History'] as const;

type SellTab = typeof TABS[number];
type SaleListingStatus = 'ACTIVE' | 'SOLD' | 'INACTIVE' | 'DELETED';

type SaleListing = {
  id: string;
  sellerId: string;
  sellerName?: string;
  sellerEmail?: string;
  category: string;
  title: string;
  description: string;
  price: number;
  condition: string;
  photos: string[];
  city: string;
  addressSnapshot?: Partial<GearUpAddress>;
  status: SaleListingStatus;
  createdAt?: any;
  updatedAt?: any;
};

const currency = (amount: number) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

const SellView = memo(() => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SellTab>('Selling');
  const [listings, setListings] = useState<SaleListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const isVerified = profile?.verificationStatus === 'verified';
  const sellerActive = !!profile?.sellerStatus?.active && !!profile?.sellerStatus?.feePaid;
  const canPublish = isVerified && sellerActive;

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'saleListings'), where('sellerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const nextListings = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() } as SaleListing))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setListings(nextListings);
      setLoading(false);
    }, (error) => {
      console.error('Sale listings load failed:', error);
      showToast('Could not load sale listings.', 'error');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [showToast, user]);

  const visibleListings = useMemo(() => {
    if (activeTab === 'Selling') return listings.filter((item) => item.status === 'ACTIVE');
    if (activeTab === 'Sold') return listings.filter((item) => item.status === 'SOLD');
    return listings.filter((item) => ['SOLD', 'INACTIVE', 'DELETED'].includes(item.status));
  }, [activeTab, listings]);

  const updateStatus = async (listing: SaleListing, status: SaleListingStatus) => {
    try {
      await updateDoc(doc(db, 'saleListings', listing.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      showToast(status === 'SOLD' ? 'Marked as sold.' : 'Sale listing removed.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Could not update sale listing.', 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[#A855F7] text-[11px] font-black uppercase tracking-[0.2em] mb-2">GearUp Sell</p>
          <h2 className="text-[26px] sm:text-[34px] font-black tracking-tight text-white">Sell tech gear</h2>
          <p className="text-white/45 text-[13px] mt-2 max-w-xl">
            List laptops, GPUs, consoles, cameras, monitors, and accessories for local pickup.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          disabled={!canPublish}
          className="w-full md:w-auto px-5 py-3 bg-[#A855F7] text-white font-bold rounded-[22px] hover:bg-[#9333EA] transition-all text-[13px] flex items-center justify-center gap-2 disabled:opacity-45 disabled:hover:bg-[#A855F7]"
        >
          <Plus size={16} />
          Create Sale Listing
        </button>
      </div>

      {!canPublish && (
        <div className="bg-[#121212] border border-[#F97316]/20 rounded-[26px] p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
          <div className="flex gap-4">
            <div className="w-11 h-11 rounded-[16px] bg-[#F97316]/10 border border-[#F97316]/20 flex items-center justify-center shrink-0">
              <Lock size={19} className="text-[#F97316]" />
            </div>
            <div>
              <p className="text-white font-bold text-[15px]">Seller account locked</p>
              <p className="text-white/45 text-[12px] mt-1 leading-relaxed">
                {isVerified ? 'Pay ₹50 to activate seller account. Payment wiring is separate from rental payments and is not enabled yet.' : 'Complete identity verification before selling tech gear.'}
              </p>
            </div>
          </div>
          <button disabled className="px-4 py-2.5 rounded-[18px] bg-white/5 border border-white/10 text-white/40 text-[12px] font-bold">
            Pay ₹50 to activate seller account
          </button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative px-5 py-3 rounded-[20px] text-[13px] font-bold transition-all shrink-0 ${
              activeTab === tab ? 'bg-white text-black' : 'bg-[#121212] text-white/50 hover:text-white border border-white/5'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="min-h-[260px] flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#A855F7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visibleListings.length === 0 ? (
        <EmptyState tab={activeTab} canPublish={canPublish} onCreate={() => setModalOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleListings.map((listing) => (
            <SaleListingCard
              key={listing.id}
              listing={listing}
              activeTab={activeTab}
              onSold={() => updateStatus(listing, 'SOLD')}
              onDelete={() => updateStatus(listing, 'DELETED')}
            />
          ))}
        </div>
      )}

      <SellListingModal open={modalOpen} canPublish={canPublish} onClose={() => setModalOpen(false)} />
    </div>
  );
});

function EmptyState({ tab, canPublish, onCreate }: { tab: SellTab; canPublish: boolean; onCreate: () => void }) {
  return (
    <div className="min-h-[300px] bg-[#121212] border border-white/[0.04] rounded-[28px] flex flex-col items-center justify-center text-center p-8">
      <div className="w-14 h-14 rounded-[20px] bg-white/5 border border-white/10 flex items-center justify-center mb-4">
        <Package size={22} className="text-white/35" />
      </div>
      <p className="text-white font-bold text-[16px]">No {tab.toLowerCase()} listings</p>
      <p className="text-white/40 text-[13px] mt-2 max-w-sm">
        {tab === 'Selling' ? 'Your active tech sale listings will appear here.' : 'Completed or inactive sale records will appear here.'}
      </p>
      {tab === 'Selling' && (
        <button
          onClick={onCreate}
          disabled={!canPublish}
          className="mt-5 px-5 py-3 bg-[#A855F7] text-white font-bold rounded-[20px] hover:bg-[#9333EA] transition-all text-[13px] disabled:opacity-45"
        >
          Create Sale Listing
        </button>
      )}
    </div>
  );
}

function SaleListingCard({ listing, activeTab, onSold, onDelete }: { listing: SaleListing; activeTab: SellTab; onSold: () => void; onDelete: () => void }) {
  const address = listing.addressSnapshot || {};
  const addressText = address.formattedAddress || formatAddress(address);

  return (
    <div className="bg-[#121212] border border-white/[0.05] rounded-[24px] overflow-hidden">
      <div className="aspect-[4/3] bg-[#0A0A0A] relative overflow-hidden">
        {listing.photos?.[0] ? (
          <img src={listing.photos[0]} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">
            <ImagePlus size={32} />
          </div>
        )}
        <span className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
          {listing.status}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="text-[#A855F7] text-[10px] font-bold uppercase tracking-wider">{listing.category} • {listing.condition}</p>
          <h3 className="text-white font-bold text-[16px] mt-1 line-clamp-1">{listing.title}</h3>
          <p className="text-white/45 text-[12px] mt-1 line-clamp-2">{listing.description}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-white text-[22px] font-black tracking-tight">{currency(listing.price)}</p>
          <p className="text-white/40 text-[11px] text-right">{listing.city}</p>
        </div>
        {addressText && <p className="text-white/35 text-[11px] line-clamp-2">{addressText}</p>}
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-[16px] p-3">
          <p className="text-white/60 text-[12px] font-bold">Contact seller</p>
          <p className="text-white/35 text-[11px] mt-0.5">Buyer chat/contact CTA placeholder. No sale checkout yet.</p>
        </div>
        {activeTab === 'Selling' && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button onClick={onSold} className="py-2.5 rounded-[14px] bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 text-[#2DD4BF] text-[12px] font-bold flex items-center justify-center gap-1.5">
              <CheckCircle2 size={14} />
              Mark Sold
            </button>
            <button onClick={onDelete} className="py-2.5 rounded-[14px] bg-red-500/10 border border-red-500/20 text-red-300 text-[12px] font-bold flex items-center justify-center gap-1.5">
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SellListingModal({ open, canPublish, onClose }: { open: boolean; canPublish: boolean; onClose: () => void }) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState('');
  const [city, setCity] = useState(profile?.city || 'Hyderabad');
  const [address, setAddress] = useState<GearUpAddress | null>(null);
  const defaultAddress = getDefaultAddress(profile?.addresses || []);

  useEffect(() => {
    if (!open) return;
    setCity(profile?.city || defaultAddress?.city || 'Hyderabad');
    setAddress(defaultAddress);
  }, [defaultAddress, open, profile?.city]);

  const reset = () => {
    setStep(1);
    setCategory('');
    setPhotos([]);
    setTitle('');
    setDescription('');
    setPrice('');
    setCondition('');
    setCity(profile?.city || 'Hyderabad');
    setAddress(defaultAddress);
  };

  const close = () => {
    onClose();
    reset();
  };

  const canContinue = () => {
    if (step === 1) return !!category;
    if (step === 2) return photos.length > 0;
    if (step === 3) return !!title.trim() && !!description.trim() && Number(price) > 0 && !!condition;
    if (step === 4) return !!city && !!address;
    return false;
  };

  const publish = async () => {
    if (!user || !canPublish || !canContinue()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'saleListings'), {
        sellerId: user.uid,
        sellerName: profile?.name || profile?.username || user.displayName || 'GearUp Seller',
        sellerEmail: profile?.email || user.email || '',
        category,
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        condition,
        photos,
        city,
        addressSnapshot: address,
        status: 'ACTIVE',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('Sale listing published.', 'success');
      close();
    } catch (err) {
      console.error(err);
      showToast('Could not publish sale listing.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[240] flex items-center justify-center p-3 sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 18 }}
            className="relative z-10 w-full max-w-[620px] max-h-[92dvh] bg-[#121212] border border-white/10 rounded-[28px] flex flex-col overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)]"
          >
            <div className="px-5 sm:px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
              <div>
                <p className="text-[#A855F7] text-[10px] font-black uppercase tracking-[0.2em]">Step {step} of 4</p>
                <h3 className="text-white font-bold text-[18px] mt-1">Create Sale Listing</h3>
              </div>
              <button onClick={close} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6" style={{ WebkitOverflowScrolling: 'touch' }}>
              {!canPublish ? (
                <div className="min-h-[260px] flex flex-col items-center justify-center text-center">
                  <Lock size={32} className="text-[#F97316] mb-4" />
                  <p className="text-white font-bold">Seller activation required</p>
                  <p className="text-white/45 text-[13px] mt-2 max-w-sm">Verify your profile and pay ₹50 to activate seller account before publishing.</p>
                </div>
              ) : step === 1 ? (
                <div className="space-y-4">
                  <h4 className="text-white font-bold text-[16px]">What are you selling?</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {SELL_CATEGORIES.map(({ name, Icon }) => (
                      <button
                        key={name}
                        onClick={() => setCategory(name)}
                        className={`p-4 rounded-[18px] border text-left transition-all min-h-[104px] ${
                          category === name ? 'bg-[#A855F7]/10 border-[#A855F7] text-white' : 'bg-[#0A0A0A] border-white/10 text-white/60 hover:text-white'
                        }`}
                      >
                        <Icon size={21} className="mb-3" />
                        <span className="text-[13px] font-bold">{name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : step === 2 ? (
                <div className="space-y-5 text-center">
                  <ImagePlus size={34} className="text-[#A855F7] mx-auto" />
                  <div>
                    <h4 className="text-white font-bold text-[16px]">Add photos</h4>
                    <p className="text-white/45 text-[13px] mt-1">Add up to 4 clear photos of the gear.</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[0, 1, 2, 3].map((index) => (
                      <button
                        key={index}
                        onClick={() => {
                          const next = [...photos];
                          next[index] = `https://picsum.photos/seed/sell-${Date.now()}-${index}/600/600`;
                          setPhotos(next.filter(Boolean));
                        }}
                        className="aspect-square rounded-[18px] bg-[#0A0A0A] border border-dashed border-white/10 hover:border-[#A855F7]/50 overflow-hidden flex items-center justify-center"
                      >
                        {photos[index] ? <img src={photos[index]} alt="Sale preview" className="w-full h-full object-cover" /> : <Plus size={22} className="text-white/30" />}
                      </button>
                    ))}
                  </div>
                </div>
              ) : step === 3 ? (
                <div className="space-y-4">
                  <Field label="Title" value={title} onChange={setTitle} placeholder="RTX 4060 gaming laptop" />
                  <div>
                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      placeholder="Condition, age, accessories, reason for selling"
                      className="w-full bg-[#0A0A0A] text-white border border-white/10 rounded-[16px] p-4 text-[13px] focus:border-[#A855F7] outline-none placeholder:text-white/25 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Asking Price" value={price} onChange={(value) => setPrice(value.replace(/\D/g, ''))} placeholder="45000" />
                    <Select label="Condition" value={condition} onChange={setCondition} options={CONDITIONS} />
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.05] rounded-[16px] p-4">
                    <p className="text-white/60 text-[12px] font-bold">Seller contact</p>
                    <p className="text-white/35 text-[11px] mt-1">Buyer contact/chat CTA is reserved here. No sale payment or negotiation checkout yet.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Select label="City" value={city} onChange={setCity} options={CITIES} />
                  {defaultAddress ? (
                    <div className={`border rounded-[20px] p-4 ${address?.id === defaultAddress.id ? 'border-[#A855F7]/50 bg-[#A855F7]/5' : 'border-white/10 bg-[#0A0A0A]'}`}>
                      <p className="text-[11px] text-white/40 font-bold uppercase tracking-wider mb-2">Default Pickup Address</p>
                      <p className="text-white text-[13px] font-bold">{defaultAddress.label}</p>
                      <p className="text-white/55 text-[12px] mt-1 leading-relaxed">{defaultAddress.formattedAddress || formatAddress(defaultAddress)}</p>
                      <button
                        onClick={() => {
                          setAddress(defaultAddress);
                          setCity(defaultAddress.city || city);
                        }}
                        className="mt-3 w-full bg-[#A855F7]/10 border border-[#A855F7]/20 text-[#A855F7] font-bold py-2.5 rounded-[14px] text-[12px]"
                      >
                        Use this address
                      </button>
                    </div>
                  ) : (
                    <div className="bg-[#0A0A0A] border border-white/10 rounded-[20px] p-4">
                      <p className="text-white font-bold text-[13px]">No saved address</p>
                      <p className="text-white/45 text-[12px] mt-1">Add a pickup address in Profile before publishing a sale listing.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-white/5 flex justify-between gap-3 shrink-0">
              <button onClick={step === 1 ? close : () => setStep(step - 1)} className="px-5 py-3 text-white/50 hover:text-white font-bold text-[13px] rounded-[18px] hover:bg-white/5">
                {step === 1 ? 'Cancel' : 'Back'}
              </button>
              {step < 4 ? (
                <button onClick={() => setStep(step + 1)} disabled={!canPublish || !canContinue()} className="px-6 py-3 bg-white/10 text-white font-bold rounded-[18px] hover:bg-white/20 transition-all text-[13px] disabled:opacity-50">
                  Next
                </button>
              ) : (
                <button onClick={publish} disabled={!canPublish || !canContinue() || saving} className="px-6 py-3 bg-[#A855F7] text-white font-bold rounded-[18px] hover:bg-[#9333EA] transition-all text-[13px] disabled:opacity-50">
                  {saving ? 'Publishing...' : 'Publish'}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0A0A0A] text-white border border-white/10 rounded-[16px] p-4 text-[13px] focus:border-[#A855F7] outline-none placeholder:text-white/25"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0A0A0A] text-white border border-white/10 rounded-[16px] p-4 text-[13px] focus:border-[#A855F7] outline-none"
      >
        <option value="" className="bg-[#0A0A0A]">Select</option>
        {options.map((option) => <option key={option} value={option} className="bg-[#0A0A0A]">{option}</option>)}
      </select>
    </div>
  );
}

SellView.displayName = 'SellView';

export default SellView;
