import React, { useState } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
            placeholder="operator@gearup.hyd"
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
        {error && <p className="text-[#A855F7] text-xs font-bold text-center px-4">{error}</p>}
        {error && <p className="text-[#A855F7] text-[11px] font-medium text-center -mt-2">Forgot password?</p>}
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
