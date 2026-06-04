

import React, { useEffect, useRef, useState, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { Camera, ChevronLeft, ChevronRight, Cpu, Gamepad2, Laptop, Loader2, MapPin, MessageCircle, Monitor, PlusCircle, Search, ShoppingBag, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import BookingModal from '../modals/BookingModal';
import SaleChatModal from '../modals/SaleChatModal';
import { formatAddress } from '@/lib/address';
import { BETA_LAUNCH_MODE, DEMO_RENT_LISTINGS, DEMO_SALE_LISTINGS } from '@/lib/beta';
import { useToast } from '@/context/ToastContext';

const CATEGORIES = ['Laptops', 'Desktops', 'GPUs', 'Consoles', 'Monitors', 'Controllers'];
const BUY_CATEGORIES = ['Laptops', 'GPUs', 'Consoles', 'Gaming PCs', 'Monitors', 'Cameras', 'Camera Gear', 'Accessories', 'Other Tech Gear'];
const PAGE_SIZE = 20;
const XBOX_THUMBNAIL =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 900 600%22%3E%3Cdefs%3E%3CradialGradient id=%22g%22 cx=%2255%25%22 cy=%2230%25%22 r=%2270%25%22%3E%3Cstop offset=%220%25%22 stop-color=%22%2316a34a%22 stop-opacity=%22.95%22/%3E%3Cstop offset=%2240%25%22 stop-color=%22%230f172a%22/%3E%3Cstop offset=%22100%25%22 stop-color=%22%23020617%22/%3E%3C/radialGradient%3E%3ClinearGradient id=%22x%22 x1=%220%22 x2=%221%22%3E%3Cstop stop-color=%22%231f2937%22/%3E%3Cstop offset=%221%22 stop-color=%22%23030508%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%22900%22 height=%22600%22 fill=%22url(%23g)%22/%3E%3Crect x=%22560%22 y=%22105%22 width=%22118%22 height=%22385%22 rx=%2218%22 fill=%22url(%23x)%22 stroke=%22%2334d399%22 stroke-opacity=%22.35%22 stroke-width=%223%22/%3E%3Ccircle cx=%22619%22 cy=%22158%22 r=%2229%22 fill=%22%23050a07%22 stroke=%22%2322c55e%22 stroke-width=%224%22/%3E%3Cpath d=%22M601 140c21 11 37 28 47 51%22 fill=%22none%22 stroke=%22%2316a34a%22 stroke-width=%224%22 stroke-linecap=%22round%22/%3E%3Cpath d=%22M220 342c28-62 84-96 154-86l71 13 71-13c70-10 126 24 154 86l28 61c13 28-6 61-37 61h-70c-21 0-40-11-51-29l-24-39H374l-24 39c-11 18-30 29-51 29h-70c-31 0-50-33-37-61l28-61z%22 fill=%22%23101419%22 stroke=%22%23e5e7eb%22 stroke-opacity=%22.2%22 stroke-width=%223%22/%3E%3Ccircle cx=%22321%22 cy=%22358%22 r=%2228%22 fill=%22%23111827%22 stroke=%22%234ade80%22 stroke-width=%225%22/%3E%3Cpath d=%22M296 358h50M321 333v50%22 stroke=%22%234ade80%22 stroke-width=%227%22 stroke-linecap=%22round%22/%3E%3Ccircle cx=%22576%22 cy=%22335%22 r=%2211%22 fill=%22%2322c55e%22/%3E%3Ccircle cx=%22610%22 cy=%22360%22 r=%2211%22 fill=%22%2384cc16%22/%3E%3Ccircle cx=%22542%22 cy=%22360%22 r=%2211%22 fill=%22%2316a34a%22/%3E%3Ccircle cx=%22576%22 cy=%22386%22 r=%2211%22 fill=%22%23bbf7d0%22/%3E%3Ctext x=%2272%22 y=%22110%22 fill=%22%23dcfce7%22 font-family=%22Arial,Helvetica,sans-serif%22 font-size=%2252%22 font-weight=%22700%22%3EXbox%3C/text%3E%3Ctext x=%2274%22 y=%22152%22 fill=%22%2386efac%22 font-family=%22Arial,Helvetica,sans-serif%22 font-size=%2224%22 font-weight=%22700%22 letter-spacing=%224%22%3ESERIES X%7CS%3C/text%3E%3C/svg%3E';
const CATEGORY_VISUALS = {
  laptop: { Icon: Laptop, label: 'Laptop', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80' },
  desktop: { Icon: Monitor, label: 'Gaming PC', image: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=900&q=80' },
  gpu: { Icon: Cpu, label: 'GPU', image: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=900&q=80' },
  console: { Icon: Gamepad2, label: 'Console', image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=900&q=80' },
  playstation: { Icon: Gamepad2, label: 'PlayStation', image: 'https://images.unsplash.com/photo-1607853202273-797f1c22a38e?auto=format&fit=crop&w=900&q=80' },
  xbox: { Icon: Gamepad2, label: 'Xbox', image: XBOX_THUMBNAIL },
  nintendo: { Icon: Gamepad2, label: 'Nintendo', image: 'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?auto=format&fit=crop&w=900&q=80' },
  camera: { Icon: Camera, label: 'Camera', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80' },
  monitor: { Icon: Monitor, label: 'Monitor', image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80' },
  controller: { Icon: Gamepad2, label: 'Controller', image: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=900&q=80' },
  fallback: { Icon: ShoppingBag, label: 'Tech Gear', image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80' },
};

function getCategoryVisual(item: any) {
  const primaryText = `${item?.title || ''} ${item?.model || ''} ${item?.name || ''}`.toLowerCase();
  if (primaryText.includes('xbox') || primaryText.includes('series x') || primaryText.includes('series s')) return CATEGORY_VISUALS.xbox;
  if (primaryText.includes('playstation') || primaryText.includes('ps4') || primaryText.includes('ps5') || /\bps\b/.test(primaryText)) return CATEGORY_VISUALS.playstation;
  if (primaryText.includes('nintendo') || primaryText.includes('switch')) return CATEGORY_VISUALS.nintendo;

  const text = `${item?.category || ''} ${primaryText}`.toLowerCase();
  if (text.includes('laptop') || text.includes('macbook')) return CATEGORY_VISUALS.laptop;
  if (text.includes('gpu') || text.includes('rtx') || text.includes('gtx') || text.includes('radeon')) return CATEGORY_VISUALS.gpu;
  if (text.includes('desktop') || text.includes('gaming pc') || /\bpc\b/.test(text)) return CATEGORY_VISUALS.desktop;
  if (text.includes('playstation') || text.includes('ps4') || text.includes('ps5')) return CATEGORY_VISUALS.playstation;
  if (text.includes('xbox') || text.includes('series x') || text.includes('series s')) return CATEGORY_VISUALS.xbox;
  if (text.includes('nintendo') || text.includes('switch')) return CATEGORY_VISUALS.nintendo;
  if (text.includes('console')) return CATEGORY_VISUALS.console;
  if (text.includes('camera') || text.includes('dslr') || text.includes('mirrorless') || text.includes('canon') || text.includes('sony') || text.includes('nikon') || text.includes('gopro')) return CATEGORY_VISUALS.camera;
  if (text.includes('monitor')) return CATEGORY_VISUALS.monitor;
  if (text.includes('controller') || text.includes('gamepad')) return CATEGORY_VISUALS.controller;
  return CATEGORY_VISUALS.fallback;
}

function CategoryThumbnail({ item, imageUrl }: { item: any; imageUrl?: string }) {
  if (imageUrl) {
    return <img src={imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out relative z-0" />;
  }

  const { Icon, label, image } = getCategoryVisual(item);
  return (
    <div className="relative z-0 w-full h-full bg-[#0A0A0A] overflow-hidden">
      <img
        src={image}
        alt={label}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
        onError={(event) => {
          if (event.currentTarget.src !== CATEGORY_VISUALS.console.image) {
            event.currentTarget.src = CATEGORY_VISUALS.console.image;
          }
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/10" />
      <div className="absolute left-4 bottom-4 flex items-center gap-2">
        <span className="w-9 h-9 rounded-[14px] bg-black/45 border border-white/10 backdrop-blur-md flex items-center justify-center">
          <Icon size={18} className="text-white/80" />
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/70">{label}</span>
      </div>
    </div>
  );
}

function useBodyScrollLock() {
  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, []);
}

function useMediaQuery(queryText: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(queryText);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [queryText]);

  return matches;
}

function pageCount(total: number) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

function searchableText(item: any, mode: 'rent' | 'buy') {
  const location = mode === 'rent' ? item.location || {} : item.addressSnapshot || {};
  const specs = item.specs ? JSON.stringify(item.specs) : '';
  return [
    item.title,
    item.category,
    item.city,
    location.city,
    location.area,
    item.description,
    item.tier,
    specs,
  ].filter(Boolean).join(' ').toLowerCase();
}

function itemCity(item: any, mode: 'rent' | 'buy') {
  const location = mode === 'rent' ? item.location || {} : item.addressSnapshot || {};
  return location.city || item.city || 'Hyderabad';
}

function itemArea(item: any, mode: 'rent' | 'buy') {
  const location = mode === 'rent' ? item.location || {} : item.addressSnapshot || {};
  return location.area || 'Area pending';
}

type MarketMode = 'rent' | 'buy';

type SearchSuggestion = {
  id: string;
  title: string;
  category: string;
  city: string;
};

function ModeSwitch({
  marketMode,
  onModeChange,
  className = '',
  compact = false,
}: {
  marketMode: MarketMode;
  onModeChange: (mode: MarketMode) => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={`inline-grid grid-cols-2 p-1 bg-[#121212] border border-white/[0.05] rounded-[24px] ${className}`}>
      {(['rent', 'buy'] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => onModeChange(mode)}
          className={`${compact ? 'px-4 py-2 rounded-[18px] text-[11px]' : 'px-6 py-2.5 rounded-[20px] text-[12px]'} font-bold uppercase tracking-wider transition-all ${
            marketMode === mode ? 'bg-white text-black' : 'text-white/45 hover:text-white'
          }`}
        >
          {mode === 'rent' ? 'Rent' : 'Buy'}
        </button>
      ))}
    </div>
  );
}

function CategoryTabs({
  marketMode,
  selectedCategory,
  onCategoryChange,
  className = '',
}: {
  marketMode: MarketMode;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  className?: string;
}) {
  const categories = ['All Gear', ...(marketMode === 'rent' ? CATEGORIES : BUY_CATEGORIES)];

  return (
    <div className={`flex gap-6 md:gap-8 overflow-x-auto pb-0 scrollbar-hide border-b border-white/5 relative ${className}`}>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onCategoryChange(cat)}
          className={`cursor-pointer pb-4 text-[13px] font-medium transition-colors duration-300 shrink-0 relative group hover:text-white ${
            selectedCategory === cat
              ? 'text-white'
              : 'text-[#707070]'
          }`}
        >
          <span className="relative z-10">{cat}</span>
          {selectedCategory === cat && (
            <motion.div
              layoutId="marketplace-category-indicator"
              className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#A855F7] z-20"
            />
          )}
          {selectedCategory !== cat && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300 z-10" />
          )}
        </button>
      ))}
    </div>
  );
}

function SuggestionList({
  suggestions,
  onSelect,
}: {
  suggestions: SearchSuggestion[];
  onSelect: (title: string) => void;
}) {
  return (
    <div
      data-marketplace-search-suggestions
      className="bg-[#121212] border border-white/10 rounded-[20px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
    >
      {suggestions.length > 0 ? (
        suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(suggestion.title)}
            className="w-full text-left px-4 py-3 hover:bg-white/5 transition-all border-b border-white/[0.04] last:border-b-0"
          >
            <p className="text-white text-[13px] font-bold line-clamp-1">{suggestion.title}</p>
            <p className="text-white/40 text-[11px] mt-1">{suggestion.category} - {suggestion.city}</p>
          </button>
        ))
      ) : (
        <div className="px-4 py-3 text-white/40 text-[12px]">No suggestions found.</div>
      )}
    </div>
  );
}

function MobileSearchInput({
  value,
  marketMode,
  selectedCity,
  suggestions,
  suggestionsOpen,
  searchActive,
  inputRef,
  containerRef,
  onChange,
  onFocus,
  onClear,
  onSubmit,
  onSelectSuggestion,
}: {
  value: string;
  marketMode: MarketMode;
  selectedCity: string;
  suggestions: SearchSuggestion[];
  suggestionsOpen: boolean;
  searchActive: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onChange: (value: string) => void;
  onFocus: () => void;
  onClear: () => void;
  onSubmit: () => void;
  onSelectSuggestion: (title: string) => void;
}) {
  return (
    <div ref={containerRef} className="relative">
      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35 pointer-events-none" />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit();
        }}
        placeholder={`Search ${marketMode === 'rent' ? 'rentals' : 'sale listings'} in ${selectedCity}`}
        className="w-full h-12 bg-[#121212] border border-white/[0.06] rounded-[20px] pl-11 pr-11 text-white text-[13px] outline-none focus:border-[#A855F7]/60 transition-all placeholder:text-white/25"
      />
      {value && (
        <button
          onClick={onClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/5 text-white/45 hover:text-white hover:bg-white/10 flex items-center justify-center"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
      {suggestionsOpen && searchActive && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40">
          <SuggestionList suggestions={suggestions} onSelect={onSelectSuggestion} />
        </div>
      )}
    </div>
  );
}

const MarketplaceView = memo(({ selectedCity }: { selectedCity: string }) => {

  const { user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [fetchingItems, setFetchingItems] = useState(true);
  const [fetchingSaleItems, setFetchingSaleItems] = useState(true);
  const [bookingItem, setBookingItem] = useState<any | null>(null);
  const [selectedRentListing, setSelectedRentListing] = useState<any | null>(null);
  const [selectedSaleListing, setSelectedSaleListing] = useState<any | null>(null);
  const [saleChatListing, setSaleChatListing] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All Gear');
  const [marketMode, setMarketMode] = useState<MarketMode>('rent');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [searchSource, setSearchSource] = useState<'mobile' | 'desktop' | null>(null);
  const [desktopSuggestionBox, setDesktopSuggestionBox] = useState<{ left: number; top: number; width: number } | null>(null);
  const [page, setPage] = useState(1);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const desktopSearchInputRef = useRef<HTMLInputElement | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDesktopList = useMediaQuery('(min-width: 640px)');

  useEffect(() => {
    if (!user) return;

    const gearRef = collection(db, 'listings');
    const q = query(gearRef, where('status', '==', 'AVAILABLE'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gearData: any[] = snapshot.docs.map(doc => ({
        id: doc.id, ...doc.data()
      }));
      setItems(gearData);
      setFetchingItems(false);
    }, (err) => {
      console.error("Firestore Listen Error:", err);
      setFetchingItems(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const saleRef = collection(db, 'saleListings');
    const q = query(saleRef, where('status', '==', 'ACTIVE'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const saleData = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setSaleItems(saleData);
      setFetchingSaleItems(false);
    }, (err) => {
      console.error('Sale marketplace listen error:', err);
      setFetchingSaleItems(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleBook = async (item: any) => {
    if (!user) return;
    if (BETA_LAUNCH_MODE) {
      showToast('Bookings open soon during GearUp Beta.', 'warning');
      return;
    }
    setBookingItem(item);
  };

  const handleSaleChat = (item: any) => {
    if (!user) return;
    if (BETA_LAUNCH_MODE) {
      showToast('Seller chat opens soon during GearUp Beta.', 'warning');
      return;
    }
    setSaleChatListing(item);
  };

  const getTierColor = (t: string) => {
    if (t === 'High') return 'text-[#A855F7] border-[#A855F7]/30 bg-[#A855F7]/10';
    if (t === 'Mid') return 'text-[#2DD4BF] border-[#2DD4BF]/30 bg-[#2DD4BF]/10';
    return 'text-white border-white/20 bg-white/5';
  };

  const rentBrowseItems = BETA_LAUNCH_MODE ? [...items, ...DEMO_RENT_LISTINGS] : items;
  const saleBrowseItems = BETA_LAUNCH_MODE ? [...saleItems, ...DEMO_SALE_LISTINGS] : saleItems;

  const trimmedSearch = searchQuery.trim().toLowerCase();
  const searchActive = trimmedSearch.length >= 2;

  const filteredItems = rentBrowseItems.filter((item) => {
    const currentItemCity = itemCity(item, 'rent');
    const isAvailable = !item.status || item.status === 'AVAILABLE';
    const cityMatches = currentItemCity === selectedCity;
    const categoryMatches = selectedCategory === 'All Gear' || item.category === selectedCategory;
    const searchMatches = !searchActive || searchableText(item, 'rent').includes(trimmedSearch);
    return isAvailable && cityMatches && categoryMatches && searchMatches;
  });

  const filteredSaleItems = saleBrowseItems.filter((item) => {
    const currentItemCity = itemCity(item, 'buy');
    const cityMatches = currentItemCity === selectedCity;
    const categoryMatches = selectedCategory === 'All Gear' || item.category === selectedCategory;
    const searchMatches = !searchActive || searchableText(item, 'buy').includes(trimmedSearch);
    return cityMatches && categoryMatches && searchMatches;
  });

  const fetching = marketMode === 'rent' ? fetchingItems : fetchingSaleItems;
  const visibleItems = marketMode === 'rent' ? filteredItems : filteredSaleItems;
  const totalPages = pageCount(visibleItems.length);
  const pagedItems = isDesktopList ? visibleItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : visibleItems;
  const suggestions = searchActive
    ? visibleItems.slice(0, 6).map((item) => ({
      id: item.id,
      title: item.title || 'Untitled listing',
      category: item.category || 'Tech gear',
      city: itemCity(item, marketMode),
    }))
    : [];

  const closeSuggestions = () => {
    setSuggestionsOpen(false);
    setSearchSource(null);
  };

  const handleModeChange = (mode: MarketMode) => {
    setMarketMode(mode);
    setSelectedCategory('All Gear');
  };

  const updateDesktopSuggestionBox = () => {
    const input = desktopSearchInputRef.current;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    setDesktopSuggestionBox({
      left: rect.left,
      top: rect.bottom + 8,
      width: rect.width,
    });
  };

  const handleMobileSearchChange = (value: string) => {
    setSearchQuery(value);
    setSearchSource('mobile');
    setSuggestionsOpen(value.trim().length >= 2);
  };

  const handleSearchSubmit = (input?: HTMLInputElement | null) => {
    closeSuggestions();
    input?.blur();
  };

  const handleSuggestionSelect = (title: string, input?: HTMLInputElement | null) => {
    setSearchQuery(title);
    closeSuggestions();
    requestAnimationFrame(() => input?.blur());
  };

  useEffect(() => {
    setSearchQuery('');
    closeSuggestions();
    setPage(1);
  }, [marketMode]);

  useEffect(() => {
    setPage(1);
    closeSuggestions();
  }, [selectedCategory, selectedCity]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  useEffect(() => {
    const headerSearch = document.querySelector('header input[type="text"]') as HTMLInputElement | null;
    desktopSearchInputRef.current = headerSearch;
    if (!headerSearch) return;

    const handleInput = () => {
      const value = headerSearch.value;
      setSearchQuery(value);
      setSearchSource('desktop');
      setSuggestionsOpen(value.trim().length >= 2);
      updateDesktopSuggestionBox();
    };

    const handleFocus = () => {
      setSearchSource('desktop');
      setSuggestionsOpen(headerSearch.value.trim().length >= 2);
      updateDesktopSuggestionBox();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        handleSearchSubmit(headerSearch);
      }
    };

    headerSearch.value = searchQuery;
    headerSearch.addEventListener('input', handleInput);
    headerSearch.addEventListener('focus', handleFocus);
    headerSearch.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updateDesktopSuggestionBox);
    window.addEventListener('scroll', updateDesktopSuggestionBox, true);

    return () => {
      headerSearch.removeEventListener('input', handleInput);
      headerSearch.removeEventListener('focus', handleFocus);
      headerSearch.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateDesktopSuggestionBox);
      window.removeEventListener('scroll', updateDesktopSuggestionBox, true);
    };
  }, []);

  useEffect(() => {
    if (desktopSearchInputRef.current && desktopSearchInputRef.current.value !== searchQuery) {
      desktopSearchInputRef.current.value = searchQuery;
    }
  }, [searchQuery]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const targetElement = event.target as Element | null;
      if (mobileSearchRef.current?.contains(target)) return;
      if (desktopSearchInputRef.current?.contains(target)) return;
      if (targetElement?.closest('[data-marketplace-search-suggestions]')) return;
      closeSuggestions();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (isDesktopList) return;
    const target = event.target as Element | null;
    if (target?.closest('input, textarea, select, button, [data-marketplace-search-suggestions]')) {
      swipeStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (isDesktopList || !swipeStartRef.current) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - swipeStartRef.current.x;
    const deltaY = touch.clientY - swipeStartRef.current.y;
    const horizontal = Math.abs(deltaX);
    const vertical = Math.abs(deltaY);

    swipeStartRef.current = null;

    if (horizontal < 70 || horizontal < vertical * 1.35) return;

    if (deltaX < 0 && marketMode === 'rent') {
      handleModeChange('buy');
      closeSuggestions();
    } else if (deltaX > 0 && marketMode === 'buy') {
      handleModeChange('rent');
      closeSuggestions();
    }
  };


  return (
    <div
      className="p-4 sm:p-6 md:p-10 space-y-8 md:space-y-10 pb-28 md:pb-10"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="mb-2">
        <h2 className="text-4xl sm:text-5xl md:text-7xl font-black mb-5 md:mb-10 tracking-tighter leading-[0.95]">
          <span className="text-white">Explore the </span>
          <span className="text-[#2DD4BF] italic">Armory.</span>
        </h2>

        <div className="hidden md:block">
          <ModeSwitch marketMode={marketMode} onModeChange={handleModeChange} className="mb-6" />
          <CategoryTabs
            marketMode={marketMode}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </div>
      </div>

      <div className="md:hidden -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-[#0A0A0A]/95 backdrop-blur-xl border-y border-white/[0.04] shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
        <div className="space-y-3">
          <ModeSwitch marketMode={marketMode} onModeChange={handleModeChange} className="w-full" compact />
          <MobileSearchInput
            value={searchQuery}
            marketMode={marketMode}
            selectedCity={selectedCity}
            suggestions={suggestions}
            suggestionsOpen={suggestionsOpen && searchSource === 'mobile'}
            searchActive={searchActive}
            inputRef={mobileSearchInputRef}
            containerRef={mobileSearchRef}
            onChange={handleMobileSearchChange}
            onFocus={() => {
              setSearchSource('mobile');
              setSuggestionsOpen(searchQuery.trim().length >= 2);
            }}
            onClear={() => {
              setSearchQuery('');
              closeSuggestions();
              mobileSearchInputRef.current?.focus();
            }}
            onSubmit={() => handleSearchSubmit(mobileSearchInputRef.current)}
            onSelectSuggestion={(title) => handleSuggestionSelect(title, mobileSearchInputRef.current)}
          />
        </div>

        <CategoryTabs
          marketMode={marketMode}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          className="mt-4"
        />
      </div>

      {isDesktopList && suggestionsOpen && searchSource === 'desktop' && searchActive && desktopSuggestionBox && (
        <div
          className="fixed z-[80]"
          style={{
            left: desktopSuggestionBox.left,
            top: desktopSuggestionBox.top,
            width: desktopSuggestionBox.width,
          }}
        >
          <SuggestionList
            suggestions={suggestions}
            onSelect={(title) => handleSuggestionSelect(title, desktopSearchInputRef.current)}
          />
        </div>
      )}

      {fetching ? (
        <div className="h-[40vh] flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-[#A855F7] animate-spin" />
        </div>
      ) : visibleItems.length > 0 ? (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative">
          <AnimatePresence mode="popLayout">
            {marketMode === 'rent' ? pagedItems.map((item) => {
              const pickupLocation = typeof item.location === 'object' ? item.location : {};
              const currentItemCity = pickupLocation.city || item.city || 'Hyderabad';
              const currentItemArea = pickupLocation.area || 'Area pending';
              return (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
                onClick={() => setSelectedRentListing(item)}
                className="cursor-pointer bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[24px] overflow-hidden group hover:border-white/20 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all flex flex-col duration-300 shadow-lg relative"
              >
                <div className="h-48 bg-[#121212] relative overflow-hidden flex items-center justify-center border-b-[0.5px] border-white/[0.04]">
                  {/* Abstract Background Elements */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#2DD4BF]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  {item.tier ? (
                    <span className={`absolute top-4 right-4 text-[11px] font-bold tracking-wider px-3 py-1.5 rounded-[24px] border-[0.5px] z-10 uppercase ${getTierColor(item.tier)}`}>
                      {item.tier} TIER
                    </span>
                  ) : (
                     <span className="absolute top-4 right-4 bg-[#2DD4BF]/10 text-[#2DD4BF] text-[11px] font-bold tracking-wider px-3 py-1.5 rounded-[24px] border-[0.5px] border-[#2DD4BF]/20 z-10 uppercase">
                      {item.status || 'AVAILABLE'}
                     </span>
                  )}
                  <CategoryThumbnail item={item} />
                </div>
                <div className="p-5 flex flex-1 flex-col z-10 bg-[#121212] relative">
                  <div className="flex flex-col mb-2">
                    {item.isGaming && (
                       <span className="text-[#2DD4BF] text-[10px] font-bold tracking-widest uppercase mb-1 flex items-center gap-1.5">
                         <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF] animate-pulse shadow-[0_0_8px_#2DD4BF]"></span>
                         GAMING RIG
                       </span>
                    )}
                    <h3 className="font-semibold text-[15px] text-white group-hover:text-[#2DD4BF] transition-colors tracking-tight line-clamp-1 duration-300">{item.title}</h3>
                  </div>
                <p className="text-[#707070] text-[12px] mb-4 line-clamp-2 font-medium leading-relaxed flex-1 flex flex-col gap-1.5">
                  <span>{item.category} <span className="opacity-50 mx-1">•</span> {currentItemCity} <span className="opacity-50 mx-1">•</span> {currentItemArea}</span>

                  <span className="flex items-center gap-1.5 text-[11px] bg-white/[0.03] text-white/70 w-fit max-w-full px-2 py-1 rounded-[6px] border border-white/[0.05]">
                    <MapPin size={12} className="text-[#A855F7]" />
                    Pickup only
                  </span>
                </p>
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-4 border-t border-white/10">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-medium text-[#707070] tracking-wide block mb-0.5">PER DAY</span>
                      <span className="text-[15px] font-bold text-white tracking-tight shrink-0">₹{item.pricePerDay}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setSelectedRentListing(item); }} disabled={bookingItem?.id === item.id || item.ownerId === user?.uid} className="cursor-pointer px-4 py-2 bg-white/[0.02] border-[0.5px] border-white/[0.04] text-white rounded-[24px] hover:bg-white/10 active:scale-95 transition-all text-[12px] font-semibold disabled:opacity-50">
                      {item.ownerId === user?.uid ? 'Owned' : BETA_LAUNCH_MODE ? 'Preview' : 'Book Now'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}) : pagedItems.map((item) => (
              <SaleMarketplaceCard
                key={item.id}
                item={item}
                currentUserId={user?.uid}
                onOpen={() => setSelectedSaleListing(item)}
                onChat={() => handleSaleChat(item)}
              />
            ))}
          </AnimatePresence>
        </div>
        {isDesktopList && visibleItems.length > PAGE_SIZE && (
          <PaginationControls page={page} total={visibleItems.length} onPageChange={setPage} />
        )}
        </>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-[50vh]">
          <div className="w-full max-w-md p-6 sm:p-10 bg-[#121212] rounded-[24px] mb-8 border-[0.5px] border-white/[0.04] shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-[#A855F7] to-transparent"></div>
             <Camera size={48} className="text-[#A855F7]/40 mb-6 mx-auto" />
             <h3 className="text-[20px] font-bold text-white mb-2 tracking-tight text-center">Nothing found</h3>
             <p className="text-[#707070] text-[13px] text-center max-w-sm mb-8 font-medium leading-relaxed mx-auto">
                Nothing found. Try a different keyword or city.
             </p>
             {marketMode === 'rent' && (
               <button onClick={() => window.dispatchEvent(new CustomEvent('open-list-modal'))} className="cursor-pointer flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[#A855F7] text-white font-bold rounded-[24px] hover:bg-[#9333EA] hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] active:bg-[#7e22ce] active:scale-95 transition-all text-[13px] tracking-wide mx-auto">
                 <PlusCircle size={18} />
                 Drop First Listing
               </button>
             )}
          </div>
        </motion.div>
      )}
      {bookingItem && (
         <BookingModal item={bookingItem} onClose={() => setBookingItem(null)} />
      )}
      {selectedRentListing && (
        <RentListingDetailModal
          item={selectedRentListing}
          currentUserId={user?.uid}
          onClose={() => setSelectedRentListing(null)}
          onBook={() => handleBook(selectedRentListing)}
        />
      )}
      {selectedSaleListing && (
        <SaleListingDetailModal
          item={selectedSaleListing}
          currentUserId={user?.uid}
          onClose={() => setSelectedSaleListing(null)}
          onChat={() => handleSaleChat(selectedSaleListing)}
        />
      )}
      {saleChatListing && (
        <SaleChatModal saleListing={saleChatListing} onClose={() => setSaleChatListing(null)} />
      )}
    </div>
  );
});

function PaginationControls({ page, total, onPageChange }: { page: number; total: number; onPageChange: (page: number) => void }) {
  const totalPages = pageCount(total);
  if (total <= PAGE_SIZE) return null;

  return (
    <div className="hidden sm:flex items-center justify-between gap-3 pt-1">
      <p className="text-[#707070] text-[12px]">
        Page {page} of {totalPages} • {total} results
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="px-4 py-2 rounded-full bg-white/5 text-white/60 hover:text-white hover:bg-white/10 text-[12px] font-bold transition-all disabled:opacity-35 disabled:hover:bg-white/5 disabled:hover:text-white/60"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="px-4 py-2 rounded-full bg-white/5 text-white/60 hover:text-white hover:bg-white/10 text-[12px] font-bold transition-all disabled:opacity-35 disabled:hover:bg-white/5 disabled:hover:text-white/60"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function RentListingDetailModal({ item, currentUserId, onClose, onBook }: { item: any; currentUserId?: string; onClose: () => void; onBook: () => void }) {
  useBodyScrollLock();
  const pickupLocation = typeof item.location === 'object' ? item.location : {};
  const city = pickupLocation.city || item.city || 'Hyderabad';
  const area = pickupLocation.area || 'Area pending';
  const addressText = formatAddress(pickupLocation);
  const owned = item.ownerId === currentUserId;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const detailImages = Array.isArray(item.images) && item.images.length > 0
    ? item.images
    : item.imageUrl && !item.imageUrl.includes('picsum.photos')
      ? [item.imageUrl]
      : [];
  const activeImage = detailImages[activeImageIndex] || detailImages[0];
  const hasMultipleImages = detailImages.length > 1;
  const description = (item.description || '').trim();

  useEffect(() => {
    setActiveImageIndex(0);
  }, [item.id]);

  const showPreviousImage = () => {
    setActiveImageIndex((current) => (current === 0 ? detailImages.length - 1 : current - 1));
  };

  const showNextImage = () => {
    setActiveImageIndex((current) => (current + 1) % detailImages.length);
  };

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-3 sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-[760px] max-h-[92dvh] bg-[#121212] border border-white/10 rounded-[30px] overflow-hidden flex flex-col"
      >
        <div className="px-5 sm:px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <p className="text-[#2DD4BF] text-[10px] font-black uppercase tracking-[0.2em]">Rental Preview</p>
            <h3 className="text-white font-bold text-[18px] mt-1">{item.title}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 md:grid-cols-[1fr_0.85fr] gap-5" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="h-[min(280px,45vh)] md:h-auto md:aspect-[4/3] md:self-start rounded-[24px] overflow-hidden bg-[#0A0A0A] border border-white/10 flex items-center justify-center relative">
              {activeImage ? (
                <img src={activeImage} alt={item.title} className="w-full h-full object-cover" />
              ) : (
                <CategoryThumbnail item={item} />
              )}
            {hasMultipleImages && (
              <>
                <button
                  type="button"
                  onClick={showPreviousImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-white/10 text-white flex items-center justify-center hover:bg-black/80 transition-all"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-white/10 text-white flex items-center justify-center hover:bg-black/80 transition-all"
                  aria-label="Next image"
                >
                  <ChevronRight size={20} />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 border border-white/10 text-white/70 text-[11px] font-bold">
                  {activeImageIndex + 1} / {detailImages.length}
                </div>
              </>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[#A855F7] text-[11px] font-bold uppercase tracking-wider">
                {item.category} {item.tier ? `• ${item.tier} tier` : ''}
              </p>
              <p className="text-white text-[32px] font-black tracking-tight mt-2">₹{item.pricePerDay}<span className="text-[13px] text-white/40 font-bold"> / day</span></p>
            </div>
            <div className="bg-[#0A0A0A] border border-white/10 rounded-[20px] p-4">
              <p className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-2">Pickup</p>
              <p className="text-white/70 text-[13px] leading-relaxed">{city} • {area}</p>
              {addressText && <p className="text-white/45 text-[12px] mt-2 leading-relaxed">{addressText}</p>}
              <p className="text-[#2DD4BF] text-[11px] mt-3 font-bold">Pickup only</p>
            </div>
            {description && (
              <div className="pt-1">
                <p className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-2">Description</p>
                <p className="text-white/75 text-[13px] leading-relaxed whitespace-pre-wrap">{description}</p>
              </div>
            )}
          </div>
        </div>
        <div className="px-5 sm:px-6 py-4 border-t border-white/5 bg-[#121212] shrink-0">
          <button
            onClick={onBook}
            disabled={owned}
            className="w-full bg-[#A855F7] text-white font-bold rounded-[20px] hover:bg-[#9333EA] transition-all text-[13px] py-3.5 flex items-center justify-center gap-2 disabled:opacity-45"
          >
            {owned ? 'Your Listing' : 'Book Now'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SaleMarketplaceCard({ item, currentUserId, onOpen, onChat }: { item: any; currentUserId?: string; onOpen: () => void; onChat: () => void }) {
  const address = item.addressSnapshot || {};
  const city = address.city || item.city || 'Hyderabad';
  const area = address.area || 'Area pending';
  const owned = item.sellerId === currentUserId;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
      onClick={onOpen}
      className="cursor-pointer bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[24px] overflow-hidden group hover:border-white/20 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all flex flex-col duration-300 shadow-lg relative"
    >
      <div className="h-48 bg-[#0A0A0A] relative overflow-hidden flex items-center justify-center border-b-[0.5px] border-white/[0.04]">
        {item.photos?.[0] ? (
          <img src={item.photos[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
        ) : (
          <CategoryThumbnail item={item} />
        )}
        <span className="absolute top-4 right-4 bg-[#2DD4BF]/10 text-[#2DD4BF] text-[11px] font-bold tracking-wider px-3 py-1.5 rounded-[24px] border-[0.5px] border-[#2DD4BF]/20 z-10 uppercase">
          For Sale
        </span>
      </div>
      <div className="p-5 flex flex-1 flex-col z-10 bg-[#121212] relative">
        <p className="text-[#A855F7] text-[10px] font-bold tracking-widest uppercase mb-1">{item.category} • {item.condition}</p>
        <h3 className="font-semibold text-[15px] text-white group-hover:text-[#2DD4BF] transition-colors tracking-tight line-clamp-1 duration-300">{item.title}</h3>
        <p className="text-[#707070] text-[12px] my-4 line-clamp-2 font-medium leading-relaxed flex-1 flex flex-col gap-1.5">
          <span>{city} <span className="opacity-50 mx-1">•</span> {area}</span>
          <span className="flex items-center gap-1.5 text-[11px] bg-white/[0.03] text-white/70 w-fit max-w-full px-2 py-1 rounded-[6px] border border-white/[0.05]">
            <MapPin size={12} className="text-[#A855F7]" />
            Local pickup
          </span>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-4 border-t border-white/10">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium text-[#707070] tracking-wide block mb-0.5">ASKING PRICE</span>
            <span className="text-[16px] font-bold text-white tracking-tight shrink-0">₹{Number(item.price || 0).toLocaleString('en-IN')}</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); if (!owned) onChat(); }} disabled={owned} className="cursor-pointer px-4 py-2 bg-white/[0.02] border-[0.5px] border-white/[0.04] text-white rounded-[24px] hover:bg-white/10 active:scale-95 transition-all text-[12px] font-semibold disabled:opacity-50">
            {owned ? 'Owned' : 'Chat'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SaleListingDetailModal({ item, currentUserId, onClose, onChat }: { item: any; currentUserId?: string; onClose: () => void; onChat: () => void }) {
  useBodyScrollLock();
  const address = item.addressSnapshot || {};
  const addressText = address.formattedAddress || formatAddress(address);
  const owned = item.sellerId === currentUserId;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const photos = Array.isArray(item.photos) ? item.photos : [];
  const activeImage = photos[activeImageIndex] || photos[0];
  const hasMultipleImages = photos.length > 1;
  const description = (item.description || '').trim();

  useEffect(() => {
    setActiveImageIndex(0);
  }, [item.id]);

  const showPreviousImage = () => {
    setActiveImageIndex((current) => (current === 0 ? photos.length - 1 : current - 1));
  };

  const showNextImage = () => {
    setActiveImageIndex((current) => (current + 1) % photos.length);
  };

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-3 sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-[760px] max-h-[92dvh] bg-[#121212] border border-white/10 rounded-[30px] overflow-hidden flex flex-col"
      >
        <div className="px-5 sm:px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <p className="text-[#A855F7] text-[10px] font-black uppercase tracking-[0.2em]">For Sale</p>
            <h3 className="text-white font-bold text-[18px] mt-1">{item.title}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 md:grid-cols-[1fr_0.85fr] gap-5" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="h-[min(280px,45vh)] md:h-auto md:aspect-[4/3] md:self-start rounded-[24px] overflow-hidden bg-[#0A0A0A] border border-white/10 flex items-center justify-center relative">
            {activeImage ? <img src={activeImage} alt={item.title} className="w-full h-full object-cover" /> : <CategoryThumbnail item={item} />}
            {hasMultipleImages && (
              <>
                <button
                  type="button"
                  onClick={showPreviousImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-white/10 text-white flex items-center justify-center hover:bg-black/80 transition-all"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-white/10 text-white flex items-center justify-center hover:bg-black/80 transition-all"
                  aria-label="Next image"
                >
                  <ChevronRight size={20} />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 border border-white/10 text-white/70 text-[11px] font-bold">
                  {activeImageIndex + 1} / {photos.length}
                </div>
              </>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[#2DD4BF] text-[11px] font-bold uppercase tracking-wider">{item.category} • {item.condition}</p>
              <p className="text-white text-[32px] font-black tracking-tight mt-2">₹{Number(item.price || 0).toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-[#0A0A0A] border border-white/10 rounded-[20px] p-4">
              <p className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-2">Seller</p>
              <p className="text-white text-[13px] font-bold">{item.sellerName || 'GearUp Seller'}</p>
              <p className="text-white/45 text-[12px] mt-1">{item.city}</p>
            </div>
            {addressText && (
              <div className="bg-[#0A0A0A] border border-white/10 rounded-[20px] p-4">
                <p className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-2">Pickup Area</p>
                <p className="text-white/65 text-[12px] leading-relaxed">{addressText}</p>
              </div>
            )}
            {description && (
              <div className="pt-1">
                <p className="text-[11px] text-white/35 font-bold uppercase tracking-wider mb-2">Description</p>
                <p className="text-white/75 text-[13px] leading-relaxed whitespace-pre-wrap">{description}</p>
              </div>
            )}
          </div>
        </div>
        <div className="px-5 sm:px-6 py-4 border-t border-white/5 bg-[#121212] shrink-0">
          <button
            onClick={onChat}
            disabled={owned}
            className="w-full bg-[#A855F7] text-white font-bold rounded-[20px] hover:bg-[#9333EA] transition-all text-[13px] py-3.5 flex items-center justify-center gap-2 disabled:opacity-45"
          >
            <MessageCircle size={16} />
            {owned ? 'Your Listing' : 'Chat with Seller'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

MarketplaceView.displayName = 'MarketplaceView';

export default MarketplaceView;
