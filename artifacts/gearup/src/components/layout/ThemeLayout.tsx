import React, { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'wouter';
import Header from './Header';
import Sidebar from './Sidebar';
import MarketplaceView from '../views/MarketplaceView';
import DashboardView from '../views/DashboardView';
import SellView from '../views/SellView';
import WalletView from '../views/WalletView';
import ProfileView from '../views/ProfileView';
import AdminView from '../views/AdminView';
import ListGearModal from '../modals/ListGearModal';
import ProfileCompletionModal from '../modals/ProfileCompletionModal';
import AddressModal from '../modals/AddressModal';
import BetaWelcomeModal from '../modals/BetaWelcomeModal';
import { BETA_LAUNCH_MODE, BETA_MESSAGE, canListDuringBeta, getBetaListingGateMessage } from '@/lib/beta';
import { useToast } from '@/context/ToastContext';

export type AppTab = 'marketplace' | 'dashboard' | 'sell' | 'wallet' | 'profile' | 'admin';

export function ThemeLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const { showToast } = useToast();
  const [pathname, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<AppTab>('marketplace');
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [profileModalDismissed, setProfileModalDismissed] = useState(false);
  const [addressModalDismissed, setAddressModalDismissed] = useState(false);
  const [selectedCity, setSelectedCity] = useState('Hyderabad');
  const isAdmin = profile?.role === 'admin';

  React.useEffect(() => {
    if (profile?.city) setSelectedCity(profile.city);
  }, [profile?.city]);


  React.useEffect(() => {
    const handleOpen = () => {
      if (!canListDuringBeta(profile)) {
        showToast(getBetaListingGateMessage(profile), 'warning');
        return;
      }
      setEditItem(null);
      setIsListModalOpen(true);
    };
    const handleEdit = (e: any) => { setEditItem(e.detail.item); setIsListModalOpen(true); };
    window.addEventListener('open-list-modal', handleOpen);
    window.addEventListener('open-edit-modal', handleEdit);
    return () => {
      window.removeEventListener('open-list-modal', handleOpen);
      window.removeEventListener('open-edit-modal', handleEdit);
    };
  }, [profile, showToast]);

  const handleTabChange = useCallback((tab: AppTab) => {
    setIsListModalOpen(false);
    setActiveTab(tab);
    if (pathname !== '/') {
      setLocation('/');
    }
  }, [pathname, setLocation]);

  // Show profile completion when user is logged in, profile is loaded, and fields are missing
  const profileHasName = Boolean(profile?.username || profile?.fullName);
  const profileHasPhone = Boolean(profile?.phone || profile?.phoneVerified);
  const profileHasCity = Boolean(profile?.city);
  const profileIncomplete =
    !loading &&
    user !== null &&
    profile !== null &&
    (!profileHasName || !profileHasPhone || !profileHasCity);

  const showBetaWelcome = BETA_LAUNCH_MODE && !loading && user !== null && profile !== null && profile?.betaIntroCompleted !== true;
  const showProfileCompletion = profileIncomplete && !profileModalDismissed && !showBetaWelcome;
  const showAddressPrompt =
    !loading &&
    user !== null &&
    profile !== null &&
    !profileIncomplete &&
    !showBetaWelcome &&
    (!profile?.addresses || profile.addresses.length === 0) &&
    !addressModalDismissed;

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#A855F7] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <div className="min-h-screen bg-[#0A0A0A] text-white">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col text-white font-sans">
      <Header selectedCity={selectedCity} onCityChange={setSelectedCity} />
      {BETA_LAUNCH_MODE && (
        <div className="px-4 sm:px-6 py-3 bg-[#A855F7]/10 border-b border-[#A855F7]/20 text-center">
          <p className="text-[12px] sm:text-[13px] text-white/80 font-medium leading-relaxed">
            <span className="text-[#2DD4BF] font-bold">GearUp Beta is live.</span>{' '}
            {BETA_MESSAGE.replace('GearUp Beta is live. ', '')}
          </p>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} isAdmin={isAdmin} />
        <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
          <div className="min-h-full">
            {pathname === '/' ? (
              <div className="relative">
                <div key="marketplace" className={activeTab === 'marketplace' ? 'block' : 'hidden'}>
                  <MarketplaceView selectedCity={selectedCity} />

                </div>
                <div key="dashboard" className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
                  <DashboardView />
                </div>
                <div key="sell" className={activeTab === 'sell' ? 'block' : 'hidden'}>
                  <SellView />
                </div>
                <div key="wallet" className={activeTab === 'wallet' ? 'block' : 'hidden'}>
                  <WalletView />
                </div>
                <div key="profile" className={activeTab === 'profile' ? 'block' : 'hidden'}>
                  <ProfileView onOpenWallet={() => handleTabChange('wallet')} />
                </div>
                {isAdmin && (
                  <div key="admin" className={activeTab === 'admin' ? 'block' : 'hidden'}>
                    <AdminView />
                  </div>
                )}
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
      <ListGearModal
        isOpen={isListModalOpen}
        onClose={() => { setIsListModalOpen(false); setEditItem(null); }}
        editItem={editItem}
        selectedCity={selectedCity}
      />

      {showProfileCompletion && (
        <ProfileCompletionModal onSkip={() => setProfileModalDismissed(true)} />
      )}
      {showBetaWelcome && (
        <BetaWelcomeModal />
      )}
      <AddressModal
        open={showAddressPrompt}
        onClose={() => setAddressModalDismissed(true)}
      />
    </div>
  );
}
