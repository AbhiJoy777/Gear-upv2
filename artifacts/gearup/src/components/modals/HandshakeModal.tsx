

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, MapPin, ShieldCheck, Map as MapIcon, Loader2, Navigation, CheckCircle2, AlertCircle, CreditCard } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { recordRazorpayPaymentTransactions } from '@/lib/transactions';
import { useToast } from '@/context/ToastContext';
import { RentalTimelineSummary } from '@/components/common/RentalTimeline';

type RazorpayInstance = {
  open: () => void;
  on: (event: 'payment.failed', callback: (response: any) => void) => void;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  handler: (response: { razorpay_payment_id: string }) => void | Promise<void>;
  prefill?: { email?: string };
  notes?: Record<string, string>;
  theme?: { color: string };
  modal?: { ondismiss?: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface HandshakeModalProps {
  rental: any;
  onClose: () => void;
  userRole: 'owner' | 'renter';
  initialStep?: HandshakeStep;
}

type HandshakeStep = 'proof_of_life' | 'tracking' | 'logistics' | 'qr_handover' | 'payment_scan';

export default function HandshakeModal({ rental, onClose, userRole, initialStep }: HandshakeModalProps) {
  const { showToast } = useToast();
  const paymentCompletedRef = useRef(false);
  const [step, setStep] = useState<HandshakeStep>(initialStep || 'tracking');
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [loading, setLoading] = useState(false);
  const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
  const pricePerDay = Number(rental.pricePerDay || (rental.totalPrice && rental.durationDays ? rental.totalPrice / rental.durationDays : 0));
  const rentalDays = Number(rental.durationDays || 1);
  const rentalTotal = Math.round(pricePerDay * rentalDays) || Number(rental.totalPrice || 0);
  const platformFee = Math.round(rentalTotal * 0.05);
  const ownerAmount = Math.max(0, rentalTotal - platformFee);
  
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
        proofOfLifeUrl: 'https://example.com/simulated-video.mp4'
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
        status: 'PAYMENT_PENDING',
        returnLogistics: type
      });
      setStep(userRole === 'owner' ? 'qr_handover' : 'payment_scan');
    } catch (err) {
      console.error(err);
      showToast('Could not update return logistics. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRazorpayScript = () => new Promise<boolean>((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true), { once: true });
      existingScript.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const markPaymentFailed = async (reason: string) => {
    try {
      await updateDoc(doc(db, 'rentals', rental.id), {
        paymentStatus: 'failed',
        payment: {
          provider: 'razorpay',
          paymentId: null,
          amount: rentalTotal,
          platformFee,
          ownerAmount,
          status: 'failed',
          failedAt: serverTimestamp(),
          failureReason: reason,
        },
      });
    } catch (err) {
      console.error('Could not save payment failure state:', err);
    }
  };

  const completePaidHandover = async (paymentId: string) => {
    await updateDoc(doc(db, 'rentals', rental.id), {
      status: 'ACTIVE_RENTAL',
      actualStartTime: serverTimestamp(),
      returnDueAt: null,
      paymentId,
      paymentStatus: 'paid',
      paidAt: serverTimestamp(),
      platformFee,
      ownerAmount,
      totalPrice: rentalTotal,
      payment: {
        provider: 'razorpay',
        paymentId,
        amount: rentalTotal,
        platformFee,
        ownerAmount,
        status: 'paid',
        paidAt: serverTimestamp(),
      },
    });

    await updateDoc(doc(db, 'listings', rental.gearId), {
      status: 'IN_USE'
    });

    await recordRazorpayPaymentTransactions(rental, {
      amount: rentalTotal,
      platformFee,
      ownerAmount,
      paymentId,
    });
  };

  const handleRazorpayPayment = async () => {
    if (!razorpayKey) {
      showToast('Payment gateway not configured.', 'error');
      return;
    }

    setLoading(true);
    const loaded = await loadRazorpayScript();
    if (!loaded || !window.Razorpay) {
      setLoading(false);
      showToast('Could not load payment gateway. Please try again.', 'error');
      return;
    }

    const options: RazorpayOptions = {
      key: razorpayKey,
      amount: rentalTotal * 100,
      currency: 'INR',
      name: 'GearUp',
      description: `${rental.gearTitle || 'Gear rental'} (${rentalDays} day${rentalDays === 1 ? '' : 's'})`,
      prefill: { email: rental.renterEmail },
      notes: {
        rentalId: rental.id,
        listingId: rental.gearId,
        ownerId: rental.ownerId,
      },
      theme: { color: '#A855F7' },
      handler: async (response) => {
        try {
          paymentCompletedRef.current = true;
          await completePaidHandover(response.razorpay_payment_id);
          showToast('Payment successful. Rental is now active.', 'success');
          onClose();
        } catch (err: any) {
          console.error('Razorpay payment save failed:', {
            code: err?.code,
            message: err?.message,
            error: err,
          });
          showToast('Payment succeeded, but we could not update the rental. Please contact support.', 'error');
        } finally {
          setLoading(false);
        }
      },
      modal: {
        ondismiss: async () => {
          if (paymentCompletedRef.current) return;
          await markPaymentFailed('checkout_dismissed');
          setLoading(false);
          showToast('Payment was cancelled. Rental is still pending.', 'error');
        },
      },
    };

    const checkout = new window.Razorpay(options);
    checkout.on('payment.failed', async (response: any) => {
      console.error('Razorpay payment failed:', response);
      await markPaymentFailed(response?.error?.description || 'payment_failed');
      setLoading(false);
      showToast('Payment failed. Please try again.', 'error');
    });
    checkout.open();
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
                    <p className="text-[13px] text-white/50">Ask the borrower to complete the protected payment from their rental card.</p>
                  </div>

                  <div className="bg-[#0A0A0A] p-8 rounded-[32px] w-fit mx-auto border border-[#222] shadow-[0_0_40px_rgba(168,85,247,0.15)]">
                     <CreditCard size={72} className="text-[#A855F7]" />
                  </div>

                  <div className="flex items-center justify-center gap-3 text-[#2DD4BF] animate-pulse">
                    <CheckCircle2 size={18} />
                    <span className="text-[14px] font-bold uppercase tracking-widest">Awaiting Payment</span>
                  </div>
               </motion.div>
             )}

             {step === 'payment_scan' && (
               <motion.div key="scan" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                  <div className="text-center space-y-2">
                    <h3 className="text-[20px] font-bold text-white tracking-tight">Payment Protected</h3>
                    <p className="text-[13px] text-white/50">Pay with Razorpay test mode to activate the rental.</p>
                  </div>

                  <div className="bg-[#0A0A0A] rounded-[24px] border border-[#222] p-5 space-y-4">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-white/55">Rental total</span>
                      <span className="text-white font-bold">₹{rentalTotal}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-white/55">Platform fee</span>
                      <span className="text-[#A855F7] font-bold">₹{platformFee}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-white/55">Owner payout pending</span>
                      <span className="text-[#2DD4BF] font-bold">₹{ownerAmount}</span>
                    </div>
                    <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-widest text-white/35 font-bold">Payable now</span>
                      <span className="text-[28px] text-white font-black tracking-tight">₹{rentalTotal}</span>
                    </div>
                    <p className="text-[11px] text-white/35 leading-relaxed">
                      {razorpayKey ? 'Razorpay checkout opens in test mode when test keys are configured.' : 'Payment gateway not configured.'}
                    </p>
                  </div>

                  <button
                      onClick={handleRazorpayPayment}
                      disabled={loading || !razorpayKey}
                      className="w-full py-4 bg-[#2DD4BF] hover:bg-[#5EEAD4] text-black font-bold rounded-[16px] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(45,212,191,0.2)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? <Loader2 size={20} className="animate-spin" /> : <CreditCard size={20} />}
                      {razorpayKey ? 'Pay Securely' : 'Payment Gateway Not Configured'}
                    </button>
               </motion.div>
             )}
           </AnimatePresence>
        </div>

        {/* Footer Info */}
        <div className="p-6 bg-[#0A0A0A] border-t border-[#222] flex items-center justify-between">
           <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest">Payment Protected</span>
              <span className="text-[#2DD4BF] text-[13px] font-bold">₹{rentalTotal} Rental Total</span>
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
