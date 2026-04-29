import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, MapPin, Truck, ArrowLeft, Clock, Zap } from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/src/context/AuthContext';

const DURATIONS = [
  { days: 1, label: '1 Day', labelShort: '1 Day', discountPercent: 0 },
  { days: 3, label: '3 Days', labelShort: '3 Days', discountPercent: 22 },
  { days: 7, label: '1 Week', labelShort: '1 Week', discountPercent: 14 },
  { days: 30, label: '1 Month', labelShort: '1 Month', discountPercent: 33 },
  { days: 'Custom', label: 'Custom', labelShort: 'Custom', discountPercent: 0 }
];

export default function BookingModal({ item, onClose }: { item: any, onClose: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [duration, setDuration] = useState<number | 'Custom' | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('Morning (8 AM - 11 AM)');
  const [loading, setLoading] = useState(false);

  // Compute final days based on selection or custom dates
  let finalDays = 0;
  if (duration === 'Custom') {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (start <= end) finalDays = diffDays === 0 ? 1 : diffDays;
    }
  } else if (typeof duration === 'number') {
    finalDays = duration;
  }

  // Dynamic pricing with hardcoded discount % mapping to item's price
  const itemPrice = item.pricePerDay || 0;
  const getDiscountedPrice = (days: number, pricePerDay: number) => {
    if (days === 1) return pricePerDay;
    if (days === 3) return Math.round(pricePerDay * 3 * 0.78); // 22%
    if (days === 7) return Math.round(pricePerDay * 7 * 0.86); // 14%
    if (days === 30) return Math.round(pricePerDay * 30 * 0.67); // 33%
    return pricePerDay * days;
  };

  const baseTotalPrice = finalDays * itemPrice;
  const discountedBasePrice = duration !== 'Custom' && finalDays > 0 ? getDiscountedPrice(finalDays, itemPrice) : baseTotalPrice;
  const logisticsAdj = item.logisticsAdjustment || 0;
  const finalTotalPrice = discountedBasePrice + logisticsAdj;

  const handleConfirm = async () => {
    if (!user || finalDays <= 0 || !startDate) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'rentals'), {
        gearId: item.id,
        gearTitle: item.title,
        renterId: user.uid,
        renterEmail: user.email,
        ownerId: item.ownerId,
        ownerEmail: item.ownerEmail || 'GearUp Partner',
        startDate: new Date(startDate),
        durationDays: finalDays,
        timeSlot: timeSlot,
        status: 'REQUESTED',
        totalPrice: finalTotalPrice,
        logisticsType: item.logisticsType || 'pickup',
        logisticsAdjustment: logisticsAdj,
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'notifications'), {
        userId: item.ownerId,
        title: 'New Booking Request',
        message: `${user.email} requested to book ${item.title} for ${finalDays} days.`,
        type: 'request',
        read: false,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'listings', item.id), {
        status: 'RESERVED'
      });
      
      onClose();
    } catch (err) {
      console.error('Booking error: ', err);
    } finally {
      setLoading(false);
    }
  };

  const getPickupDateStr = () => {
    if (!startDate || finalDays <= 0) return '';
    const start = new Date(startDate);
    // Buffer days: Start = Delivery, Middle = Use days, End = Return (+ 1 day)
    start.setDate(start.getDate() + finalDays + 1); 
    return start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getStartDateStr = () => {
    if(!startDate) return '';
    const start = new Date(startDate);
    return start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
           initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
           onClick={onClose}
           className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />
        <motion.div
           initial={{ opacity: 0, scale: 0.95, y: 20 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.95, y: 20 }}
           className="bg-[#121212] w-full max-w-[900px] rounded-[32px] overflow-y-auto md:overflow-hidden border border-[#222] shadow-[0_0_80px_rgba(0,0,0,0.8)] relative z-10 flex flex-col md:flex-row max-h-[95vh] no-scrollbar"
         >
           {/* Left side: Gear Info */}
           <div className="w-full md:w-3/5 bg-[#080808] border-b md:border-b-0 md:border-r border-[#222] p-6 md:p-8 flex flex-col shrink-0 md:overflow-y-auto no-scrollbar">
              <div className="h-[200px] md:h-[300px] bg-[#121212] rounded-[24px] border border-[#222] flex items-center justify-center mb-6 overflow-hidden relative">
                {item.imageUrl && !item.imageUrl.includes('picsum.photos') ? (
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white/20 font-medium tracking-wide">Image Preview</span>
                )}
              </div>
              <h2 className="text-[20px] md:text-[24px] font-bold text-white mb-2 tracking-tight line-clamp-2 md:line-clamp-none">{item.title}</h2>
              <p className="text-[14px] text-white/50 mb-6">{item.category} • {item.location || 'Local'}</p>

              <div className="space-y-4 pt-6 mt-auto border-t border-[#222]">
                 <h3 className="text-[12px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
                   <Zap size={14} className="text-[#A855F7]" />
                   Hardware Guidelines
                 </h3>
                 <ul className="text-[13px] text-white/70 space-y-2 list-disc list-inside">
                    <li>Requires valid ID on delivery.</li>
                    <li>Inspect condition upon receipt.</li>
                    <li>Return with all cables/accessories.</li>
                 </ul>
              </div>
           </div>

           {/* Right side: Booking Logic */}
           <div className="flex-1 w-full md:w-2/5 flex flex-col bg-[#0A0A0A] static md:relative">
             {/* Header */}
             <div className="px-6 py-5 flex items-center justify-between shrink-0 border-b border-[#222] bg-[#121212] sticky top-0 z-30">
               <div className="flex items-center gap-3">
                 {step === 2 && (
                   <button onClick={() => setStep(1)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white">
                     <ArrowLeft size={18} />
                   </button>
                 )}
                 <h2 className="text-[15px] font-semibold text-white">
                   {step === 1 ? 'Select Duration' : 'Choose Dates'}
                 </h2>
               </div>
               <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all">
                 <X size={20} />
               </button>
             </div>
             
             {/* Scrolling Content */}
             <div className="p-6 space-y-6 flex-1 pb-10 md:pb-32 md:overflow-y-auto no-scrollbar">
                {step === 1 ? (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                       {DURATIONS.map((d) => (
                         <button 
                           key={d.label} 
                           onClick={() => setDuration(d.days as number | 'Custom')}
                           className={`py-3 px-4 text-left rounded-[16px] border transition-all relative group flex flex-col ${duration === d.days ? 'border-[#A855F7] bg-[#A855F7]/10' : 'border-[#222] bg-[#1a1a1a] hover:border-[#444]'}`}
                         >
                           {d.discountPercent > 0 && (
                             <span className="absolute -top-2.5 -right-2.5 bg-[#10B981] text-white text-[10px] font-black px-2 py-0.5 rounded-[8px] shadow-[0_4px_10px_rgba(16,185,129,0.3)] border border-[#10B981]/20 transform rotate-2">
                               SAVE {d.discountPercent}%
                             </span>
                           )}
                           <span className={`text-[14px] font-bold tracking-tight mb-1 ${duration === d.days ? 'text-white' : 'text-white/80'}`}>{d.label}</span>
                           <span className={`text-[12px] font-medium ${duration === d.days ? 'text-[#2DD4BF]' : 'text-white/50'}`}>
                             {d.days === 'Custom' ? 'Select range' : `₹${getDiscountedPrice(d.days as number, itemPrice)}`}
                           </span>
                         </button>
                       ))}
                    </div>

                    {duration !== null && duration !== 'Custom' && (
                      <div className="p-5 border border-[#333] bg-[#1a1a1a] rounded-[24px] space-y-3 mt-6">
                        <div className="flex items-center gap-2 mb-4 text-[12px] font-bold tracking-wider uppercase text-white/50">
                           Pricing Summary
                        </div>
                        <div className="flex justify-between items-center text-[13px]">
                           <span className="text-white/70">Base ({finalDays} Days)</span>
                           <span className="font-medium text-white flex items-center gap-2">
                              {discountedBasePrice < baseTotalPrice && (
                                 <span className="text-white/40 line-through text-[12px]">₹{baseTotalPrice}</span>
                              )}
                              ₹{discountedBasePrice}
                           </span>
                        </div>
                        <div className="flex justify-between items-center text-[13px]">
                           <span className="text-white/70 flex items-center gap-1.5">
                             {item.logisticsType === 'delivery' || item.logisticsType === 'Owner Delivery' ? 'Delivery Fee' : 'Self-Pickup Adjustment'}
                           </span>
                           <span className={`font-medium ${logisticsAdj > 0 ? 'text-[#A855F7]' : 'text-[#2DD4BF]'}`}>
                              {logisticsAdj > 0 ? `+₹${logisticsAdj}` : `-₹${Math.abs(logisticsAdj)}`}
                           </span>
                        </div>
                        <div className="pt-4 mt-2 border-t border-[#333] flex justify-between items-center">
                          <span className="text-[14px] font-bold text-white/70">Estimated Total</span>
                          <span className="text-[28px] font-black text-white tracking-tight">₹{Math.max(0, finalTotalPrice)}</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                       <div>
                         <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">{item.logisticsType === 'delivery' || item.logisticsType === 'Owner Delivery' ? 'Delivery Date' : 'Pickup Date'}</label>
                         <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-[#1A1A1A] text-white border border-[#333] rounded-[16px] p-4 text-[14px] focus:border-[#A855F7] outline-none transition-colors shadow-inner [color-scheme:dark]" />
                       </div>
                       
                       {duration === 'Custom' ? (
                         <div>
                           <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">Return Date</label>
                           <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-[#1A1A1A] text-white border border-[#333] rounded-[16px] p-4 text-[14px] focus:border-[#A855F7] outline-none transition-colors shadow-inner [color-scheme:dark]" />
                         </div>
                       ) : (
                         <div>
                           <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">Return Date</label>
                           <div className="w-full bg-[#121212] flex items-center text-white/70 border border-[#222] rounded-[16px] p-4 text-[14px] font-medium pointer-events-none">
                             {startDate ? getPickupDateStr() : 'Select start date'}
                           </div>
                         </div>
                       )}
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">Time Slot</label>
                      <div className="relative">
                        <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} className="w-full bg-[#1A1A1A] text-white border border-[#333] rounded-[16px] p-4 text-[14px] focus:border-[#A855F7] outline-none appearance-none [color-scheme:dark]">
                          <option>Morning (8 AM - 11 AM)</option>
                          <option>Evening (6 PM - 9 PM)</option>
                        </select>
                        <Clock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                      </div>
                    </div>

                    {startDate && duration !== 'Custom' && (
                      <div className="p-4 bg-[#121212] border border-[#222] rounded-[16px]">
                        <p className="text-[12px] text-white/60 leading-relaxed">
                          <strong className="text-white">Buffer Rule Applied:</strong> Your gear begins on <strong className="text-[#A855F7]">{getStartDateStr()}</strong>. It is reserved for <strong className="text-[#A855F7]">{finalDays} day(s)</strong> of use, and returned on <strong className="text-[#2DD4BF]">{getPickupDateStr()}</strong>.
                        </p>
                      </div>
                    )}
                    
                    {duration === 'Custom' && startDate && endDate && finalDays > 0 && (
                      <div className="p-5 border border-[#333] bg-[#1a1a1a] rounded-[24px] space-y-3 mt-6">
                        <div className="flex justify-between items-center text-[13px]">
                           <span className="text-white/70">Base ({finalDays} Days)</span>
                           <span className="font-medium text-white flex items-center gap-2">
                              ₹{baseTotalPrice}
                           </span>
                        </div>
                        <div className="flex justify-between items-center text-[13px]">
                           <span className="text-white/70 flex items-center gap-1.5">
                             {item.logisticsType === 'delivery' || item.logisticsType === 'Owner Delivery' ? 'Delivery Fee' : 'Self-Pickup Adjustment'}
                           </span>
                           <span className={`font-medium ${logisticsAdj > 0 ? 'text-[#A855F7]' : 'text-[#2DD4BF]'}`}>
                              {logisticsAdj > 0 ? `+₹${logisticsAdj}` : `-₹${Math.abs(logisticsAdj)}`}
                           </span>
                        </div>
                        <div className="pt-4 mt-2 border-t border-[#333] flex justify-between items-center">
                          <span className="text-[14px] font-bold text-white/70">Estimated Total</span>
                          <span className="text-[28px] font-black text-white tracking-tight">₹{Math.max(0, finalTotalPrice)}</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
             </div>

             {/* Sticky Footer */}
             <div className="relative md:absolute mt-auto bottom-0 left-0 right-0 px-6 py-4 border-t border-[#222] bg-[#121212] z-20 flex justify-end gap-3 pb-8 md:pb-4">
               <button onClick={onClose} className="px-6 py-3 text-white/50 hover:text-white font-bold text-[13px] active:scale-95 transition-all">Cancel</button>
               {step === 1 ? (
                 <button 
                   onClick={() => setStep(2)} 
                   disabled={duration === null} 
                   className="px-8 py-3 bg-[#A855F7] text-white font-bold text-[13px] rounded-[24px] shadow-[0_0_20px_rgba(168,85,247,0.3)] disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                 >
                   Next: Choose Dates
                 </button>
               ) : (
                 <button 
                   onClick={handleConfirm} 
                   disabled={finalDays <= 0 || !startDate || loading} 
                   className="px-8 py-3 bg-[#10B981] text-white font-bold text-[13px] rounded-[24px] shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center justify-center min-w-[160px]"
                 >
                   {loading ? <span className="animate-pulse">Processing...</span> : 'Confirm Request'}
                 </button>
               )}
             </div>
           </div>
         </motion.div>
      </div>
    </AnimatePresence>
  );
}


