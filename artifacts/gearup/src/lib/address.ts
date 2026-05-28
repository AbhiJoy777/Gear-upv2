export type GearUpAddress = {
  id: string;
  label: 'Home' | 'Work' | 'Other';
  city: string;
  houseOrBuilding: string;
  area: string;
  landmark: string;
  instructions: string;
  lat: number | null;
  lng: number | null;
  formattedAddress: string;
  isDefault: boolean;
  createdAt: Date;
};

export const CITIES = ['Hyderabad', 'Bangalore', 'Mumbai'];

export const formatAddress = (address: Partial<GearUpAddress> = {}) =>
  [address.houseOrBuilding, address.area, address.city, address.landmark].filter(Boolean).join(' • ');

export const getDefaultAddress = (addresses?: GearUpAddress[]) => {
  if (!addresses || addresses.length === 0) return null;
  return addresses.find((address) => address.isDefault) || addresses[0];
};

export const createAddressId = () => `addr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const mapsUrl = (lat?: number | null, lng?: number | null) => {
  if (typeof lat !== 'number' || typeof lng !== 'number') return '';
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
};
