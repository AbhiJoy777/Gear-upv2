import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Loader2, MapPin, Navigation, Save, Search, X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { CITIES, createAddressId, formatAddress, GearUpAddress } from '@/lib/address';

declare global {
  interface Window {
    google?: any;
  }
}

let googleMapsPromise: Promise<void> | null = null;

const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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

type Step = 'location' | 'details';

export default function AddressModal({ open, onClose, editAddress }: AddressModalProps) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const addresses: GearUpAddress[] = profile?.addresses || [];
  const placesHostRef = useRef<HTMLDivElement | null>(null);
  const placesServiceRef = useRef<any>(null);
  const autocompleteServiceRef = useRef<any>(null);
  const [step, setStep] = useState<Step>('location');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [form, setForm] = useState({
    label: 'Home' as GearUpAddress['label'],
    city: profile?.city || 'Hyderabad',
    houseFlat: '',
    building: '',
    area: '',
    landmark: '',
    instructions: '',
    lat: null as number | null,
    lng: null as number | null,
    formattedAddress: '',
  });

  const selectedLocationReady = Boolean(form.formattedAddress || (form.lat && form.lng));

  useEffect(() => {
    if (!open) return;
    autocompleteServiceRef.current = null;
    placesServiceRef.current = null;
    setPredictions([]);
    setSearchQuery('');

    if (editAddress) {
      setStep('details');
      setForm({
        label: editAddress.label || 'Home',
        city: editAddress.city || profile?.city || 'Hyderabad',
        houseFlat: editAddress.houseOrBuilding || '',
        building: '',
        area: editAddress.area || '',
        landmark: editAddress.landmark || '',
        instructions: editAddress.instructions || '',
        lat: typeof editAddress.lat === 'number' ? editAddress.lat : null,
        lng: typeof editAddress.lng === 'number' ? editAddress.lng : null,
        formattedAddress: editAddress.formattedAddress || '',
      });
      return;
    }

    setStep('location');
    setForm({
      label: 'Home',
      city: profile?.city || 'Hyderabad',
      houseFlat: '',
      building: '',
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
    if (!open || !mapsReady || !placesHostRef.current) return;
    if (!autocompleteServiceRef.current) autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
    if (!placesServiceRef.current) placesServiceRef.current = new window.google.maps.places.PlacesService(placesHostRef.current);
  }, [open, mapsReady]);

  useEffect(() => {
    if (!mapsReady || !autocompleteServiceRef.current || searchQuery.trim().length < 2) {
      setPredictions([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      setLoadingPredictions(true);
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: searchQuery,
          componentRestrictions: { country: 'in' },
        },
        (results: any[] | null, status: string) => {
          setLoadingPredictions(false);
          if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results) {
            setPredictions([]);
            return;
          }
          setPredictions(results.slice(0, 5));
        }
      );
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [mapsReady, searchQuery]);

  const applyPlace = (place: any) => {
    const next = placeToAddressFields(place);
    setForm((current) => ({
      ...current,
      formattedAddress: next.formattedAddress,
      city: next.city || current.city,
      area: next.area || current.area,
      lat: next.lat,
      lng: next.lng,
    }));
    setSearchQuery(next.formattedAddress);
    setPredictions([]);
    setStep('details');
  };

  const selectPrediction = (prediction: any) => {
    if (!placesServiceRef.current) return;
    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['address_components', 'formatted_address', 'geometry', 'name'],
      },
      (place: any, status: string) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) {
          showToast('Could not read that place. Try another result.', 'error');
          return;
        }
        applyPlace(place);
      }
    );
  };

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
        setSearchQuery(geocoded?.formattedAddress || 'Current location');
        setStep('details');
        showToast(geocoded ? 'Location detected. Add address details.' : 'Location captured. Add address details.', 'success');
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
    const houseOrBuilding = [form.houseFlat.trim(), form.building.trim()].filter(Boolean).join(', ');
    if (!houseOrBuilding || !form.area.trim() || !form.city || !form.landmark.trim()) {
      showToast('Please complete the address fields.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const address: GearUpAddress = {
        id: editAddress?.id || createAddressId(),
        label: form.label,
        city: form.city,
        houseOrBuilding,
        area: form.area.trim(),
        landmark: form.landmark.trim(),
        instructions: form.instructions.trim(),
        lat: form.lat,
        lng: form.lng,
        formattedAddress: form.formattedAddress || formatAddress({ city: form.city, houseOrBuilding, area: form.area, landmark: form.landmark }),
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
            className="relative z-10 w-full max-w-[520px] max-h-[92dvh] bg-[#121212] border border-white/10 rounded-[28px] shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
          >
            <div className="px-5 sm:px-6 py-5 flex items-center justify-between border-b border-white/5 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {step === 'details' && !editAddress && (
                  <button
                    onClick={() => setStep('location')}
                    className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all"
                  >
                    <ArrowLeft size={18} />
                  </button>
                )}
                <div className="w-9 h-9 rounded-[14px] bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center shrink-0">
                  <MapPin size={18} className="text-[#A855F7]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[16px] font-bold text-white tracking-tight">{editAddress ? 'Edit Address' : step === 'location' ? 'Select Location' : 'Address Details'}</h2>
                  <p className="text-[11px] text-white/40 truncate">{step === 'location' ? 'Search or use current location' : 'Add house and delivery instructions'}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <AnimatePresence mode="wait">
                {step === 'location' ? (
                  <motion.div
                    key="location"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    className="p-5 sm:p-6 space-y-4"
                  >
                    <div className="relative">
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={googleMapsKey ? mapsLoading ? 'Loading Google Places...' : 'Search building, area, or place' : 'Google Maps key missing. Continue manually.'}
                        disabled={mapsLoading || !googleMapsKey}
                        className="w-full h-14 bg-[#0A0A0A] text-white border border-white/10 rounded-[18px] pl-12 pr-4 text-[14px] focus:border-[#A855F7] outline-none placeholder:text-white/25 disabled:opacity-60"
                      />
                    </div>

                    {googleMapsKey && (
                      <div className="bg-[#0A0A0A] border border-white/10 rounded-[20px] overflow-hidden min-h-[52px]">
                        {loadingPredictions ? (
                          <div className="p-4 flex items-center gap-2 text-white/45 text-[13px]">
                            <Loader2 size={15} className="animate-spin" /> Searching nearby places...
                          </div>
                        ) : predictions.length > 0 ? (
                          predictions.map((prediction) => (
                            <button
                              key={prediction.place_id}
                              onClick={() => selectPrediction(prediction)}
                              className="w-full p-4 text-left flex items-start gap-3 hover:bg-white/5 transition-all border-b border-white/5 last:border-b-0"
                            >
                              <MapPin size={16} className="text-[#A855F7] mt-0.5 shrink-0" />
                              <span className="min-w-0">
                                <span className="block text-white text-[13px] font-semibold truncate">{prediction.structured_formatting?.main_text || prediction.description}</span>
                                <span className="block text-white/40 text-[11px] mt-0.5 line-clamp-1">{prediction.structured_formatting?.secondary_text || prediction.description}</span>
                              </span>
                            </button>
                          ))
                        ) : (
                          <p className="p-4 text-white/35 text-[12px]">{mapsReady ? 'Search for a place to see suggestions.' : 'Manual address entry is available below.'}</p>
                        )}
                      </div>
                    )}

                    <button
                      onClick={useCurrentLocation}
                      disabled={locating}
                      className="w-full bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 text-[#2DD4BF] font-bold py-3.5 rounded-[18px] text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {locating ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                      {locating ? 'Detecting location...' : 'Use Current Location'}
                    </button>

                    <MapPreview lat={form.lat} lng={form.lng} label={form.formattedAddress || 'Choose a pickup point'} large />

                    <button
                      onClick={() => setStep('details')}
                      className="w-full bg-white/5 border border-white/10 text-white/70 font-bold py-3.5 rounded-[18px] text-[13px] hover:bg-white/10 transition-all"
                    >
                      {selectedLocationReady ? 'Confirm Location' : 'Enter Address Manually'}
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    className="p-5 sm:p-6 space-y-4"
                  >
                    <div className="bg-[#0A0A0A] border border-white/10 rounded-[20px] p-4">
                      <p className="text-[11px] text-white/35 font-bold uppercase tracking-wider">Selected Location</p>
                      <p className="text-white text-[13px] font-semibold mt-1 leading-relaxed">{form.formattedAddress || formatAddress({ city: form.city, area: form.area }) || 'Manual address'}</p>
                    </div>

                    <MapPreview lat={form.lat} lng={form.lng} label={form.formattedAddress || 'Address pin'} />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="House / Flat No" value={form.houseFlat} onChange={(value) => setForm({ ...form, houseFlat: value })} />
                      <Field label="Apartment / Building" value={form.building} onChange={(value) => setForm({ ...form, building: value })} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Area / Locality" value={form.area} onChange={(value) => setForm({ ...form, area: value, formattedAddress: '' })} />
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-white/5 flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0">
              <button onClick={onClose} className="w-full sm:w-auto px-6 py-3 text-white/50 hover:text-white font-bold text-[13px] rounded-[18px] hover:bg-white/5">
                Later
              </button>
              {step === 'details' && (
                <button
                  onClick={saveAddress}
                  disabled={saving}
                  className="w-full sm:w-auto px-6 py-3 bg-[#A855F7] text-white font-bold rounded-[18px] hover:bg-[#9333EA] transition-all text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Address'}
                </button>
              )}
            </div>

            <div ref={placesHostRef} className="hidden" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function MapPreview({ lat, lng, label, large = false }: { lat: number | null; lng: number | null; label: string; large?: boolean }) {
  return (
    <div className={`${large ? 'h-[230px]' : 'h-[150px]'} rounded-[22px] overflow-hidden border border-white/10 bg-[#0A0A0A] relative`}>
      {lat && lng ? (
        <iframe
          title="Selected address map preview"
          src={`https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`}
          className="w-full h-full border-0"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-8">
          <div className="w-12 h-12 rounded-full bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center">
            <MapPin size={22} className="text-[#A855F7]" />
          </div>
          <p className="text-white/50 text-[13px] leading-relaxed">{label}</p>
        </div>
      )}
      {lat && lng && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pointer-events-none">
          <MapPin size={30} className="text-[#A855F7] drop-shadow-[0_0_12px_rgba(168,85,247,0.8)]" fill="#A855F7" />
        </div>
      )}
    </div>
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
