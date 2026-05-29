import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Navigation, Save, X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { CITIES, createAddressId, formatAddress, GearUpAddress } from '@/lib/address';
import { BETA_LAUNCH_MODE } from '@/lib/beta';

declare global {
  interface Window {
    google?: any;
  }
}

let googleMapsPromise: Promise<void> | null = null;

const googleMapsKey = BETA_LAUNCH_MODE ? '' : import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const loadGoogleMaps = () => {
  if (!googleMapsKey) return Promise.reject(new Error('GOOGLE_MAPS_KEY_MISSING'));
  if (window.google?.maps?.places) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-gearup-google-maps="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('GOOGLE_MAPS_LOAD_FAILED')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.gearupGoogleMaps = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('GOOGLE_MAPS_LOAD_FAILED'));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
};

const getComponent = (components: any[] = [], types: string[]) =>
  components.find((component) => types.some((type) => component.types?.includes(type)))?.long_name || '';

const normalizeCity = (value: string) => {
  const lower = value.toLowerCase();
  if (lower.includes('bengaluru') || lower.includes('bangalore')) return 'Bangalore';
  if (lower.includes('mumbai')) return 'Mumbai';
  if (lower.includes('hyderabad')) return 'Hyderabad';
  return CITIES.includes(value) ? value : '';
};

const placeToAddressFields = (place: any) => {
  const components = place.address_components || [];
  const rawCity =
    getComponent(components, ['locality']) ||
    getComponent(components, ['administrative_area_level_3']) ||
    getComponent(components, ['administrative_area_level_2']);
  const area =
    getComponent(components, ['sublocality_level_1']) ||
    getComponent(components, ['sublocality']) ||
    getComponent(components, ['neighborhood']) ||
    getComponent(components, ['locality']);
  const lat = place.geometry?.location?.lat?.();
  const lng = place.geometry?.location?.lng?.();

  return {
    formattedAddress: place.formatted_address || place.name || '',
    city: normalizeCity(rawCity),
    area,
    lat: typeof lat === 'number' ? lat : null,
    lng: typeof lng === 'number' ? lng : null,
  };
};

type AddressModalProps = {
  open: boolean;
  onClose: () => void;
  editAddress?: GearUpAddress | null;
};

