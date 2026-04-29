

import React, { memo } from 'react';
import { Package, Wallet, User as UserIcon, ShoppingBag, Plus } from 'lucide-react';
import { AppTab } from './ThemeLayout';

const NavLinks: { name: string; icon: any; id: AppTab }[] = [
  { name: 'Marketplace', icon: ShoppingBag, id: 'marketplace' },
  { name: 'My Dashboard', icon: Package, id: 'dashboard' },
  { name: 'Wallet', icon: Wallet, id: 'wallet' },
  { name: 'Profile', icon: UserIcon, id: 'profile' },
];

interface SidebarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const Sidebar = memo(({ activeTab, onTabChange }: SidebarProps) => {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-20 lg:w-[260px] bg-[#080808] border-r-[1px] border-white/5 flex-col py-8 shrink-0 z-40">
        <nav className="flex-1 px-4 space-y-2">
          {NavLinks.map((link) => (
            <button 
              key={link.id}
              onClick={() => onTabChange(link.id)}
              className={`cursor-pointer w-full flex items-center gap-3 py-2.5 px-4 rounded-[24px] transition-all group relative overflow-hidden border-[0.5px] ${
                activeTab === link.id 
                ? 'text-white bg-white/[0.02] border-white/[0.04]' 
                : 'text-[#707070] border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              {activeTab === link.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[4px] h-full bg-[#A855F7] rounded-r-[4px]" />
              )}
              <link.icon size={20} className="shrink-0" />
              <span className="font-medium text-[13px] hidden lg:block text-left">{link.name}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#080808]/95 border-t-[1px] border-white/5 backdrop-blur-2xl flex items-center justify-around px-2 z-50 pointer-events-auto">
        {NavLinks.map((link) => (
          <button 
            key={link.id}
            onClick={() => onTabChange(link.id)}
            className={`cursor-pointer flex flex-col items-center gap-1 transition-all ${
              activeTab === link.id ? 'text-white w-full h-full justify-center pt-2 relative' : 'text-[#707070] pt-2 w-full h-full justify-center relative hover:text-white'
            }`}
          >
            {activeTab === link.id && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[3px] bg-[#A855F7] rounded-b-full" />
            )}
            <link.icon size={20} />
            <span className="text-[11px] font-medium">{link.name}</span>
          </button>
        ))}
      </nav>
    </>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;
