

import React, { memo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'motion/react';
import { Wallet, History, TrendingUp } from 'lucide-react';

const WalletView = memo(() => {
  const { profile } = useAuth();

  return (
    <div className="p-6 md:p-12 max-w-5xl mx-auto space-y-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#121212] p-10 rounded-[24px] border-[0.5px] border-white/[0.04] relative overflow-hidden"
      >
        <div className="relative z-10">
          <p className="text-[11px] text-[#707070] font-medium tracking-wide mb-2 ml-1">Available Liquidity</p>
          <h2 className="text-5xl font-bold tracking-tight text-white mb-8">₹{profile?.walletBalance?.toFixed(2) || '0.00'}</h2>
          
          <div className="flex gap-4">
            <button className="cursor-pointer px-6 py-3 bg-[#A855F7] text-white font-semibold rounded-[24px] hover:bg-[#9333EA] hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] active:bg-[#7e22ce] active:scale-95 transition-all text-[13px] tracking-wide">
              Add Funds
            </button>
            <button className="cursor-pointer px-6 py-3 bg-white/[0.02] border-[0.5px] border-white/[0.04] text-[#707070] font-medium rounded-[24px] hover:bg-white/5 hover:text-white transition-all text-[13px] tracking-wide active:scale-95">
              Withdraw
            </button>
          </div>
        </div>
        
        <Wallet className="absolute -right-12 -bottom-12 w-64 h-64 text-white/5 rotate-12" />
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="space-y-6">
          <h3 className="text-[18px] font-black uppercase tracking-widest text-white/70 flex items-center gap-3">
            <History size={18} />
            History
          </h3>
          <div className="cursor-pointer h-48 border-[0.5px] border-dashed border-white/15 rounded-[24px] flex items-center justify-center text-[13px] italic text-[#707070] font-bold hover:border-white hover:shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-all group">
            <span className="group-hover:text-white transition-colors duration-300">No partial transactions recorded.</span>
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="text-[18px] font-black uppercase tracking-widest text-white/70 flex items-center gap-3">
            <TrendingUp size={18} />
            Insights
          </h3>
          <div className="cursor-pointer h-48 bg-[#121212] rounded-[24px] border-[0.5px] border-white/15 p-8 flex flex-col justify-center hover:border-white hover:shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-all group">
             <p className="text-[#707070] font-medium text-[13px] group-hover:text-white transition-colors duration-300">Your rental velocity is currently being calculated based on Hyderabad market trends.</p>
          </div>
        </section>
      </div>
    </div>
  );
});

WalletView.displayName = 'WalletView';

export default WalletView;
