import {
  Camera,
  Cpu,
  Gamepad,
  Headphones,
  Laptop,
  Mic,
  Monitor,
  Music,
  Projector,
  Radio,
  Tv,
  Video,
} from 'lucide-react';

export const RENTAL_CATEGORIES = [
  { name: 'Laptops', Icon: Laptop, maxDailyPrice: 1200 },
  { name: 'Gaming Laptops', Icon: Laptop, maxDailyPrice: 2500 },
  { name: 'MacBooks', Icon: Laptop, maxDailyPrice: 1800 },
  { name: 'Consoles', Icon: Gamepad, maxDailyPrice: 1000 },
  { name: 'Cameras', Icon: Camera, maxDailyPrice: 2000 },
  { name: 'VR Headsets', Icon: Video, maxDailyPrice: 1500 },
  { name: 'Musical Instruments', Icon: Music, maxDailyPrice: 1200 },
  { name: 'Music Gear', Icon: Headphones, maxDailyPrice: 1500 },
  { name: 'Projectors', Icon: Projector, maxDailyPrice: 2000 },
  { name: 'TVs', Icon: Tv, maxDailyPrice: 1500 },
  { name: 'Monitors', Icon: Monitor, maxDailyPrice: 1000 },
  { name: 'Streaming Equipment', Icon: Radio, maxDailyPrice: 1200 },
  { name: 'Microphones', Icon: Mic, maxDailyPrice: 700 },
  { name: 'Camera Lenses', Icon: Camera, maxDailyPrice: 1500 },
  { name: 'Action Cameras', Icon: Camera, maxDailyPrice: 900 },
  { name: 'Podcast Equipment', Icon: Mic, maxDailyPrice: 1000 },
  { name: 'GPU', Icon: Cpu, maxDailyPrice: 2000 },
] as const;

export const LEGACY_RENTAL_CATEGORIES = ['Desktops', 'GPUs', 'Controllers'] as const;

export const RENTAL_CATEGORY_PRICE_LIMITS = RENTAL_CATEGORIES.reduce<Record<string, number>>((limits, category) => {
  limits[category.name] = category.maxDailyPrice;
  return limits;
}, {});

const LEGACY_PRICE_LIMITS: Record<string, number> = {
  Desktops: 3000,
  GPUs: 2000,
  Controllers: 700,
};

export function getRentalCategoryMaxPrice(category: string) {
  return RENTAL_CATEGORY_PRICE_LIMITS[category] ?? LEGACY_PRICE_LIMITS[category] ?? 1000;
}

export function isLaptopCategory(category: string) {
  return ['Laptops', 'Gaming Laptops', 'Desktops'].includes(category);
}

export function isGpuCategory(category: string) {
  return category === 'GPU' || category === 'GPUs';
}

export function isMacBookCategory(category: string) {
  return category === 'MacBooks';
}

export function isSimpleBrandModelCategory(category: string) {
  return [
    'Cameras',
    'VR Headsets',
    'Musical Instruments',
    'Music Gear',
    'TVs',
    'Projectors',
    'Streaming Equipment',
    'Podcast Equipment',
    'Microphones',
    'Camera Lenses',
    'Action Cameras',
  ].includes(category);
}
