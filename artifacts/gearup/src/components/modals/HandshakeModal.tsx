

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, MapPin, ShieldCheck, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/context/ToastContext';
import { RentalTimelineSummary } from '@/components/common/RentalTimeline';

interface HandshakeModalProps {
  rental: any;
  onClose: () => void;
  userRole: 'owner' | 'renter';
  initialStep?: HandshakeStep;
}

type HandshakeStep = 'proof_of_life' | 'tracking' | 'logistics' | 'qr_handover' | 'payment_scan';

export default function HandshakeModal({ rental, onClose, userRole, initialStep }: HandshakeModalProps) {
  const { showToast } = useToast();
  const [step, setStep] = useState<HandshakeStep>(initialStep || 'tracking');
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [loading, setLoading] = useState(false);
  const paymentSecured = rental.payment?.status === 'paid' || rental.paymentStatus === 'paid';
  const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || window.__GEARUP_CONFIG__?.razorpayKey;

  console.log('Razorpay key:', razorpayKey);
  
  useEffect(() => {
    if (initialStep) {
      setStep(initialStep);
      return;
    }
    // Determine initial step based on status and role
    if (rental.status === 'ACCEPTED' && userRole === 'owner') {
      setStep('proof_of_life');
    } else if (rental.status === 'PROOF_RECORDED') {
      setStep('tracking');
    } else if (rental.status === 'LOGISTICS_PENDING') {
      setStep('logistics');
    } else if (rental.status === 'PAYMENT_PENDING') {
       if (userRole === 'owner') setStep('qr_handover');
       else setStep('payment_scan');
    }
  }, [rental.status, userRole, initialStep]);

  // Proof of Life Simulation
  const startRecording = async () => {
    setRecording(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setCountdown(Math.ceil((100 - progress) / 5) * 0.1); // Simplified display
      if (progress >= 100) {
        clearInterval(interval);
        completeSimulation();
      }
    }, 100);
  };

  const completeSimulation = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'rentals', rental.id), {
        status: 'PROOF_RECORDED',
        proofOfLifeUrl: 'https://example.com/simulated-video.mp4',
        proofRecordedAt: serverTimestamp(),
      });
      onClose(); // Automatically close as requested
    } catch (err) {
      console.error(err);
      showToast('Could not record proof of life. Please try again.', 'error');
    } finally {
      setLoading(false);
      setRecording(false);
    }
  };

  // Logistics Selection
  const handleSelectLogistics = async (type: 'drop_off' | 'owner_pickup') => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'rentals', rental.id), {
        status: paymentSecured ? 'ACTIVE_RENTAL' : 'PAYMENT_PENDING',
        returnLogistics: type,
        logisticsPendingAt: serverTimestamp(),
        ...(paymentSecured ? {
          actualStartTime: serverTimestamp(),
          activeAt: serverTimestamp(),
          paymentCompletedAt: serverTimestamp(),
          returnDueAt: null,
        } : {}),
      });
      if (paymentSecured) {
        await updateDoc(doc(db, 'listings', rental.gearId), {
          status: 'IN_USE',
          updatedAt: serverTimestamp(),
        });
        showToast('Payment already secured. Rental is now active.', 'success');
        onClose();
        return;
      }

      setStep(userRole === 'owner' ? 'qr_handover' : 'payment_scan');
    } catch (err) {
      console.error(err);
      showToast('Could not update return logistics. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const completeHandover = async () => {
    if (!paymentSecured) {
      throw new Error('PAYMENT_NOT_SECURED');
    }

    await updateDoc(doc(db, 'rentals', rental.id), {
      status: 'ACTIVE_RENTAL',
      actualStartTime: serverTimestamp(),
      activeAt: serverTimestamp(),
      paymentCompletedAt: serverTimestamp(),
      returnDueAt: null
    });

    await updateDoc(doc(db, 'listings', rental.gearId), {
      status: 'IN_USE',
      updatedAt: serverTimestamp(),
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-xl" 
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-[#121212] w-full max-w-[480px] rounded-[32px] overflow-hidden border border-[#222] shadow-[0_0_80px_rgba(0,0,0,0.8)] relative z-10"
      >
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between border-b border-[#222]">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-[#A855F7]/10 flex items-center justify-center">
               <ShieldCheck size={18} className="text-[#A855F7]" />
             </div>
             <h2 className="text-[15px] font-bold text-white tracking-tight">GearUp Guard</h2>
           </div>
           <button onClick={onClose} className="p-2 text-white/50 hover:text-white transition-colors">
              <X size={20} />
           </button>
        </div>

        <div className="p-8 space-y-6">
           <RentalTimelineSummary rental={rental} />

           {/* Step Content */}
           <AnimatePresence mode="wait">
             {step === 'proof_of_life' && (
               <motion.div key="pol" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <div className="text-center space-y-2">
                    <h3 className="text-[20px] font-bold text-white tracking-tight">System Scan</h3>
                    <p className="text-[13px] text-white/50 px-4">Scanning hardware components for integrity and serial verification.</p>
                  </div>

                  <div className="aspect-video bg-[#0A0A0A] rounded-[24px] border border-[#222] overflow-hidden relative flex flex-col items-center justify-center">
                    {recording ? (
                      <div className="w-full px-12 space-y-4">
                        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 2, ease: "linear" }}
                            className="h-full bg-[#A855F7] shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                          />
                        </div>
                        <p className="text-[10px] text-[#A855F7] font-bold uppercase tracking-widest text-center animate-pulse">Analyzing Frames...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-[#A855F7]/10 flex items-center justify-center">
                           <Camera size={32} className="text-[#A855F7]" />
                        </div>
                        <p className="text-white/30 text-[12px] font-medium">Camera Test Active</p>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={startRecording}
                    disabled={recording || loading}
                    className="w-full py-4 bg-[#A855F7] hover:bg-[#B366FF] text-white font-bold rounded-[16px] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <><ShieldCheck size={20} /> {recording ? 'Processing...' : 'Record Proof of Life'}</>}
                  </button>
               </motion.div>
             )}

             {step === 'tracking' && (
               <motion.div key="tracking" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <div className="text-center space-y-2">
                    <h3 className="text-[20px] font-bold text-white tracking-tight">Live Tracking</h3>
                    <p className="text-[13px] text-white/50">Handover coordinates in real-time.</p>
                  </div>

                  <div className="h-[300px] bg-[#0A0A0A] rounded-[24px] border border-[#222] relative overflow-hidden flex flex-col items-center justify-center gap-4 group">
                     {/* Placeholder Map Pattern */}
                     <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#A855F7 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                     
                     <div className="relative flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-[#A855F7]/10 flex items-center justify-center text-[#A855F7] animate-bounce">
                           <MapPin size={32} />
                        </div>
                        <div className="text-center">
                           <p className="text-white font-bold text-[14px]">Route Active</p>
                           <p className="text-white/50 text-[12px]">Est. time: 12 mins</p>
                        </div>
                     </div>

                     <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                           <motion.div initial={{ width: 0 }} animate={{ width: '60%' }} className="h-full bg-[#A855F7]" />
                        </div>
                     </div>
                  </div>
               </motion.div>
             )}

             {step === 'logistics' && (
               <motion.div key="logistics" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <div className="text-center space-y-2">
                    <h3 className="text-[20px] font-bold text-white tracking-tight">Return Logistics</h3>
                    <p className="text-[13px] text-white/50">Determine how the gear returns home.</p>
                  </div>

                  <div className="space-y-3">
                     <button 
                       onClick={() => handleSelectLogistics('drop_off')}
                       className="w-full p-6 bg-[#121212] border border-[#222] hover:border-[#A855F7] rounded-[24px] text-left transition-all group cursor-pointer"
                     >
                        <h4 className="text-white font-bold text-[15px] group-hover:text-[#A855F7]">Borrower Drops Off</h4>
                        <p className="text-[#707070] text-[12px] mt-1 italic">Borrower returns it to your location.</p>
                     </button>
                     <button 
                       onClick={() => handleSelectLogistics('owner_pickup')}
                       className="w-full p-6 bg-[#121212] border border-[#222] hover:border-[#2DD4BF] rounded-[24px] text-left transition-all group cursor-pointer"
                     >
                        <h4 className="text-white font-bold text-[15px] group-hover:text-[#2DD4BF]">Owner Picks Up</h4>
                        <p className="text-[#707070] text-[12px] mt-1 italic">You visit the borrower to collect gear.</p>
                     </button>
                  </div>

                  {loading && <div className="flex justify-center"><Loader2 className="animate-spin text-[#A855F7]" /></div>}
               </motion.div>
             )}

             {step === 'qr_handover' && (
               <motion.div key="qr" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 text-center">
                  <div className="space-y-2">
                    <h3 className="text-[20px] font-bold text-white tracking-tight">Final Handover</h3>
                    <p className="text-[13px] text-white/50">Payment is already secured in GearUp.</p>
                  </div>

                  <div className="bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 p-6 rounded-[32px] w-full mx-auto">
                     <CheckCircle2 size={48} className="text-[#2DD4BF] mx-auto mb-3" />
                     <p className="text-white font-bold text-[15px]">Payment already secured.</p>
                     <p className="text-white/45 text-[12px] mt-1">Complete the physical handover when both sides are ready.</p>
                  </div>

                  <button
                    onClick={async () => {
                      setLoading(true);
                      try {
                        await completeHandover();
                        showToast('Handover confirmed. Rental is now active.', 'success');
                        onClose();
                      } catch (err) {
                        console.error(err);
                        showToast('Payment is not secured yet. Please try again after booking payment is confirmed.', 'error');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="w-full py-4 bg-[#2DD4BF] hover:bg-[#5EEAD4] text-black font-bold rounded-[16px] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
                    Confirm Handover
                  </button>
               </motion.div>
             )}

             {step === 'payment_scan' && (
               <motion.div key="scan" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                  <div className="text-center space-y-2">
                    <h3 className="text-[20px] font-bold text-white tracking-tight">Payment Protected</h3>
                    <p className="text-[13px] text-white/50">GearUp has already secured this payment.</p>
                  </div>

                  <div className="bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 rounded-[24px] p-6 text-center">
                    <CheckCircle2 size={48} className="text-[#2DD4BF] mx-auto mb-3" />
                    <p className="text-white font-bold text-[15px]">Payment already secured.</p>
                    <p className="text-white/45 text-[12px] mt-1">Confirm the physical handover to start the rental.</p>
                    <p className="text-white/40 text-[11px] mt-3">
                      Razorpay key: <span className={razorpayKey ? 'text-[#2DD4BF]' : 'text-red-400'}>{razorpayKey ? 'Loaded' : 'Missing'}</span>
                    </p>
                  </div>

                  <div className="space-y-3">
                    <button 
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await completeHandover();
                          showToast('Handover confirmed. Rental is now active.', 'success');
                          onClose();
                        } catch (err) {
                          console.error(err);
                          showToast('Payment is not secured yet. Please try again after booking payment is confirmed.', 'error');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      className="w-full py-4 bg-[#2DD4BF] hover:bg-[#5EEAD4] text-black font-bold rounded-[16px] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(45,212,191,0.2)] cursor-pointer"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <ShieldCheck size={20} />}
                      Confirm Handover
                    </button>
                  </div>
               </motion.div>
             )}
           </AnimatePresence>
        </div>

        {/* Footer Info */}
        <div className="p-6 bg-[#0A0A0A] border-t border-[#222] flex items-center justify-between">
           <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest">Payment Protected</span>
              <span className="text-[#2DD4BF] text-[13px] font-bold">₹{rental.totalPrice} Secured</span>
           </div>
           <div className="flex items-center gap-1.5 text-white/30 text-[12px] font-medium">
             <AlertCircle size={14} />
             <span>Help Center</span>
           </div>
        </div>
      </motion.div>
    </div>
  );
}
