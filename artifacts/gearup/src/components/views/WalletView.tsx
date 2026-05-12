import React, { memo, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'motion/react';
import { Wallet, History, TrendingUp, ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const WalletView = memo(() => {
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  useEffect(() => {
    if (!user) return;

    const transactionsQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(transactionsQuery, (snapshot) => {
      const rows = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => {
          const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return bTime - aTime;
        });
      setTransactions(rows);
      setLoadingTransactions(false);
    }, (error) => {
      console.error('Transaction history error:', error);
      setLoadingTransactions(false);
    });

    return () => unsubscribe();
  }, [user]);

  const currency = (amount: number) => `Rs ${Number(amount || 0).toFixed(2)}`;

  const formatDate = (value: any) => {
    const date = value?.toDate ? value.toDate() : null;
    if (!date) return 'Pending timestamp';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const totals = useMemo(() => ({
    credits: transactions
      .filter((item) => item.direction === 'credit' && item.status === 'completed')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    debits: transactions
      .filter((item) => item.direction === 'debit' && item.status === 'completed')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
  }), [transactions]);

  const statusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle2 size={14} className="text-[#2DD4BF]" />;
    if (status === 'failed') return <XCircle size={14} className="text-[#F87171]" />;
    return <Clock3 size={14} className="text-[#FACC15]" />;
  };

  const typeLabel = (type: string) => (type || 'transaction')
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return (
    <div className="p-4 sm:p-6 md:p-12 max-w-5xl mx-auto space-y-8 md:space-y-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#121212] p-6 sm:p-10 rounded-[24px] border-[0.5px] border-white/[0.04] relative overflow-hidden"
      >
        <div className="relative z-10">
          <p className="text-[11px] text-[#707070] font-medium tracking-wide mb-2 ml-1">Available Liquidity</p>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-8 break-words">{currency(profile?.walletBalance)}</h2>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button className="cursor-pointer w-full sm:w-auto px-6 py-3 bg-[#A855F7] text-white font-semibold rounded-[24px] hover:bg-[#9333EA] hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] active:bg-[#7e22ce] active:scale-95 transition-all text-[13px] tracking-wide">
              Add Funds
            </button>
            <button className="cursor-pointer w-full sm:w-auto px-6 py-3 bg-white/[0.02] border-[0.5px] border-white/[0.04] text-[#707070] font-medium rounded-[24px] hover:bg-white/5 hover:text-white transition-all text-[13px] tracking-wide active:scale-95">
              Withdraw
            </button>
          </div>
        </div>

        <Wallet className="absolute -right-16 -bottom-16 w-48 h-48 sm:w-64 sm:h-64 text-white/5 rotate-12" />
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="space-y-6">
          <h3 className="text-[18px] font-black uppercase tracking-widest text-white/70 flex items-center gap-3">
            <History size={18} />
            History
          </h3>
          <div className="bg-[#121212] border-[0.5px] border-white/10 rounded-[24px] overflow-hidden">
            {loadingTransactions ? (
              <div className="h-48 flex items-center justify-center text-[13px] text-[#707070] font-bold">
                Loading transactions...
              </div>
            ) : transactions.length === 0 ? (
              <div className="h-48 border-[0.5px] border-dashed border-white/15 rounded-[24px] flex items-center justify-center text-[13px] italic text-[#707070] font-bold">
                No wallet transactions recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {transactions.map((item) => {
                  const isCredit = item.direction === 'credit';
                  return (
                    <div key={item.id} className="p-4 flex items-start sm:items-center gap-3 sm:gap-4 hover:bg-white/[0.02] transition-colors">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isCredit ? 'bg-[#2DD4BF]/10 text-[#2DD4BF]' : 'bg-[#A855F7]/10 text-[#A855F7]'}`}>
                        {isCredit ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-white font-bold text-[13px] truncate">{typeLabel(item.type)}</p>
                          <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-white/35">
                            {statusIcon(item.status)}
                            {item.status || 'pending'}
                          </span>
                        </div>
                        <p className="text-[#707070] text-[12px] truncate">{item.description || 'Wallet transaction'}</p>
                        <p className="text-white/30 text-[11px] mt-1">{formatDate(item.createdAt)}</p>
                      </div>
                      <div className={`text-right font-black text-[13px] shrink-0 ${isCredit ? 'text-[#2DD4BF]' : 'text-white'}`}>
                        {isCredit ? '+' : '-'}{currency(item.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="text-[18px] font-black uppercase tracking-widest text-white/70 flex items-center gap-3">
            <TrendingUp size={18} />
            Insights
          </h3>
          <div className="cursor-pointer h-48 bg-[#121212] rounded-[24px] border-[0.5px] border-white/15 p-8 flex flex-col justify-center hover:border-white hover:shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-all group">
             <p className="text-[#707070] font-medium text-[13px] group-hover:text-white transition-colors duration-300">Completed credits: {currency(totals.credits)}. Completed debits: {currency(totals.debits)}.</p>
          </div>
        </section>
      </div>
    </div>
  );
});

WalletView.displayName = 'WalletView';

export default WalletView;
