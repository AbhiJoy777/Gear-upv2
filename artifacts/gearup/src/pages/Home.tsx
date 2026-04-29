import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import LoginForm from '@/components/auth/LoginForm';
import SignupForm from '@/components/auth/SignupForm';
import Logo from '@/components/common/Logo';

export default function Home() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  if (loading) return null;

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0A0A0A] relative overflow-hidden">
        <div className="mb-12 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-1000">
          <Logo size={56} className="shadow-2xl" />
          <h1 className="text-3xl font-black tracking-tighter uppercase text-white">GearUp</h1>
        </div>

        <div className="w-full max-w-[400px] space-y-8">
          {authMode === 'login' ? <LoginForm /> : <SignupForm />}

          <div className="flex justify-center flex-col items-center gap-4">
             <button
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                className="text-white/20 hover:text-mint-muted transition-colors text-[10px] font-black uppercase tracking-[0.2em] py-2"
              >
                {authMode === 'login' ? "Need Credentials?" : "Existing Operator?"}
                <br/>
                <span className="text-[#A855F7]">{authMode === 'login' ? "Create Account" : "Log In"}</span>
              </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
