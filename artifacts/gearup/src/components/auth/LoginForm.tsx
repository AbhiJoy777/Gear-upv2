import React, { useState } from 'react';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError('Wrong email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setInfo('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError('Google sign-in failed. Please try again.');
    }
  };

  const handleForgot = async () => {
    setInfo('');
    if (!email) {
      setError('Enter your email first, then tap Forgot password?');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setError('');
      setInfo('Password reset email sent. Check your inbox.');
    } catch (err: any) {
      setError('Could not send reset email. Check the address and try again.');
    }
  };

  return (
    <div className="max-w-[400px] w-full py-16 px-10 bg-[#121212] rounded-3xl border border-white/5 mx-auto">
      <h2 className="text-3xl font-black mb-10 text-center uppercase tracking-tighter text-white">Login</h2>

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

        {/* Error Message */}
        {error && (
          <p className="text-[#A855F7] text-xs font-bold text-center px-4">
            {error}
          </p>
        )}

        {/* Forgot Password ONLY for wrong credentials */}
        {error === 'Wrong email or password.' && (
          <button
            type="button"
            onClick={handleForgot}
            className="text-[#A855F7] text-[11px] font-medium text-center -mt-2 bg-transparent border-none cursor-pointer hover:underline"
          >
            Forgot password?
          </button>
        )}

        {/* Info Message */}
        {info && (
          <p className="text-mint-muted text-xs font-medium text-center px-4">
            {info}
          </p>
        )}

        {/* Login Button */}
        <button 
          type="submit" 
          disabled={loading}
          className="w-full h-12 flex items-center justify-center bg-[#A855F7] text-white font-semibold rounded-xl hover:bg-[#9333EA] active:scale-95 transition-all text-sm mt-6 border-none cursor-pointer"
        >
          {loading ? 'Authenticating...' : 'Login'}
        </button>

        {/* Google Login */}
        <button
          type="button"
          onClick={handleGoogle}
          className="w-full h-12 flex items-center justify-center gap-2 bg-transparent text-white font-semibold rounded-xl border border-white/10 hover:border-white/30 active:scale-95 transition-all text-sm cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40.9 36 44 30.5 44 24c0-1.2-.1-2.4-.4-3.5z"/>
          </svg>
          Continue with Google
        </button>
      </form>
    </div>
  );
}