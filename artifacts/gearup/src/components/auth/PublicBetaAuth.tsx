import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Phone, ShieldCheck } from 'lucide-react';
import { RecaptchaVerifier, signInWithPhoneNumber, signInWithPopup, type ConfirmationResult } from 'firebase/auth';
import { arrayUnion, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';
import { useToast } from '@/context/ToastContext';

const BETA_RECAPTCHA_CONTAINER_ID = 'beta-phone-recaptcha-container';

declare global {
  interface Window {
    betaRecaptchaVerifier?: RecaptchaVerifier;
    betaRecaptchaVerifierContainer?: HTMLElement;
  }
}

const getPhoneAuthErrorMessage = (err: any) => {
  switch (err?.code) {
    case 'auth/invalid-phone-number':
      return 'Enter a valid 10-digit Indian mobile number.';
    case 'auth/quota-exceeded':
      return 'SMS quota exceeded. Please try again later.';
    case 'auth/captcha-check-failed':
    case 'auth/missing-app-credential':
      return 'reCAPTCHA verification failed. Please try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Firebase phone login.';
    case 'auth/too-many-requests':
      return 'Too many OTP attempts. Please wait before trying again.';
    case 'auth/invalid-verification-code':
      return 'Invalid OTP. Please check the code and try again.';
    case 'auth/code-expired':
      return 'OTP expired. Please request a new code.';
    case 'auth/account-exists-with-different-credential':
      return 'This phone number is already linked to another GearUp account. Use the account that originally registered this number, or use a different number.';
    case 'auth/credential-already-in-use':
      return 'This phone number is already linked to another GearUp account. Use the account that originally registered this number, or use a different number.';
    case 'auth/billing-not-enabled':
      return 'OTP verification is temporarily unavailable during beta. Please try Google login.';
    default:
      return 'Phone login failed. Please try again.';
  }
};

const resetVerifier = () => {
  try {
    window.betaRecaptchaVerifier?.clear();
  } catch (err) {
    console.warn('Failed to clear beta auth reCAPTCHA verifier:', err);
  }
  window.betaRecaptchaVerifier = undefined;
  window.betaRecaptchaVerifierContainer = undefined;
};

const isRemovedRecaptchaError = (err: any) =>
  String(err?.message || '').toLowerCase().includes('client element has been removed');

export default function PublicBetaAuth() {
  const { showToast } = useToast();
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [verificationPhone, setVerificationPhone] = useState('');
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const getVerifier = async () => {
    const container = document.getElementById(BETA_RECAPTCHA_CONTAINER_ID);
    if (!container) throw new Error('Phone reCAPTCHA container is not mounted.');

    if (
      window.betaRecaptchaVerifier &&
      window.betaRecaptchaVerifierContainer &&
      document.body.contains(window.betaRecaptchaVerifierContainer)
    ) {
      return window.betaRecaptchaVerifier;
    }

    if (window.betaRecaptchaVerifier) resetVerifier();

    window.betaRecaptchaVerifier = new RecaptchaVerifier(auth, BETA_RECAPTCHA_CONTAINER_ID, {
      size: 'invisible',
    });
    window.betaRecaptchaVerifierContainer = container;
    await window.betaRecaptchaVerifier.render();
    return window.betaRecaptchaVerifier;
  };

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Google beta auth failed:', err);
      showToast('Google sign-in failed. Please try again.', 'error');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleMobileChange = (value: string) => {
    setMobileNumber(value.replace(/\D/g, '').slice(0, 10));
    if (confirmation) {
      setConfirmation(null);
      setVerificationPhone('');
      setOtp('');
    }
  };

  const handleSendOtp = async () => {
    const digits = mobileNumber.replace(/\D/g, '');
    if (digits.length !== 10) {
      showToast('Enter a valid 10-digit Indian mobile number.', 'error');
      return;
    }

    setSendingOtp(true);
    try {
      const e164Phone = `+91${digits}`;
      let verifier = await getVerifier();
      let result: ConfirmationResult;
      try {
        result = await signInWithPhoneNumber(auth, e164Phone, verifier);
      } catch (err: any) {
        if (!isRemovedRecaptchaError(err)) throw err;
        resetVerifier();
        verifier = await getVerifier();
        result = await signInWithPhoneNumber(auth, e164Phone, verifier);
      }
      setConfirmation(result);
      setVerificationPhone(e164Phone);
      showToast('OTP sent successfully.', 'success');
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Phone beta OTP send failed:', {
          code: err?.code,
          message: err?.message,
          error: err,
        });
      }
      showToast(getPhoneAuthErrorMessage(err), 'error');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!confirmation || !verificationPhone || !otp.trim()) {
      showToast('Enter the OTP to continue.', 'error');
      return;
    }

    setVerifyingOtp(true);
    try {
      const credential = await confirmation.confirm(otp.trim());
      await setDoc(doc(db, 'users', credential.user.uid), {
        uid: credential.user.uid,
        phone: verificationPhone,
        phoneVerified: true,
        phoneVerifiedAt: serverTimestamp(),
        authProviders: arrayUnion('phone'),
        primaryAuthProvider: 'phone',
        updatedAt: serverTimestamp(),
      }, { merge: true });
      showToast('Phone login successful.', 'success');
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Phone beta OTP verification failed:', {
          code: err?.code,
          message: err?.message,
          error: err,
        });
      }
      showToast(getPhoneAuthErrorMessage(err), 'error');
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <div className="max-w-[420px] w-full py-10 sm:py-12 px-6 sm:px-9 bg-[#121212] rounded-[32px] border border-white/5 mx-auto shadow-[0_0_80px_rgba(0,0,0,0.35)]">
      <div className="text-center mb-8">
        <h2 className="text-[28px] sm:text-3xl font-black tracking-tighter text-white">Join GearUp Beta</h2>
        <p className="text-[#707070] text-[13px] leading-relaxed mt-3">
          List your gear, explore local tech, and get early access before launch.
        </p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleGoogle}
          disabled={loadingGoogle || sendingOtp || verifyingOtp}
          className="w-full h-12 flex items-center justify-center gap-2 bg-white text-black font-bold rounded-[16px] hover:bg-white/90 active:scale-95 transition-all text-sm cursor-pointer disabled:opacity-60"
        >
          {loadingGoogle ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40.9 36 44 30.5 44 24c0-1.2-.1-2.4-.4-3.5z"/>
            </svg>
          )}
          Continue with Google
        </button>

        <button
          type="button"
          onClick={() => setPhoneOpen((open) => !open)}
          className="w-full h-12 flex items-center justify-center gap-2 bg-[#0A0A0A] text-white font-bold rounded-[16px] border border-white/10 hover:border-[#A855F7]/50 active:scale-95 transition-all text-sm cursor-pointer"
        >
          <Phone size={17} className="text-[#A855F7]" />
          Continue with Mobile Number
        </button>
      </div>

      <AnimatePresence>
        {phoneOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-5 space-y-4 border-t border-white/5 pt-5">
              <div>
                <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">
                  Mobile Number
                </label>
                <div className="flex items-center bg-[#0A0A0A] border border-white/10 rounded-[16px] overflow-hidden focus-within:border-[#A855F7] transition-colors">
                  <span className="px-4 py-3.5 text-[13px] font-bold text-white border-r border-white/10 bg-white/[0.03]">
                    +91
                  </span>
                  <input
                    value={mobileNumber}
                    onChange={(e) => handleMobileChange(e.target.value)}
                    placeholder="9876543210"
                    inputMode="numeric"
                    maxLength={10}
                    className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-white text-[13px] outline-none placeholder:text-white/25"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSendOtp}
                disabled={sendingOtp || verifyingOtp}
                className="w-full py-3.5 bg-[#A855F7] text-white font-bold rounded-[18px] hover:bg-[#9333EA] transition-all text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sendingOtp ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {confirmation ? 'Resend OTP' : 'Send OTP'}
              </button>

              {confirmation && (
                <div>
                  <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">
                    OTP
                  </label>
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter OTP"
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-[16px] px-4 py-3.5 text-white text-[13px] outline-none focus:border-[#2DD4BF] transition-colors placeholder:text-white/25"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={!otp.trim() || verifyingOtp}
                    className="w-full mt-3 px-6 py-3 bg-[#2DD4BF] text-black font-bold rounded-[18px] hover:bg-[#14b8a6] transition-all text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {verifyingOtp && <Loader2 size={16} className="animate-spin" />}
                    Verify OTP
                  </button>
                </div>
              )}
              <div id={BETA_RECAPTCHA_CONTAINER_ID} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
