

import React, { useEffect, useState, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { collection, query, limit, onSnapshot, where } from 'firebase/firestore';
import { Camera, PlusCircle, Loader2, MapPin, Truck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import BookingModal from '../modals/BookingModal';

const CATEGORIES = ['Laptops', 'Desktops', 'GPUs', 'Consoles', 'Monitors', 'Controllers'];

const MarketplaceView = memo(({ selectedCity }: { selectedCity: string }) => {

  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [fetchingItems, setFetchingItems] = useState(true);
  const [bookingItem, setBookingItem] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All Gear');

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

  const handleBook = async (item: any) => {
    if (!user) return;
    setBookingItem(item);
  };

  const getTierColor = (t: string) => {
    if (t === 'High') return 'text-[#A855F7] border-[#A855F7]/30 bg-[#A855F7]/10';
    if (t === 'Mid') return 'text-[#2DD4BF] border-[#2DD4BF]/30 bg-[#2DD4BF]/10';
    return 'text-white border-white/20 bg-white/5';
  };

  const filteredItems = items.filter((item) => {
    const itemCity = item.location?.city || item.city || 'Hyderabad';
    const isAvailable = !item.status || item.status === 'AVAILABLE';
    const cityMatches = itemCity === selectedCity;
    const categoryMatches = selectedCategory === 'All Gear' || item.category === selectedCategory;
    return isAvailable && cityMatches && categoryMatches;
  });


  return (
    <div className="p-4 sm:p-6 md:p-10 space-y-8 md:space-y-10">
      <div className="mb-2">
        <h2 className="text-4xl sm:text-6xl md:text-8xl font-black mb-8 md:mb-12 tracking-tighter">
          <span className="text-white">Explore the </span>
          <span className="text-[#2DD4BF] italic">Armory.</span>
        </h2>
        <div className="flex gap-6 md:gap-8 overflow-x-auto pb-0 scrollbar-hide border-b border-white/5 relative">
          {['All Gear', ...CATEGORIES].map((cat, idx) => (
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

      {fetchingItems ? (
        <div className="h-[40vh] flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-[#A855F7] animate-spin" />
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, idx) => {
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
                  {item.imageUrl && !item.imageUrl.includes('picsum.photos') ? (
                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out relative z-0" />
                  ) : (
                    <Camera size={64} className="text-white-[0.02] group-hover:scale-110 group-hover:text-white/10 transition-all duration-700 relative z-0" opacity={0.1} />
                  )}
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

                  {item.logisticsType && (
                    <span className="flex items-center gap-1.5 text-[11px] bg-white/[0.03] text-white/70 w-fit max-w-full px-2 py-1 rounded-[6px] border border-white/[0.05]">
                      {item.logisticsType === 'Owner Delivery' || item.logisticsType === 'delivery' ? <Truck size={12} className="text-[#A855F7]" /> : <MapPin size={12} className="text-[#A855F7]" />}
                      {item.logisticsType === 'Owner Delivery' || item.logisticsType === 'delivery' ? 'Home Delivery' : 'Self-Pickup'}
                    </span>
                  )}
                </p>
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-4 border-t border-white/10">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-medium text-[#707070] tracking-wide block mb-0.5">PER DAY</span>
                      <span className="text-[15px] font-bold text-white tracking-tight shrink-0">₹{item.pricePerDay}</span>
                      <span className="text-[11px] text-white/45 mt-1">Deposit ₹{item.depositAmount || 0}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleBook(item); }} disabled={bookingItem?.id === item.id || item.ownerId === user?.uid} className="cursor-pointer px-4 py-2 bg-white/[0.02] border-[0.5px] border-white/[0.04] text-white rounded-[24px] hover:bg-white/10 active:scale-95 transition-all text-[12px] font-semibold disabled:opacity-50">
                      {item.ownerId === user?.uid ? 'Owned' : 'Book Now'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )})}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-[50vh]">
          <div className="w-full max-w-md p-6 sm:p-10 bg-[#121212] rounded-[24px] mb-8 border-[0.5px] border-white/[0.04] shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-[#A855F7] to-transparent"></div>
             <Camera size={48} className="text-[#A855F7]/40 mb-6 mx-auto" />
             <h3 className="text-[20px] font-bold text-white mb-2 tracking-tight text-center">Vault is Empty</h3>
             <p className="text-[#707070] text-[13px] text-center max-w-sm mb-8 font-medium leading-relaxed mx-auto">
                No {selectedCategory !== 'All Gear' ? selectedCategory : 'Gear'} listed in {selectedCity} yet. Be the first explorer to list high-end gear.

             </p>
             <button onClick={() => window.dispatchEvent(new CustomEvent('open-list-modal'))} className="cursor-pointer flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[#A855F7] text-white font-bold rounded-[24px] hover:bg-[#9333EA] hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] active:bg-[#7e22ce] active:scale-95 transition-all text-[13px] tracking-wide mx-auto">
               <PlusCircle size={18} />
               Drop First Listing
             </button>
          </div>
        </motion.div>
      )}
      {bookingItem && (
         <BookingModal item={bookingItem} onClose={() => setBookingItem(null)} />
      )}
    </div>
  );
});

MarketplaceView.displayName = 'MarketplaceView';

export default MarketplaceView;
