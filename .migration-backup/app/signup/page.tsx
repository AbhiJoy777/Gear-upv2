'use client';

import React from 'react';
import SignupForm from '@/src/components/auth/SignupForm';
import Logo from '@/src/components/common/Logo';
import Link from 'next/link';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0A0A0A] relative overflow-hidden">
      <div className="mb-12 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-1000">
        <Link href="/" className="flex items-center gap-4">
          <Logo size={56} className="shadow-2xl" />
          <h1 className="text-3xl font-black tracking-tighter uppercase text-white">GearUp</h1>
        </Link>
      </div>
      
      <div className="w-full max-w-[400px] space-y-8">
        <SignupForm />
        
        <div className="flex justify-center">
           <Link 
              href="/"
              className="text-white/20 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.2em] py-2"
            >
              Existing Operator? <span className="text-[#A855F7]">Log In</span>
            </Link>
        </div>
      </div>
    </div>
  );
}
