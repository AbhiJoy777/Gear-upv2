

import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Box, PlusCircle, ShoppingBag, Loader2, Camera, Check, X, ShieldCheck, Navigation, QrCode, MessageCircle, RotateCcw, AlertTriangle, Ban, Flag } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import HandshakeModal from '../modals/HandshakeModal';
import { useToast } from '@/context/ToastContext';
import ConfirmModal from '../modals/ConfirmModal';
import ChatModal from '../modals/ChatModal';
import ReportIssueModal from '../modals/ReportIssueModal';


type Tab = 'listings' | 'rentals';

const DashboardView = memo(({ setActiveView }: { setActiveView?: (view: string) => void }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('listings');
  const [listings, setListings] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [ownerRentals, setOwnerRentals] = useState<any[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [loadingRentals, setLoadingRentals] = useState(true);
  const [selectedRental, setSelectedRental] = useState<any>(null);
  const [rentalRole, setRentalRole] = useState<'owner' | 'renter'>('owner');
  const [initialHandshakeStep, setInitialHandshakeStep] = useState<any>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [chatRental, setChatRental] = useState<any>(null);
  const [reportContext, setReportContext] = useState<any>(null);

  const LOCKED_RENTAL_STATUSES = ['ACCEPTED', 'PROOF_RECORDED', 'LOGISTICS_PENDING', 'PAYMENT_PENDING', 'ACTIVE_RENTAL', 'RETURN_DUE'];
  const CANCELLABLE_RENTAL_STATUSES = ['ACCEPTED', 'PROOF_RECORDED', 'LOGISTICS_PENDING', 'PAYMENT_PENDING'];

  const canChat = (status: string) =>
    ['ACCEPTED', 'PROOF_RECORDED', 'LOGISTICS_PENDING', 'PAYMENT_PENDING', 'ACTIVE_RENTAL', 'RETURN_DUE'].includes(status);

  const openRentalReport = (rental: any) => {
    setReportContext({
      rental,
      againstUserId: rental.ownerId === user?.uid ? rental.renterId : rental.ownerId,
    });
  };

  const getRentalEndDate = (rental: any) => {
    if (!rental?.actualStartTime || !rental?.durationDays) return null;
    const start = rental.actualStartTime.toDate ? rental.actualStartTime.toDate() : new Date(rental.actualStartTime);
    return new Date(start.getTime() + rental.durationDays * 24 * 60 * 60 * 1000);
  };

  const getLateDays = (rental: any) => {
    const end = getRentalEndDate(rental);
    if (!end) return 0;
    const diff = Date.now() - end.getTime();
    if (diff <= 0) return 0;
    return Math.floor(diff / (24 * 60 * 60 * 1000));
  };

  const getDailyRent = (rental: any) => {
    if (rental.pricePerDay) return rental.pricePerDay;
    if (rental.totalPrice && rental.durationDays) return Math.ceil(rental.totalPrice / rental.durationDays);
    return 0;
  };

  const getExtraAmountDue = (rental: any) => {
    const lateDays = getLateDays(rental);
    return lateDays * (getDailyRent(rental) + 100);
  };

  const moveToReturnDue = async (rental: any) => {
    if (!rental?.id || rental.status !== 'ACTIVE_RENTAL') return;
    try {
      await updateDoc(doc(db, 'rentals', rental.id), {
        status: 'RETURN_DUE',
        returnDueAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      showToast('Failed to move rental to return due.', 'error');
    }
  };

  const handleReturnGear = async (rental: any) => {
    const lateDays = getLateDays(rental);
    const extraAmountDue = getExtraAmountDue(rental);

    try {
      await updateDoc(doc(db, 'rentals', rental.id), {
        status: 'RETURNED',
        returnedAt: serverTimestamp(),
        lateDays,
        extraAmountDue,
      });
      await updateDoc(doc(db, 'listings', rental.gearId), { status: 'AVAILABLE' });
      await addDoc(collection(db, 'notifications'), {
        userId: rental.ownerId,
        title: 'Gear Returned',
        message: `${rental.gearTitle} has been marked returned.${extraAmountDue > 0 ? ` Extra amount due: Rs ${extraAmountDue}.` : ''}`,
        type: 'return',
        read: false,
        createdAt: serverTimestamp(),
      });
      showToast('Return marked complete.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to mark return complete.', 'error');
    }
  };

  const cancelRental = async (rental: any, cancelledBy: 'owner' | 'renter') => {
    try {
      await updateDoc(doc(db, 'rentals', rental.id), {
        status: 'CANCELLED',
        cancelledBy,
        cancelledAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'listings', rental.gearId), { status: 'AVAILABLE' });
      await addDoc(collection(db, 'notifications'), {
        userId: cancelledBy === 'owner' ? rental.renterId : rental.ownerId,
        title: cancelledBy === 'owner' ? 'Renting Cancelled' : 'Borrowing Cancelled',
        message: `${rental.gearTitle} rental was cancelled before handoff.`,
        type: 'cancelled',
        read: false,
        createdAt: serverTimestamp(),
      });
      showToast('Rental cancelled.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to cancel rental.', 'error');
    }
  };


  useEffect(() => {
    if (!user) return;

    const gearRef = collection(db, 'listings');
    const qGear = query(gearRef, where('ownerId', '==', user.uid));
    const unsubscribeGear = onSnapshot(qGear, (snapshot) => {
      setListings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingListings(false);
    });

    const rentalsRef = collection(db, 'rentals');
    const qRentals = query(rentalsRef, where('renterId', '==', user.uid));
    const unsubscribeRentals = onSnapshot(qRentals, (snapshot) => {
      setRentals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingRentals(false);
    });

    const qOwnerRentals = query(rentalsRef, where('ownerId', '==', user.uid));
    const unsubscribeOwnerRentals = onSnapshot(qOwnerRentals, (snapshot) => {
      setOwnerRentals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeGear();
      unsubscribeRentals();
      unsubscribeOwnerRentals();
    };
  }, [user]);

  useEffect(() => {
    const active = [...rentals, ...ownerRentals].filter((r) => r.status === 'ACTIVE_RENTAL');
    if (active.length === 0) return;

    const checkExpiredRentals = () => {
      active.forEach((rental) => {
        const end = getRentalEndDate(rental);
        if (end && end.getTime() <= Date.now()) {
          moveToReturnDue(rental);
        }
      });
    };

    checkExpiredRentals();
    const interval = window.setInterval(checkExpiredRentals, 60 * 1000);
    return () => window.clearInterval(interval);
  }, [rentals, ownerRentals]);

  const handleAccept = async (e: React.MouseEvent, rentalId: string, gearId: string) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'rentals', rentalId), { status: 'ACCEPTED' });
      // Don't mark as RENTED yet, wait for handshake
    } catch (err) {
      console.error(err);
    }
  };

  const openHandshake = (rental: any, role: 'owner' | 'renter', step?: string) => {
    setSelectedRental(rental);
    setRentalRole(role);
    setInitialHandshakeStep(step);
  };

  const handleDecline = async (e: React.MouseEvent, rentalId: string, gearId: string) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'rentals', rentalId), { status: 'DECLINED' });
      await updateDoc(doc(db, 'listings', gearId), { status: 'AVAILABLE' });
    } catch (err) {
      console.error(err);
    }
  };

  const getTierColor = (t: string) => {
    if (t === 'High') return 'text-[#A855F7] border-[#A855F7]/30 bg-[#A855F7]/10';
    if (t === 'Mid') return 'text-[#2DD4BF] border-[#2DD4BF]/30 bg-[#2DD4BF]/10';
    return 'text-white border-white/20 bg-white/5';
  };

  return (
    <div className="p-6 md:p-10 space-y-4">
      <div className="flex gap-8 border-b border-white/5 pb-0">
        {(['listings', 'rentals'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="cursor-pointer relative pb-4 group"
          >
            <span className={`text-sm font-semibold tracking-wide transition-colors ${
              activeTab === tab ? 'text-white' : 'text-[#707070] group-hover:text-white'
            }`}>
              {tab === 'listings' ? 'My Listings' : 'My Rentals'}
            </span>
            {activeTab === tab && (
              <motion.div 
                layoutId="dashboardTab"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#A855F7]"
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="w-full"
        >
          {activeTab === 'listings' ? (
            loadingListings ? (
              <div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 text-[#A855F7] animate-spin" /></div>
            ) : listings.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full text-left">
                {listings.map((item, idx) => {
                  const pendingRental = ownerRentals.find(r => r.gearId === item.id && r.status === 'REQUESTED');
                  const activeRental = ownerRentals.find(r => r.gearId === item.id && ['ACTIVE_RENTAL', 'RETURN_DUE'].includes(r.status));
                  const lockedRental = ownerRentals.find(r => r.gearId === item.id && LOCKED_RENTAL_STATUSES.includes(r.status));
                  
                  return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[24px] overflow-hidden flex flex-col w-full select-none"
                  >
                    <div className="h-48 bg-[#0A0A0A] relative overflow-hidden flex items-center justify-center border-b-[0.5px] border-white/[0.04]">
                      {item.tier && (
                        <span className={`absolute top-4 right-4 text-[11px] font-bold tracking-wider px-3 py-1.5 rounded-[24px] border-[0.5px] z-10 uppercase ${getTierColor(item.tier)}`}>
                          {item.tier} TIER
                        </span>
                      )}
                      {item.imageUrl && !item.imageUrl.includes('picsum') ? (
                        <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover opacity-80" />
                      ) : (
                        <Camera size={48} className="text-white/10" />
                      )}
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-semibold text-[15px] text-white tracking-tight line-clamp-1">{item.title}</h3>
                      <p className="text-[#707070] text-[12px] mt-1 mb-4 uppercase border-b border-white/5 pb-2">{item.category}</p>
                      
                      {activeRental && activeRental.actualStartTime && (
                        <div className={`mb-6 p-4 rounded-[16px] border space-y-3 ${
                          activeRental.status === 'RETURN_DUE'
                            ? 'bg-red-500/10 border-red-500/20'
                            : 'bg-[#2DD4BF]/10 border-[#2DD4BF]/20'
                        }`}>
                          <p className={`text-[10px] uppercase font-bold tracking-wider ${
                            activeRental.status === 'RETURN_DUE' ? 'text-red-400' : 'text-[#2DD4BF]'
                          }`}>
                            {activeRental.status === 'RETURN_DUE' ? 'Return Due' : 'Rental Active'}
                          </p>
                          <div className="flex items-center gap-2 text-white font-mono text-sm">
                            <Box size={14} className={activeRental.status === 'RETURN_DUE' ? 'text-red-400' : 'text-[#2DD4BF]'} />
                            <span>
                              {(() => {
                                const end = getRentalEndDate(activeRental);
                                if (!end) return 'Timer unavailable';
                                const diff = end.getTime() - Date.now();

                                if (activeRental.status === 'RETURN_DUE' || diff <= 0) {
                                  const lateDays = getLateDays(activeRental);
                                  const extra = getExtraAmountDue(activeRental);
                                  return lateDays > 0 ? `Late by ${lateDays}d - Due Rs ${extra}` : 'Return due now';
                                }

                                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                return `Expires in: ${days}d ${hours}h`;
                              })()}
                            </span>
                          </div>

                          {activeRental.status === 'ACTIVE_RENTAL' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); moveToReturnDue(activeRental); }}
                              className="w-full bg-white/5 text-white/70 font-bold py-2 rounded-[10px] text-[11px] flex items-center justify-center gap-2 hover:bg-white/10 hover:text-white transition-all border border-white/10"
                            >
                              <AlertTriangle size={13} /> Expire for testing
                            </button>
                          )}
                        </div>
                      )}

                      {pendingRental ? (
                         <div className="mt-auto pt-4 space-y-3">
                           <p className="text-[12px] text-white/70">
                             Requested for <strong className="text-white">{pendingRental.durationDays} Days</strong> (₹{pendingRental.totalPrice})
                           </p>
                           <div className="flex gap-2">
                              <button onClick={(e) => handleAccept(e, pendingRental.id, item.id)} className="flex-1 bg-[#2DD4BF] text-black font-bold py-2.5 rounded-[12px] text-[12px] flex flex-row items-center justify-center gap-1.5 hover:bg-[#14b8a6] transition-all">
                                <Check size={14} /> Accept
                              </button>
                              <button onClick={(e) => handleDecline(e, pendingRental.id, item.id)} className="flex-1 bg-white/5 text-white/70 font-bold py-2.5 rounded-[12px] text-[12px] flex flex-row items-center justify-center gap-1.5 hover:bg-white/10 hover:text-white transition-all border border-white/10">
                                <X size={14} /> Decline
                              </button>
                           </div>
                         </div>
                       ) : (
                         <div className="flex flex-col gap-3 mt-auto pt-5">
                            {ownerRentals.filter(r => r.gearId === item.id && ['ACCEPTED', 'PROOF_RECORDED', 'LOGISTICS_PENDING', 'PAYMENT_PENDING'].includes(r.status)).map(r => (
                              <div key={r.id} className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                                <div className="py-2 border-b border-white/5 mb-1">
                                  <p className="text-[11px] text-white/40 font-bold uppercase tracking-wider text-center">Waiting for Handover</p>
                                </div>
                                
                                {CANCELLABLE_RENTAL_STATUSES.includes(r.status) && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); cancelRental(r, 'owner'); }}
                                    className="w-full bg-red-500/10 text-red-400 font-bold py-2.5 rounded-[12px] text-[12px] flex flex-row items-center justify-center gap-2 transition-all border border-red-500/20 hover:bg-red-500/20 cursor-pointer relative z-10"
                                  >
                                    <Ban size={14} /> Cancel Renting
                                  </button>
                                )}

                                {r.status === 'ACCEPTED' ? (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); openHandshake(r, 'owner'); }}
                                    className="w-full bg-[#A855F7] hover:bg-[#B366FF] text-white font-bold py-2.5 rounded-[12px] text-[12px] flex flex-row items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)] cursor-pointer relative z-10"
                                  >
                                    <ShieldCheck size={14} /> Record Proof of Life
                                  </button>
                                ) : (
                                  <div className="w-full bg-white/5 text-[#2DD4BF] font-bold py-2.5 rounded-[12px] text-[11px] flex flex-row items-center justify-center gap-2 select-none border border-white/5">
                                    <Check size={14} className="text-[#2DD4BF]" /> Verified & Ready
                                  </div>
                                )}
                                
                                <button 
                                  onClick={(e) => { e.stopPropagation(); openHandshake(r, 'owner', 'tracking'); }}
                                  disabled={r.status === 'ACCEPTED'}
                                  className={`w-full font-bold py-2.5 rounded-[12px] text-[12px] flex flex-row items-center justify-center gap-2 transition-all cursor-pointer relative z-10 ${
                                    ['PROOF_RECORDED', 'LOGISTICS_PENDING', 'PAYMENT_PENDING'].includes(r.status)
                                      ? 'bg-[#F97316] hover:bg-[#FB923C] text-white' 
                                      : 'bg-white/5 text-white/10 opacity-50 cursor-not-allowed'
                                  }`}
                                >
                                  <Navigation size={14} /> {item.logisticsType === 'delivery' ? 'Navigate to Delivery' : 'Track Borrower'}
                                </button>
                                {canChat(r.status) && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setChatRental(r); }}
                                    className="w-full bg-white/5 text-white/80 font-bold py-2.5 rounded-[12px] text-[12px] flex flex-row items-center justify-center gap-2 transition-all border border-white/10 hover:bg-white/10 hover:text-white cursor-pointer relative z-10"
                                  >
                                    <MessageCircle size={14} /> Chat
                                  </button>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); openRentalReport(r); }}
                                  className="w-full bg-red-500/10 text-red-400 font-bold py-2.5 rounded-[12px] text-[12px] flex flex-row items-center justify-center gap-2 transition-all border border-red-500/20 hover:bg-red-500/20 cursor-pointer relative z-10"
                                >
                                  <Flag size={14} /> Report Issue
                                </button>


                                <button 
                                  onClick={async (e) => { 
                                    e.stopPropagation(); 
                                    try {
                                      await updateDoc(doc(db, 'rentals', r.id), { status: 'LOGISTICS_PENDING' });
                                      openHandshake(r, 'owner', 'logistics'); 
                                    } catch (err) { console.error(err); }
                                  }}
                                  disabled={r.status === 'ACCEPTED'}
                                  className={`w-full font-bold py-2.5 rounded-[12px] text-[12px] flex flex-row items-center justify-center gap-2 transition-all border cursor-pointer relative z-10 ${
                                    ['PROOF_RECORDED', 'LOGISTICS_PENDING', 'PAYMENT_PENDING'].includes(r.status)
                                      ? 'border-white/20 text-white/90 hover:bg-white/10 hover:border-white/30'
                                      : 'border-white/5 text-white/10 opacity-50 cursor-not-allowed'
                                  }`}
                                >
                                  <Check size={14} /> Confirm Handover
                                </button>
                              </div>
                            ))}
                            <div className="flex items-center justify-between mt-2 pt-4 border-t border-white/10">
                               <span className="text-[13px] font-bold text-[#A855F7] tracking-tight">₹{item.pricePerDay} / Day</span>
                               {!lockedRental && (
                                 <div className="flex items-center gap-3">
                                   <button
                                     onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('open-edit-modal', { detail: { item } })); }}
                                     className="text-[12px] text-white/50 tracking-wide font-medium hover:text-white transition-colors bg-transparent border-none cursor-pointer"
                                   >Edit</button>
                                   <button
                                     onClick={(e) => { e.stopPropagation(); setDeleteTarget(item.id); }}
                                     className="text-[12px] text-rose-500/70 tracking-wide font-medium hover:text-rose-400 transition-colors bg-transparent border-none cursor-pointer"
                                   >Delete</button>
                                 </div>
                               )}
                            </div>
                         </div>
                       )}
                    </div>
                  </motion.div>
                )})}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-10 bg-[#121212] rounded-[24px] mx-auto w-fit border-[0.5px] border-white/[0.04]">
                  <Box size={56} className="text-white/20" />
                </div>
                <h3 className="text-[18px] font-semibold text-white tracking-tight">Vault Empty</h3>
                <p className="text-[#707070] text-[13px] max-w-sm mx-auto font-medium px-8 leading-relaxed">
                  Your professional catalog is quiet. Be the first to drop high-end gear in the market.
                </p>
                <button onClick={() => window.dispatchEvent(new CustomEvent('open-list-modal'))} className="cursor-pointer flex items-center gap-2.5 px-6 py-3 bg-[#A855F7] text-white font-semibold rounded-[24px] hover:bg-[#9333EA] hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] active:bg-[#7e22ce] active:scale-95 transition-all text-[13px] tracking-wide mx-auto">
                  <PlusCircle size={18} />
                  List Your Gear
                </button>
              </div>
            )
          ) : (
            loadingRentals ? (
              <div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 text-[#A855F7] animate-spin" /></div>
            ) : rentals.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full text-left">
                {rentals.map((rental, idx) => (
                  <motion.div
                    key={rental.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[24px] overflow-hidden flex flex-col w-full select-none"
                  >
                    <div className="h-48 bg-[#0A0A0A] relative overflow-hidden flex items-center justify-center border-b-[0.5px] border-white/[0.04]">
                      <Camera size={48} className="text-white/10" />
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-semibold text-[15px] text-white tracking-tight line-clamp-1">{rental.gearTitle}</h3>
                      <p className="text-[#707070] text-[12px] mt-1 mb-4 flex items-center gap-1.5 font-medium tracking-wide">
                        Owner: <span className="text-white/80">{rental.ownerEmail || 'GearUp Partner'}</span>
                      </p>
                      
                      <div className="py-3 border-y border-white/5 mb-6 flex items-center justify-between">
                        <span className="text-[11px] text-white/40 font-bold uppercase tracking-widest">Status</span>
                        <span className={`text-[12px] font-bold ${
                          rental.status === 'ACCEPTED' ? 'text-[#F97316]' : rental.status === 'RETURN_DUE' ? 'text-red-400' : 'text-[#2DD4BF]'
                        }`}>
                          {rental.status === 'ACCEPTED'
                            ? 'Owner Securing Gear...'
                            : rental.status === 'PROOF_RECORDED'
                              ? 'Ready for Handover'
                              : rental.status === 'RETURN_DUE'
                                ? 'Return Due'
                                : rental.status}
                        </span>
                      </div>
                      
                      {['ACTIVE_RENTAL', 'RETURN_DUE'].includes(rental.status) && rental.actualStartTime && (
                        <div className={`mb-6 p-4 rounded-[16px] border space-y-3 ${
                          rental.status === 'RETURN_DUE'
                            ? 'bg-red-500/10 border-red-500/20'
                            : 'bg-[#A855F7]/10 border-[#A855F7]/20'
                        }`}>
                          <p className={`text-[10px] uppercase font-bold tracking-wider ${
                            rental.status === 'RETURN_DUE' ? 'text-red-400' : 'text-[#A855F7]'
                          }`}>
                            {rental.status === 'RETURN_DUE' ? 'Return Phase' : 'Time Remaining'}
                          </p>
                          <div className="flex items-center gap-2 text-white font-mono text-lg">
                            <Box size={16} className={rental.status === 'RETURN_DUE' ? 'text-red-400' : 'text-[#A855F7]'} />
                            <span>
                              {(() => {
                                const end = getRentalEndDate(rental);
                                if (!end) return 'Timer unavailable';
                                const diff = end.getTime() - Date.now();

                                if (rental.status === 'RETURN_DUE' || diff <= 0) {
                                  const lateDays = getLateDays(rental);
                                  return lateDays > 0 ? `Late ${lateDays}d` : 'Return due now';
                                }

                                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                return `${days}d ${hours}h ${mins}m`;
                              })()}
                            </span>
                          </div>

                          {rental.status === 'RETURN_DUE' && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-[12px]">
                              <p className="text-[11px] text-red-300 font-bold uppercase tracking-wider mb-1">Remaining Amount Due</p>
                              <p className="text-white text-[15px] font-bold">Rs {getExtraAmountDue(rental)}</p>
                              <p className="text-white/40 text-[11px] mt-1">
                                Extra rent Rs {getDailyRent(rental)} + Rs 100 late fee per delayed day.
                              </p>
                            </div>
                          )}

                          {rental.status === 'ACTIVE_RENTAL' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); moveToReturnDue(rental); }}
                              className="w-full bg-white/5 text-white/70 font-bold py-2 rounded-[10px] text-[11px] flex items-center justify-center gap-2 hover:bg-white/10 hover:text-white transition-all border border-white/10"
                            >
                              <AlertTriangle size={13} /> Expire for testing
                            </button>
                          )}

                          {rental.status === 'RETURN_DUE' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReturnGear(rental); }}
                              className="w-full bg-[#2DD4BF] text-black font-bold py-3 rounded-[14px] text-[12px] flex items-center justify-center gap-2 hover:bg-[#14b8a6] transition-all"
                            >
                              <RotateCcw size={14} /> Return Gear
                            </button>
                          )}
                        </div>
                      )}

                           {canChat(rental.status) && (
                              <div className="flex flex-col gap-2 mb-4" onClick={(e) => e.stopPropagation()}>
                                 <button
                                   onClick={(e) => { e.stopPropagation(); setChatRental(rental); }}
                                   className="w-full bg-white/5 text-white/80 font-bold py-3.5 rounded-[16px] text-[13px] flex flex-row items-center justify-center gap-2 transition-all border border-white/10 hover:bg-white/10 hover:text-white cursor-pointer relative z-10"
                                 >
                                   <MessageCircle size={16} /> Chat
                                 </button>

                            {CANCELLABLE_RENTAL_STATUSES.includes(rental.status) && (
                              <button
                                onClick={(e) => { e.stopPropagation(); cancelRental(rental, 'renter'); }}
                                className="w-full bg-red-500/10 text-red-400 font-bold py-3.5 rounded-[16px] text-[13px] flex flex-row items-center justify-center gap-2 transition-all border border-red-500/20 hover:bg-red-500/20 cursor-pointer relative z-10"
                              >
                                <Ban size={16} /> Cancel Borrowing
                              </button>
                            )}

                            <button
                              onClick={(e) => { e.stopPropagation(); openRentalReport(rental); }}
                              className="w-full bg-white/5 text-red-300 font-bold py-3.5 rounded-[16px] text-[13px] flex flex-row items-center justify-center gap-2 transition-all border border-red-500/20 hover:bg-red-500/10 cursor-pointer relative z-10"
                            >
                              <Flag size={16} /> Report Issue
                            </button>

                            {['ACCEPTED', 'PROOF_RECORDED', 'LOGISTICS_PENDING', 'PAYMENT_PENDING'].includes(rental.status) && (
                              rental.status === 'PAYMENT_PENDING' ? (
                               <button 
                                  onClick={(e) => { e.stopPropagation(); openHandshake(rental, 'renter', 'payment_scan'); }}
                                  className="w-full bg-[#A855F7] hover:bg-[#B366FF] text-white font-bold py-3.5 rounded-[16px] text-[13px] flex flex-row items-center justify-center gap-2 transition-all cursor-pointer relative z-10"
                               >
                                  <QrCode size={16} /> Scan & Pay
                               </button>
                            ) : (
                               <button 
                                  onClick={(e) => { e.stopPropagation(); openHandshake(rental, 'renter', 'tracking'); }}
                                  disabled={rental.status === 'ACCEPTED'}
                                  className={`w-full font-bold py-3.5 rounded-[16px] text-[13px] flex flex-row items-center justify-center gap-2 transition-all cursor-pointer relative z-10 ${
                                    rental.status !== 'ACCEPTED' 
                                      ? 'bg-[#F97316] hover:bg-[#FB923C] text-white' 
                                      : 'bg-white/5 text-white/10 opacity-50 cursor-not-allowed'
                                  }`}
                               >
                                  <Navigation size={16} /> 
                                  {rental.logisticsType === 'delivery' ? 'Track Delivery' : 'Navigate to Pickup'}
                                </button>
                              )
                            )}
                         </div>
                      )}

                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
                         <span className="text-[13px] font-bold text-[#A855F7] tracking-tight">₹{rental.totalPrice}</span>
                         <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-white/30 font-medium uppercase tracking-wider">{rental.durationDays} Days</span>
                            <div className="w-1 h-1 bg-white/10 rounded-full" />
                            <span className="text-[12px] text-white/50 tracking-wide font-medium">Total Price</span>
                         </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-10 bg-[#121212] rounded-[24px] mx-auto w-fit border-[0.5px] border-white/[0.04]">
                  <ShoppingBag size={56} className="text-white/20" />
                </div>
                <h3 className="text-[18px] font-semibold text-white tracking-tight">No Active Leases</h3>
                <p className="text-[#707070] text-[13px] max-w-sm mx-auto font-medium px-8 leading-relaxed">
                  You haven&apos;t leased any hardware yet. Explore the marketplace for professional equipment.
                </p>
                <button onClick={() => setActiveView && setActiveView('marketplace')} className="cursor-pointer flex items-center gap-2.5 px-6 py-3 bg-white/[0.02] border-[0.5px] border-white/[0.04] text-[#707070] font-semibold rounded-[24px] hover:bg-white/5 hover:text-white active:scale-95 transition-all text-[13px] tracking-wide mx-auto">
                  Explore Market
                </button>
              </div>
            )
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {selectedRental && (
          <HandshakeModal 
            rental={selectedRental}
            userRole={rentalRole}
            initialStep={initialHandshakeStep}
            onClose={() => {
              setSelectedRental(null);
              setInitialHandshakeStep(undefined);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {chatRental && (
          <ChatModal
            rental={chatRental}
            onClose={() => setChatRental(null)}
          />
        )}
      </AnimatePresence>
      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete listing?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const id = deleteTarget!;
          setDeleteTarget(null);
          try {
            await deleteDoc(doc(db, 'listings', id));
            showToast('Listing deleted.', 'success');
          } catch (err) {
            showToast('Failed to delete listing.', 'error');
          }
        }}
      />
      <AnimatePresence>
        {reportContext && (
          <ReportIssueModal
            context={reportContext}
            onClose={() => setReportContext(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

DashboardView.displayName = 'DashboardView';

export default DashboardView;
