

import React, { useEffect, useState, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { collection, query, limit, onSnapshot, where } from 'firebase/firestore';
import { Camera, Cpu, Gamepad2, Laptop, Loader2, MapPin, MessageCircle, Monitor, PlusCircle, ShoppingBag, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import BookingModal from '../modals/BookingModal';
import SaleChatModal from '../modals/SaleChatModal';
import { formatAddress } from '@/lib/address';
import { BETA_LAUNCH_MODE, DEMO_RENT_LISTINGS, DEMO_SALE_LISTINGS } from '@/lib/beta';
import { useToast } from '@/context/ToastContext';

const CATEGORIES = ['Laptops', 'Desktops', 'GPUs', 'Consoles', 'Monitors', 'Controllers'];
const CATEGORY_VISUALS = {
  laptop: { Icon: Laptop, label: 'Laptop', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80' },
  desktop: { Icon: Monitor, label: 'Gaming PC', image: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=900&q=80' },
  gpu: { Icon: Cpu, label: 'GPU', image: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=900&q=80' },
  console: { Icon: Gamepad2, label: 'Console', image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=900&q=80' },
  camera: { Icon: Camera, label: 'Camera', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80' },
  monitor: { Icon: Monitor, label: 'Monitor', image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80' },
  controller: { Icon: Gamepad2, label: 'Controller', image: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=900&q=80' },
  fallback: { Icon: ShoppingBag, label: 'Tech Gear', image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80' },
};

function getCategoryVisual(item: any) {
  const text = `${item?.category || ''} ${item?.title || ''}`.toLowerCase();
  if (text.includes('laptop') || text.includes('macbook')) return CATEGORY_VISUALS.laptop;
  if (text.includes('desktop') || text.includes('gaming pc') || text.includes('pc')) return CATEGORY_VISUALS.desktop;
  if (text.includes('gpu') || text.includes('rtx') || text.includes('radeon')) return CATEGORY_VISUALS.gpu;
  if (text.includes('console') || text.includes('playstation') || text.includes('ps5') || text.includes('xbox')) return CATEGORY_VISUALS.console;
  if (text.includes('camera') || text.includes('canon') || text.includes('sony') || text.includes('gopro')) return CATEGORY_VISUALS.camera;
  if (text.includes('monitor')) return CATEGORY_VISUALS.monitor;
  if (text.includes('controller')) return CATEGORY_VISUALS.controller;
  return CATEGORY_VISUALS.fallback;
}

function CategoryThumbnail({ item, imageUrl }: { item: any; imageUrl?: string }) {
  if (imageUrl) {
    return <img src={imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out relative z-0" />;
  }

  const { Icon, label, image } = getCategoryVisual(item);
  return (
    <div className="relative z-0 w-full h-full bg-[#0A0A0A] overflow-hidden">
      <img src={image} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/10" />
      <div className="absolute left-4 bottom-4 flex items-center gap-2">
        <span className="w-9 h-9 rounded-[14px] bg-black/45 border border-white/10 backdrop-blur-md flex items-center justify-center">
          <Icon size={18} className="text-white/80" />
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/70">{label}</span>
      </div>
    </div>
  );
}

const MarketplaceView = memo(({ selectedCity }: { selectedCity: string }) => {

  const { user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [fetchingItems, setFetchingItems] = useState(true);
  const [fetchingSaleItems, setFetchingSaleItems] = useState(true);
  const [bookingItem, setBookingItem] = useState<any | null>(null);
  const [selectedRentListing, setSelectedRentListing] = useState<any | null>(null);
  const [selectedSaleListing, setSelectedSaleListing] = useState<any | null>(null);
  const [saleChatListing, setSaleChatListing] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All Gear');
  const [marketMode, setMarketMode] = useState<'rent' | 'buy'>('rent');

  useEffect(() => {
    if (!user) return;

    const gearRef = collection(db, 'listings');
    const q = query(gearRef, where('status', '==', 'AVAILABLE'), limit(20));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gearData: any[] = snapshot.docs.map(doc => ({
        id: doc.id, ...doc.data()
      }));
      setItems(gearData);
      setFetchingItems(false);
    }, (err) => {
      console.error("Firestore Listen Error:", err);
      setFetchingItems(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const saleRef = collection(db, 'saleListings');
    const q = query(saleRef, where('status', '==', 'ACTIVE'), limit(40));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const saleData = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setSaleItems(saleData);
      setFetchingSaleItems(false);
    }, (err) => {
      console.error('Sale marketplace listen error:', err);
      setFetchingSaleItems(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleBook = async (item: any) => {
    if (!user) return;
    if (BETA_LAUNCH_MODE) {
      showToast('Bookings open soon during GearUp Beta.', 'warning');
      return;
    }
    setBookingItem(item);
  };

  const handleSaleChat = (item: any) => {
    if (!user) return;
    if (BETA_LAUNCH_MODE) {
      showToast('Seller chat opens soon during GearUp Beta.', 'warning');
      return;
    }
    setSaleChatListing(item);
  };

  const getTierColor = (t: string) => {
    if (t === 'High') return 'text-[#A855F7] border-[#A855F7]/30 bg-[#A855F7]/10';
    if (t === 'Mid') return 'text-[#2DD4BF] border-[#2DD4BF]/30 bg-[#2DD4BF]/10';
    return 'text-white border-white/20 bg-white/5';
  };

  const rentBrowseItems = BETA_LAUNCH_MODE ? [...items, ...DEMO_RENT_LISTINGS] : items;
  const saleBrowseItems = BETA_LAUNCH_MODE ? [...saleItems, ...DEMO_SALE_LISTINGS] : saleItems;

  const filteredItems = rentBrowseItems.filter((item) => {
    const itemCity = item.location?.city || item.city || 'Hyderabad';
    const isAvailable = !item.status || item.status === 'AVAILABLE';
    const cityMatches = itemCity === selectedCity;
    const categoryMatches = selectedCategory === 'All Gear' || item.category === selectedCategory;
    return isAvailable && cityMatches && categoryMatches;
  });

  const filteredSaleItems = saleBrowseItems.filter((item) => {
    const itemCity = item.addressSnapshot?.city || item.city || 'Hyderabad';
    const cityMatches = itemCity === selectedCity;
    const categoryMatches = selectedCategory === 'All Gear' || item.category === selectedCategory;
    return cityMatches && categoryMatches;
  });

  const fetching = marketMode === 'rent' ? fetchingItems : fetchingSaleItems;
  const visibleItems = marketMode === 'rent' ? filteredItems : filteredSaleItems;


  return (
    <div className="p-4 sm:p-6 md:p-10 space-y-8 md:space-y-10">
      <div className="mb-2">
        <h2 className="text-4xl sm:text-5xl md:text-7xl font-black mb-6 md:mb-10 tracking-tighter leading-[0.95]">
          <span className="text-white">Explore the </span>
          <span className="text-[#2DD4BF] italic">Armory.</span>
        </h2>
        <div className="inline-grid grid-cols-2 p-1 bg-[#121212] border border-white/[0.05] rounded-[24px] mb-6">
          {(['rent', 'buy'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setMarketMode(mode);
                setSelectedCategory('All Gear');
              }}
              className={`px-6 py-2.5 rounded-[20px] text-[12px] font-bold uppercase tracking-wider transition-all ${
                marketMode === mode ? 'bg-white text-black' : 'text-white/45 hover:text-white'
              }`}
            >
              {mode === 'rent' ? 'Rent' : 'Buy'}
            </button>
          ))}
        </div>
        <div className="flex gap-6 md:gap-8 overflow-x-auto pb-0 scrollbar-hide border-b border-white/5 relative">
          {['All Gear', ...(marketMode === 'rent' ? CATEGORIES : ['Laptops', 'GPUs', 'Consoles', 'Gaming PCs', 'Monitors', 'Cameras', 'Camera Gear', 'Accessories', 'Other Tech Gear'])].map((cat) => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`cursor-pointer pb-4 text-[13px] font-medium transition-colors duration-300 shrink-0 relative group hover:text-white ${
                selectedCategory === cat 
                  ? 'text-white' 
                  : 'text-[#707070]'
              }`}
            >
              <span className="relative z-10">{cat}</span>
              {selectedCategory === cat && (
                <motion.div
                  layoutId="marketplace-category-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#A855F7] z-20"
                />
              )}
              {selectedCategory !== cat && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300 z-10" />
              )}
            </button>
          ))}
        </div>
      </div>

      {fetching ? (
        <div className="h-[40vh] flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-[#A855F7] animate-spin" />
        </div>
      ) : visibleItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative">
          <AnimatePresence mode="popLayout">
            {marketMode === 'rent' ? filteredItems.map((item) => {
              const pickupLocation = typeof item.location === 'object' ? item.location : {};
              const itemCity = pickupLocation.city || item.city || 'Hyderabad';
              const itemArea = pickupLocation.area || 'Area pending';
              return (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
                onClick={() => setSelectedRentListing(item)}
                className="cursor-pointer bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[24px] overflow-hidden group hover:border-white/20 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all flex flex-col duration-300 shadow-lg relative"
              >
                <div className="h-48 bg-[#121212] relative overflow-hidden flex items-center justify-center border-b-[0.5px] border-white/[0.04]">
                  {/* Abstract Background Elements */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#2DD4BF]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  {item.tier ? (
                    <span className={`absolute top-4 right-4 text-[11px] font-bold tracking-wider px-3 py-1.5 rounded-[24px] border-[0.5px] z-10 uppercase ${getTierColor(item.tier)}`}>
                      {item.tier} TIER
                    </span>
                  ) : (
                     <span className="absolute top-4 right-4 bg-[#2DD4BF]/10 text-[#2DD4BF] text-[11px] font-bold tracking-wider px-3 py-1.5 rounded-[24px] border-[0.5px] border-[#2DD4BF]/20 z-10 uppercase">
                      {item.status || 'AVAILABLE'}
                     </span>
                  )}
                  <CategoryThumbnail item={item} />
                </div>
                <div className="p-5 flex flex-1 flex-col z-10 bg-[#121212] relative">
                  <div className="flex flex-col mb-2">
                    {item.isGaming && (
                       <span className="text-[#2DD4BF] text-[10px] font-bold tracking-widest uppercase mb-1 flex items-center gap-1.5">
                         <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF] animate-pulse shadow-[0_0_8px_#2DD4BF]"></span>
                         GAMING RIG
                       </span>
                    )}
                    <h3 className="font-semibold text-[15px] text-white group-hover:text-[#2DD4BF] transition-colors tracking-tight line-clamp-1 duration-300">{item.title}</h3>
                  </div>
                <p className="text-[#707070] text-[12px] mb-4 line-clamp-2 font-medium leading-relaxed flex-1 flex flex-col gap-1.5">
                  <span>{item.category} <span className="opacity-50 mx-1">•</span> {itemCity} <span className="opacity-50 mx-1">•</span> {itemArea}</span>

                  <span className="flex items-center gap-1.5 text-[11px] bg-white/[0.03] text-white/70 w-fit max-w-full px-2 py-1 rounded-[6px] border border-white/[0.05]">
                    <MapPin size={12} className="text-[#A855F7]" />
                    Pickup only
                  </span>
                </p>
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-4 border-t border-white/10">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-medium text-[#707070] tracking-wide block mb-0.5">PER DAY</span>
                      <span className="text-[15px] font-bold text-white tracking-tight shrink-0">₹{item.pricePerDay}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setSelectedRentListing(item); }} disabled={bookingItem?.id === item.id || item.ownerId === user?.uid} className="cursor-pointer px-4 py-2 bg-white/[0.02] border-[0.5px] border-white/[0.04] text-white rounded-[24px] hover:bg-white/10 active:scale-95 transition-all text-[12px] font-semibold disabled:opacity-50">
                      {item.ownerId === user?.uid ? 'Owned' : BETA_LAUNCH_MODE ? 'Preview' : 'Book Now'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}) : filteredSaleItems.map((item) => (
              <SaleMarketplaceCard
                key={item.id}
                item={item}
                currentUserId={user?.uid}
                onOpen={() => setSelectedSaleListing(item)}
                onChat={() => handleSaleChat(item)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-[50vh]">
          <div className="w-full max-w-md p-6 sm:p-10 bg-[#121212] rounded-[24px] mb-8 border-[0.5px] border-white/[0.04] shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-[#A855F7] to-transparent"></div>
             <Camera size={48} className="text-[#A855F7]/40 mb-6 mx-auto" />
             <h3 className="text-[20px] font-bold text-white mb-2 tracking-tight text-center">Vault is Empty</h3>
             <p className="text-[#707070] text-[13px] text-center max-w-sm mb-8 font-medium leading-relaxed mx-auto">
                No {selectedCategory !== 'All Gear' ? selectedCategory : marketMode === 'rent' ? 'Gear' : 'tech gear for sale'} listed in {selectedCity} yet.

             </p>
             {marketMode === 'rent' && (
               <button onClick={() => window.dispatchEvent(new CustomEvent('open-list-modal'))} className="cursor-pointer flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[#A855F7] text-white font-bold rounded-[24px] hover:bg-[#9333EA] hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] active:bg-[#7e22ce] active:scale-95 transition-all text-[13px] tracking-wide mx-auto">
                 <PlusCircle size={18} />
                 Drop First Listing
               </button>
             )}
          </div>
        </motion.div>
      )}
      {bookingItem && (
         <BookingModal item={bookingItem} onClose={() => setBookingItem(null)} />
      )}
      {selectedRentListing && (
        <RentListingDetailModal
          item={selectedRentListing}
          currentUserId={user?.uid}
          onClose={() => setSelectedRentListing(null)}
          onBook={() => handleBook(selectedRentListing)}
        />
      )}
      {selectedSaleListing && (
        <SaleListingDetailModal
          item={selectedSaleListing}
          currentUserId={user?.uid}
          onClose={() => setSelectedSaleListing(null)}
          onChat={() => handleSaleChat(selectedSaleListing)}
        />
      )}
      {saleChatListing && (
        <SaleChatModal saleListing={saleChatListing} onClose={() => setSaleChatListing(null)} />
      )}
    </div>
  );
});

function RentListingDetailModal({ item, currentUserId, onClose, onBook }: { item: any; currentUserId?: string; onClose: () => void; onBook: () => void }) {
  const pickupLocation = typeof item.location === 'object' ? item.location : {};
  const city = pickupLocation.city || item.city || 'Hyderabad';
  const area = pickupLocation.area || 'Area pending';
  const addressText = formatAddress(pickupLocation);
  const owned = item.ownerId === currentUserId;
  const detailImages = Array.isArray(item.images) && item.images.length > 0
    ? item.images
    : item.imageUrl && !item.imageUrl.includes('picsum.photos')
      ? [item.imageUrl]
      : [];

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-3 sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-[760px] max-h-[92dvh] bg-[#121212] border border-white/10 rounded-[30px] overflow-hidden flex flex-col"
      >
        <div className="px-5 sm:px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <p className="text-[#2DD4BF] text-[10px] font-black uppercase tracking-[0.2em]">Rental Preview</p>
            <h3 className="text-white font-bold text-[18px] mt-1">{item.title}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 md:grid-cols-[1fr_0.85fr] gap-5" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-3">
            <div className="aspect-[4/3] rounded-[24px] overflow-hidden bg-[#0A0A0A] border border-white/10 flex items-center justify-center">
              {detailImages[0] ? (
                <img src={detailImages[0]} alt={item.title} className="w-full h-full object-cover" />
              ) : (
                <CategoryThumbnail item={item} />
              )}
            </div>
            {detailImages.length > 1 && (
              <div className="grid grid-cols-3 gap-2">
                {detailImages.slice(1, 3).map((photo: string) => (
                  <img key={photo} src={photo} alt={item.title} className="aspect-square object-cover rounded-[14px] border border-white/10" />
                ))}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[#A855F7] text-[11px] font-bold uppercase tracking-wider">
                {item.category} {item.tier ? `• ${item.tier} tier` : ''}
              </p>
              <p className="text-white text-[32px] font-black tracking-tight mt-2">₹{item.pricePerDay}<span className="text-[13px] text-white/40 font-bold"> / day</span></p>
            </div>
            <div className="bg-[#0A0A0A] border border-white/10 rounded-[20px] p-4">
              <p className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-2">Pickup</p>
              <p className="text-white/70 text-[13px] leading-relaxed">{city} • {area}</p>
              {addressText && <p className="text-white/45 text-[12px] mt-2 leading-relaxed">{addressText}</p>}
              <p className="text-[#2DD4BF] text-[11px] mt-3 font-bold">Pickup only</p>
            </div>
            {item.description && (
              <div className="bg-[#0A0A0A] border border-white/10 rounded-[20px] p-4">
                <p className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-2">Details</p>
                <p className="text-white/70 text-[13px] leading-relaxed whitespace-pre-wrap">{item.description}</p>
              </div>
            )}
            <button
              onClick={onBook}
              disabled={owned}
              className="w-full bg-[#A855F7] text-white font-bold rounded-[20px] hover:bg-[#9333EA] transition-all text-[13px] py-3.5 flex items-center justify-center gap-2 disabled:opacity-45"
            >
              {owned ? 'Your Listing' : 'Book Now'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SaleMarketplaceCard({ item, currentUserId, onOpen, onChat }: { item: any; currentUserId?: string; onOpen: () => void; onChat: () => void }) {
  const address = item.addressSnapshot || {};
  const city = address.city || item.city || 'Hyderabad';
  const area = address.area || 'Area pending';
  const owned = item.sellerId === currentUserId;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
      onClick={onOpen}
      className="cursor-pointer bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[24px] overflow-hidden group hover:border-white/20 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all flex flex-col duration-300 shadow-lg relative"
    >
      <div className="h-48 bg-[#0A0A0A] relative overflow-hidden flex items-center justify-center border-b-[0.5px] border-white/[0.04]">
        {item.photos?.[0] ? (
          <img src={item.photos[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
        ) : (
          <CategoryThumbnail item={item} />
        )}
        <span className="absolute top-4 right-4 bg-[#2DD4BF]/10 text-[#2DD4BF] text-[11px] font-bold tracking-wider px-3 py-1.5 rounded-[24px] border-[0.5px] border-[#2DD4BF]/20 z-10 uppercase">
          For Sale
        </span>
      </div>
      <div className="p-5 flex flex-1 flex-col z-10 bg-[#121212] relative">
        <p className="text-[#A855F7] text-[10px] font-bold tracking-widest uppercase mb-1">{item.category} • {item.condition}</p>
        <h3 className="font-semibold text-[15px] text-white group-hover:text-[#2DD4BF] transition-colors tracking-tight line-clamp-1 duration-300">{item.title}</h3>
        <p className="text-[#707070] text-[12px] my-4 line-clamp-2 font-medium leading-relaxed flex-1 flex flex-col gap-1.5">
          <span>{city} <span className="opacity-50 mx-1">•</span> {area}</span>
          <span className="flex items-center gap-1.5 text-[11px] bg-white/[0.03] text-white/70 w-fit max-w-full px-2 py-1 rounded-[6px] border border-white/[0.05]">
            <MapPin size={12} className="text-[#A855F7]" />
            Local pickup
          </span>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-4 border-t border-white/10">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium text-[#707070] tracking-wide block mb-0.5">ASKING PRICE</span>
            <span className="text-[16px] font-bold text-white tracking-tight shrink-0">₹{Number(item.price || 0).toLocaleString('en-IN')}</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); if (!owned) onChat(); }} disabled={owned} className="cursor-pointer px-4 py-2 bg-white/[0.02] border-[0.5px] border-white/[0.04] text-white rounded-[24px] hover:bg-white/10 active:scale-95 transition-all text-[12px] font-semibold disabled:opacity-50">
            {owned ? 'Owned' : 'Chat'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SaleListingDetailModal({ item, currentUserId, onClose, onChat }: { item: any; currentUserId?: string; onClose: () => void; onChat: () => void }) {
  const address = item.addressSnapshot || {};
  const addressText = address.formattedAddress || formatAddress(address);
  const owned = item.sellerId === currentUserId;

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-3 sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-[760px] max-h-[92dvh] bg-[#121212] border border-white/10 rounded-[30px] overflow-hidden flex flex-col"
      >
        <div className="px-5 sm:px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <p className="text-[#A855F7] text-[10px] font-black uppercase tracking-[0.2em]">For Sale</p>
            <h3 className="text-white font-bold text-[18px] mt-1">{item.title}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 md:grid-cols-[1fr_0.85fr] gap-5" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-3">
            <div className="aspect-[4/3] rounded-[24px] overflow-hidden bg-[#0A0A0A] border border-white/10 flex items-center justify-center">
              {item.photos?.[0] ? <img src={item.photos[0]} alt={item.title} className="w-full h-full object-cover" /> : <CategoryThumbnail item={item} />}
            </div>
            {item.photos?.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {item.photos.slice(1, 5).map((photo: string) => (
                  <img key={photo} src={photo} alt={item.title} className="aspect-square object-cover rounded-[14px] border border-white/10" />
                ))}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[#2DD4BF] text-[11px] font-bold uppercase tracking-wider">{item.category} • {item.condition}</p>
              <p className="text-white text-[32px] font-black tracking-tight mt-2">₹{Number(item.price || 0).toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-[#0A0A0A] border border-white/10 rounded-[20px] p-4">
              <p className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-2">Description</p>
              <p className="text-white/70 text-[13px] leading-relaxed whitespace-pre-wrap">{item.description}</p>
            </div>
            <div className="bg-[#0A0A0A] border border-white/10 rounded-[20px] p-4">
              <p className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-2">Seller</p>
              <p className="text-white text-[13px] font-bold">{item.sellerName || 'GearUp Seller'}</p>
              <p className="text-white/45 text-[12px] mt-1">{item.city}</p>
            </div>
            {addressText && (
              <div className="bg-[#0A0A0A] border border-white/10 rounded-[20px] p-4">
                <p className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-2">Pickup Area</p>
                <p className="text-white/65 text-[12px] leading-relaxed">{addressText}</p>
              </div>
            )}
            <button
              onClick={onChat}
              disabled={owned}
              className="w-full bg-[#A855F7] text-white font-bold rounded-[20px] hover:bg-[#9333EA] transition-all text-[13px] py-3.5 flex items-center justify-center gap-2 disabled:opacity-45"
            >
              <MessageCircle size={16} />
              {owned ? 'Your Listing' : 'Chat with Seller'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

MarketplaceView.displayName = 'MarketplaceView';

export default MarketplaceView;
