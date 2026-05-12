import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Phone, ShieldCheck, Loader2 } from 'lucide-react';
import { PhoneAuthProvider, RecaptchaVerifier, updatePhoneNumber } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

const RECAPTCHA_CONTAINER_ID = 'phone-recaptcha-container';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

const getInitialIndianMobile = (phone?: string) => {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits.slice(-10);
};

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
      return 'Too many attempts. Please try again later.';
    case 'auth/invalid-verification-code':
      return 'The OTP is incorrect or expired.';
    case 'auth/code-expired':
      return 'The OTP has expired. Please request a new one.';
    case 'auth/requires-recent-login':
      return 'Please sign in again before verifying your phone.';
    case 'auth/credential-already-in-use':
      return 'This phone number is already linked to another account.';
    default:
      return 'Phone verification failed. Please try again.';
  }
};

export default function PhoneVerificationModal({ onClose }: { onClose: () => void }) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [mobileNumber, setMobileNumber] = useState(getInitialIndianMobile(profile?.phone));
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [verificationPhone, setVerificationPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const getVerifier = async () => {
    if (window.recaptchaVerifier) {
      console.log('Reusing existing recaptcha verifier');
      return window.recaptchaVerifier;
    }

    console.log('Creating new recaptcha verifier');
    window.recaptchaVerifier = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, {
      size: 'invisible',
    });
    await window.recaptchaVerifier.render();
    return window.recaptchaVerifier;
  };

  const handleMobileChange = (value: string) => {
    setMobileNumber(value.replace(/\D/g, '').slice(0, 10));
    if (verificationId) {
      setVerificationId('');
      setVerificationPhone('');
      setOtp('');
    }
  };

  const handleSendOtp = async () => {
    const digits = mobileNumber.replace(/\D/g, '');
    if (!digits) {
      showToast('Enter your mobile number first.', 'error');
      return;
    }
    if (digits.length !== 10) {
      showToast('Enter a valid 10-digit Indian mobile number.', 'error');
      return;
    }

    setSending(true);
    try {
      const e164Phone = `+91${digits}`;
      const provider = new PhoneAuthProvider(auth);
      const verifier = await getVerifier();
      const id = await provider.verifyPhoneNumber(e164Phone, verifier);
      setVerificationId(id);
      setVerificationPhone(e164Phone);
      showToast('OTP sent successfully.', 'success');
    } catch (err: any) {
      console.error('Phone OTP send failed:', {
        code: err?.code,
        message: err?.message,
        error: err,
      });
      showToast(getPhoneAuthErrorMessage(err), 'error');
      setVerificationPhone('');
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!user || !verificationId || !verificationPhone || !otp.trim()) {
      showToast('Enter the OTP to continue.', 'error');
      return;
    }

    setVerifying(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otp.trim());
      await updatePhoneNumber(user, credential);
      await setDoc(doc(db, 'users', user.uid), {
        phone: verificationPhone,
        phoneVerified: true,
        phoneVerifiedAt: serverTimestamp(),
      }, { merge: true });
      showToast('Phone verified successfully.', 'success');
      onClose();
    } catch (err: any) {
      console.error('Phone OTP verification failed:', {
        code: err?.code,
        message: err?.message,
        error: err,
      });
      showToast(getPhoneAuthErrorMessage(err), 'error');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative z-10 w-full max-w-[440px] bg-[#121212] border border-white/10 rounded-[32px] shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        <div className="px-6 py-5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#A855F7]/10 flex items-center justify-center">
              <Phone size={18} className="text-[#A855F7]" />
            </div>
            <h2 className="text-[16px] font-bold text-white tracking-tight">Verify Phone</h2>
          </div>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-2">
              Phone Number
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
            <p className="mt-2 text-[11px] leading-relaxed text-white/40">
              Enter your 10-digit mobile number. India +91 is added automatically.
            </p>
          </div>

          <button
            onClick={handleSendOtp}
            disabled={sending || verifying}
            className="w-full py-3.5 bg-[#A855F7] text-white font-bold rounded-[18px] hover:bg-[#9333EA] transition-all text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {verificationId ? 'Resend OTP' : 'Send OTP'}
          </button>

          {verificationId && (
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
            </div>
          )}

          <div id={RECAPTCHA_CONTAINER_ID} />
        </div>

        <div className="px-6 py-5 border-t border-white/5 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 text-white/50 hover:text-white font-bold text-[13px] transition-all">
            Cancel
          </button>
          <button
            onClick={handleVerifyOtp}
            disabled={!verificationId || !otp.trim() || verifying}
            className="px-6 py-3 bg-[#2DD4BF] text-black font-bold rounded-[24px] hover:bg-[#14b8a6] transition-all text-[13px] flex items-center gap-2 disabled:opacity-50"
          >
            {verifying && <Loader2 size={16} className="animate-spin" />}
            Verify OTP
          </button>
        </div>
      </motion.div>
    </div>
  );
}
