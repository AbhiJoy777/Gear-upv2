'use client';

import React, { memo, useEffect, useState } from 'react';
import { Search, Bell, SlidersHorizontal, Plus } from 'lucide-react';
import Logo from '@/src/components/common/Logo';
import { useAuth } from '@/src/context/AuthContext';
import { db } from '@/src/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const Header = memo(() => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const notesRef = collection(db, 'notifications');
    const q = query(notesRef, where('userId', '==', user.uid), where('read', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <header className="h-16 md:h-20 bg-[#080808] border-b-[1px] border-white/5 sticky top-0 z-50 px-4 md:px-8 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 shrink-0">
        <Logo size={40} className="shadow-none" />
        <h1 className="text-[18px] font-black tracking-tighter uppercase hidden sm:block text-white">GearUp</h1>
      </div>

      <div className="flex-1 max-w-2xl hidden md:flex items-center gap-4">
        <div className="relative group flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#707070] group-focus-within:text-white transition-all" />
          <input 
            type="text" 
            placeholder="Search Hyderabad Hardware..." 
            className="w-full h-[36px] bg-[#080808] border-[0.5px] border-white/[0.04] rounded-[24px] px-10 text-[13px] focus:outline-none focus:border-white/20 transition-all text-white placeholder:text-[#707070] font-medium"
          />
        </div>
        <button className="cursor-pointer w-[36px] h-[36px] flex shrink-0 items-center justify-center border-[0.5px] border-white/[0.04] rounded-[10px] hover:bg-white/5 transition-all text-[#707070] hover:text-white active:scale-95">
          <SlidersHorizontal size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('open-list-modal'))}
          className="cursor-pointer w-[32px] h-[32px] flex items-center justify-center text-white border-[0.5px] border-white/20 rounded-full hover:bg-white/5 hover:border-white/50 hover:shadow-[0_0_10px_rgba(255,255,255,0.15)] transition-all active:scale-95"
        >
          <Plus size={18} />
        </button>
        <button className="cursor-pointer p-2 text-[#707070] hover:text-white transition-colors relative active:scale-95">
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-[#A855F7] rounded-full shadow-[0_0_8px_#A855F7]"></span>
          )}
        </button>
      </div>
    </header>
  );
});

Header.displayName = 'Header';

export default Header;
