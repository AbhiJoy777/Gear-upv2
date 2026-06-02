import React, { useState } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useToast } from '@/context/ToastContext';

export default function LoginForm({ title = 'Admin Login' }: { title?: string }) {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginFailed(false);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error('Email/password login failed:', {
        code: err?.code,
        message: err?.message,
        projectId: auth.app.options.projectId,
        authAppName: auth.app.name,
      });
      setLoginFailed(true);
      showToast('Wrong email or password.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!email) {
      showToast('Enter your email address first.', 'warning');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showToast('Password reset email sent. Check your inbox.', 'success');
    } catch (err: any) {
      showToast('Could not send reset email. Check the address and try again.', 'error');
    }
  };

  return (
    <div className="max-w-[400px] w-full py-16 px-10 bg-[#121212] rounded-3xl border border-white/5 mx-auto">
      <h2 className="text-3xl font-black mb-3 text-center uppercase tracking-tighter text-white">{title}</h2>
      <p className="text-center text-[#707070] text-[12px] mb-10">For admin and dev accounts only.</p>
      <form onSubmit={handleLogin} className="space-y-6 flex flex-col">
        <div className="w-full">
          <label className="block text-xs font-medium text-white mb-2">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-12 bg-transparent border border-white/5 rounded-xl px-4 text-white placeholder:text-[#707070] focus:border-[#A855F7] outline-none transition-all"
            placeholder=""
            required
          />
        </div>
        <div className="w-full">
          <label className="block text-xs font-medium text-white mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 bg-transparent border border-white/5 rounded-xl px-4 text-white placeholder:text-[#707070] focus:border-[#A855F7] outline-none transition-all"
            placeholder="••••••••"
            required
          />
        </div>
        {loginFailed && (
          <button
            type="button"
            onClick={handleForgot}
            className="text-[#A855F7] text-[11px] font-medium text-center -mt-2 bg-transparent border-none cursor-pointer hover:underline"
          >
            Forgot password?
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 flex items-center justify-center bg-[#A855F7] text-white font-semibold rounded-xl hover:bg-[#9333EA] active:scale-95 transition-all text-sm mt-6 border-none cursor-pointer"
        >
          {loading ? 'Authenticating...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
