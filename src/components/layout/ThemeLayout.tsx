'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import Header from './Header';
import Sidebar from './Sidebar';
import MarketplaceView from '../views/MarketplaceView';
import DashboardView from '../views/DashboardView';
import WalletView from '../views/WalletView';
import ProfileView from '../views/ProfileView';
import ListGearModal from '../modals/ListGearModal';

export type AppTab = 'marketplace' | 'dashboard' | 'wallet' | 'profile';

export function ThemeLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AppTab>('marketplace');
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  
  React.useEffect(() => {
    const handleOpen = () => setIsListModalOpen(true);
    window.addEventListener('open-list-modal', handleOpen);
    return () => window.removeEventListener('open-list-modal', handleOpen);
  }, []);

  const handleTabChange = useCallback((tab: AppTab) => {
    setIsListModalOpen(false); // Fix for state leak
    setActiveTab(tab);
    if (pathname !== '/') {
      router.push('/');
    }
  }, [pathname, router]);

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#A855F7] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If no user, just render the child (which handles auth view on / or auth pages)
  if (!user) {
    return <div className="min-h-screen bg-[#0A0A0A] text-white">{children}</div>;
  }

  // If user is authenticated, render the GearUp Shell
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col text-white font-sans">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
        <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
          <div className="min-h-full">
            {pathname === '/' ? (
              <div className="relative">
                <div key="marketplace" className={activeTab === 'marketplace' ? 'block' : 'hidden'}>
                  <MarketplaceView />
                </div>
                <div key="dashboard" className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
                  <DashboardView />
                </div>
                <div key="wallet" className={activeTab === 'wallet' ? 'block' : 'hidden'}>
                  <WalletView />
                </div>
                <div key="profile" className={activeTab === 'profile' ? 'block' : 'hidden'}>
                  <ProfileView />
                </div>
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
      <ListGearModal isOpen={isListModalOpen} onClose={() => setIsListModalOpen(false)} />
    </div>
  );
}