export default function AddressModal({ open, onClose, editAddress }: AddressModalProps) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const addresses: GearUpAddress[] = profile?.addresses || [];
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [form, setForm] = useState({
    label: 'Home' as GearUpAddress['label'],
    city: profile?.city || 'Hyderabad',
    houseOrBuilding: '',
    area: '',
    landmark: '',
    instructions: '',
    lat: null as number | null,
    lng: null as number | null,
    formattedAddress: '',
  });

  useEffect(() => {
    if (!open) return;
    if (editAddress) {
      setForm({
        label: editAddress.label || 'Home',
        city: editAddress.city || profile?.city || 'Hyderabad',
        houseOrBuilding: editAddress.houseOrBuilding || '',
        area: editAddress.area || '',
        landmark: editAddress.landmark || '',
        instructions: editAddress.instructions || '',
        lat: typeof editAddress.lat === 'number' ? editAddress.lat : null,
        lng: typeof editAddress.lng === 'number' ? editAddress.lng : null,
        formattedAddress: editAddress.formattedAddress || '',
      });
      return;
    }

    setForm({
      label: 'Home',
      city: profile?.city || 'Hyderabad',
      houseOrBuilding: '',
      area: '',
      landmark: '',
      instructions: '',
      lat: null,
      lng: null,
      formattedAddress: '',
    });
  }, [open, editAddress, profile?.city]);

  useEffect(() => {
    if (!open || !googleMapsKey) return;

    setMapsLoading(true);
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch((err) => {
        console.error('Google Maps load failed', err);
        setMapsReady(false);
      })
      .finally(() => setMapsLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open || !mapsReady || !searchInputRef.current || autocompleteRef.current) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(searchInputRef.current, {
      componentRestrictions: { country: 'in' },
      fields: ['address_components', 'formatted_address', 'geometry', 'name'],
    });

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace?.();
      if (!place?.geometry?.location) {
        showToast('Select a suggested place from the list.', 'warning');
        return;
      }

      const next = placeToAddressFields(place);
      setForm((current) => ({
        ...current,
        formattedAddress: next.formattedAddress,
        city: next.city || current.city,
        area: next.area || current.area,
        houseOrBuilding: current.houseOrBuilding || place.name || '',
        lat: next.lat,
        lng: next.lng,
      }));
    });
  }, [open, mapsReady, showToast]);

  useEffect(() => {
    if (!open) autocompleteRef.current = null;
  }, [open]);

  const reverseGeocode = async (lat: number, lng: number) => {
    if (!googleMapsKey) return null;

    try {
      await loadGoogleMaps();
      const geocoder = new window.google.maps.Geocoder();
      const response = await new Promise<any>((resolve, reject) => {
        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
          if (status === 'OK') resolve({ results });
          else reject(new Error(status));
        });
      });
      const place = response.results?.[0];
      return place ? placeToAddressFields(place) : null;
    } catch (err) {
      console.error('Reverse geocode failed', err);
      return null;
    }
  };

  const useCurrentLocation = () => {
    if (BETA_LAUNCH_MODE) {
      showToast('Maps and current location open soon for beta testers.', 'warning');
      return;
    }
    if (!navigator.geolocation) {
      showToast('Current location is not supported on this browser.', 'error');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const geocoded = await reverseGeocode(lat, lng);
        setForm((current) => ({
          ...current,
          lat,
          lng,
          formattedAddress: geocoded?.formattedAddress || current.formattedAddress,
          city: geocoded?.city || current.city,
          area: geocoded?.area || current.area,
        }));
        showToast(geocoded ? 'Location captured and address detected. Confirm the details.' : 'Location captured. Confirm the address details.', 'success');
        setLocating(false);
      },
      () => {
        showToast('Location permission denied. You can enter the address manually.', 'error');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const saveAddress = async () => {
    if (!user) return;
    if (!form.houseOrBuilding.trim() || !form.area.trim() || !form.city || !form.landmark.trim()) {
      showToast('Please complete the address fields.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const address: GearUpAddress = {
        id: editAddress?.id || createAddressId(),
        label: form.label,
        city: form.city,
        houseOrBuilding: form.houseOrBuilding.trim(),
        area: form.area.trim(),
        landmark: form.landmark.trim(),
        instructions: form.instructions.trim(),
        lat: form.lat,
        lng: form.lng,
        formattedAddress: form.formattedAddress || formatAddress(form),
        isDefault: editAddress?.isDefault || addresses.length === 0,
        createdAt: editAddress?.createdAt || new Date(),
      };

      const nextAddresses = editAddress
        ? addresses.map((item) => item.id === editAddress.id ? address : item)
        : [...addresses.map((item) => addresses.length === 0 ? { ...item, isDefault: false } : item), address];

      await updateDoc(doc(db, 'users', user.uid), {
        addresses: nextAddresses,
        city: address.city,
      });
      showToast(editAddress ? 'Address updated.' : 'Address added.', 'success');
      onClose();
    } catch (err) {
      console.error(err);
      showToast('Failed to save address.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 18 }}
            className="relative z-10 w-full max-w-[460px] max-h-[92dvh] bg-[#121212] border border-white/10 rounded-[28px] shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
          >
            <div className="px-5 sm:px-6 py-5 flex items-center justify-between border-b border-white/5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[14px] bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center">
                  <MapPin size={18} className="text-[#A855F7]" />
                </div>
                <h2 className="text-[16px] font-bold text-white tracking-tight">{editAddress ? 'Edit Address' : 'Add Address'}</h2>
              </div>
              <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="grid grid-cols-3 gap-2">
                {(['Home', 'Work', 'Other'] as GearUpAddress['label'][]).map((label) => (
                  <button
                    key={label}
                    onClick={() => setForm({ ...form, label })}
                    className={`py-2.5 rounded-[14px] border text-[12px] font-bold transition-all ${
                      form.label === label ? 'bg-[#A855F7]/10 border-[#A855F7] text-white' : 'bg-[#0A0A0A] border-white/10 text-white/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {googleMapsKey && (
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider">Search Place</label>
                  <input
                    ref={searchInputRef}
                    placeholder={mapsLoading ? 'Loading Google Places...' : 'Search building, area, or place'}
                    disabled={mapsLoading || !mapsReady}
                    className="w-full bg-[#0A0A0A] text-white border border-white/10 rounded-[14px] p-3.5 text-[13px] focus:border-[#A855F7] outline-none placeholder:text-white/25 disabled:opacity-50"
                  />
                  <p className="text-[11px] text-white/35">
                    {mapsReady ? 'Pick a suggestion to fill city, area, and map pin.' : 'Manual address entry is still available.'}
                  </p>
                </div>
              )}

              <button
                onClick={useCurrentLocation}
                disabled={locating || BETA_LAUNCH_MODE}
                className="w-full bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 text-[#2DD4BF] font-bold py-3 rounded-[16px] text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Navigation size={16} />
                {BETA_LAUNCH_MODE ? 'Current location opens soon' : locating ? 'Getting location...' : 'Use Current Location'}
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="House / Building" value={form.houseOrBuilding} onChange={(value) => setForm({ ...form, houseOrBuilding: value, formattedAddress: '' })} />
                <div>
                  <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">City</label>
                  <select
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value, formattedAddress: '' })}
                    className="w-full bg-[#0A0A0A] text-white border border-white/10 rounded-[14px] p-3.5 text-[13px] focus:border-[#A855F7] outline-none"
                  >
                    {CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
                  </select>
                </div>
              </div>
              <Field label="Area / Locality" value={form.area} onChange={(value) => setForm({ ...form, area: value, formattedAddress: '' })} />
              <Field label="Landmark" value={form.landmark} onChange={(value) => setForm({ ...form, landmark: value, formattedAddress: '' })} />
              <div>
                <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">Instructions</label>
                <textarea
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  rows={3}
                  placeholder="Parking, gate, floor, call-ahead details"
                  className="w-full bg-[#0A0A0A] text-white border border-white/10 rounded-[14px] p-3.5 text-[13px] focus:border-[#A855F7] outline-none placeholder:text-white/25 resize-none"
                />
              </div>
              {form.lat && form.lng && (
                <div className="space-y-2">
                  <div className="h-[150px] rounded-[18px] overflow-hidden border border-white/10 bg-[#0A0A0A]">
                    <iframe
                      title="Selected address map preview"
                      src={`https://www.google.com/maps?q=${form.lat},${form.lng}&z=15&output=embed`}
                      className="w-full h-full border-0"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-[11px] text-[#2DD4BF] bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 rounded-[12px] p-3">
                    Location saved: {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-white/5 flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0">
              <button onClick={onClose} className="w-full sm:w-auto px-6 py-3 text-white/50 hover:text-white font-bold text-[13px] rounded-[18px] hover:bg-white/5">
                Later
              </button>
              <button
                onClick={saveAddress}
                disabled={saving}
                className="w-full sm:w-auto px-6 py-3 bg-[#A855F7] text-white font-bold rounded-[18px] hover:bg-[#9333EA] transition-all text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Address'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0A0A0A] text-white border border-white/10 rounded-[14px] p-3.5 text-[13px] focus:border-[#A855F7] outline-none placeholder:text-white/25"
      />
    </div>
  );
}
