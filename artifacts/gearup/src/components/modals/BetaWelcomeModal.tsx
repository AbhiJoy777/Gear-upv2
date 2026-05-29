import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Loader2, Rocket } from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { DEFAULT_LAUNCH_INTEREST } from '@/lib/beta';

type LaunchInterest = typeof DEFAULT_LAUNCH_INTEREST;

export default function BetaWelcomeModal() {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [interest, setInterest] = useState<LaunchInterest>({
    ...DEFAULT_LAUNCH_INTEREST,
    ...(profile?.launchInterest || {}),
  });

  const joinBeta = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        betaJoined: true,
        betaJoinedAt: profile?.betaJoinedAt || serverTimestamp(),
        launchInterest: interest,
        betaIntroCompleted: true,
        updatedAt: serverTimestamp(),
      });
      showToast("You're on the GearUp Beta list. Explore the marketplace and list your gear while full rentals launch soon.", 'success');
    } catch (err) {
      console.error(err);
      showToast('Could not join beta. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/85 backdrop-blur-xl"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 18 }}
          transition={{ type: 'spring', stiffness: 460, damping: 36 }}
          className="relative z-10 w-full max-w-[460px] bg-[#121212] border border-white/10 rounded-[32px] overflow-hidden shadow-[0_32px_90px_rgba(0,0,0,0.85)]"
        >
          <div className="p-6 sm:p-8">
            <div className="w-14 h-14 rounded-[20px] bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center mb-6">
              <Rocket size={26} className="text-[#A855F7]" />
            </div>

            {step === 1 ? (
              <div className="space-y-5">
                <div>
                  <p className="text-[#2DD4BF] text-[11px] font-black uppercase tracking-[0.2em] mb-2">Early Access</p>
                  <h2 className="text-white text-[25px] sm:text-[30px] font-black tracking-tight">Welcome to GearUp Beta</h2>
                </div>
                <p className="text-white/55 text-[14px] leading-relaxed">
                  GearUp is opening early access for tech rentals, selling, and local gear discovery.
                  You can create your profile, explore demo listings, and list your gear while rentals
                  and payments are being prepared.
                </p>
                <button
                  onClick={() => setStep(2)}
                  className="w-full bg-[#A855F7] text-white font-bold rounded-[18px] hover:bg-[#9333EA] transition-all text-[13px] py-3.5"
                >
                  Next
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-[#2DD4BF] text-[11px] font-black uppercase tracking-[0.2em] mb-2">Beta Access</p>
                  <h2 className="text-white text-[23px] sm:text-[28px] font-black tracking-tight">What are you here to try?</h2>
                </div>

                <div className="space-y-3">
                  {[
                    { key: 'wantsToRent', label: 'Rent gear' },
                    { key: 'wantsToList', label: 'List rental gear' },
                    { key: 'wantsToSell', label: 'Sell tech gear' },
                  ].map((item) => {
                    const checked = interest[item.key as keyof typeof interest];
                    return (
                      <button
                        key={item.key}
                        onClick={() => setInterest((current: LaunchInterest) => ({ ...current, [item.key]: !checked }))}
                        className={`w-full p-4 rounded-[20px] border flex items-center justify-between text-left transition-all ${
                          checked
                            ? 'bg-[#A855F7]/10 border-[#A855F7]/40 text-white'
                            : 'bg-[#0A0A0A] border-white/10 text-white/60 hover:text-white'
                        }`}
                      >
                        <span className="text-[14px] font-bold">{item.label}</span>
                        <span className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                          checked ? 'bg-[#2DD4BF] border-[#2DD4BF] text-black' : 'border-white/15 text-transparent'
                        }`}>
                          <Check size={14} />
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-3.5 rounded-[18px] bg-white/5 text-white/55 hover:text-white font-bold text-[13px] transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={joinBeta}
                    disabled={saving}
                    className="flex-1 py-3.5 rounded-[18px] bg-[#2DD4BF] text-black hover:bg-[#5EEAD4] font-black text-[13px] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                    {saving ? 'Joining...' : 'Join Beta'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
