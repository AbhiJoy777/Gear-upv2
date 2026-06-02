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

type AddressModalProps = {
  open: boolean;
  onClose: () => void;
  editAddress?: GearUpAddress | null;
};

type AddressStep = 'location' | 'details';

type AddressForm = {
  label: GearUpAddress['label'];
  city: string;
  houseOrBuilding: string;
  area: string;
  landmark: string;
  instructions: string;
  lat: number | null;
  lng: number | null;
  formattedAddress: string;
};

type PlaceSuggestion = {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

const viteGoogleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const runtimeGoogleMapsKey = typeof window !== 'undefined'
  ? (window.__GEARUP_CONFIG__ as { googleMapsKey?: string } | undefined)?.googleMapsKey
  : undefined;
const googleMapsKey = viteGoogleMapsKey || runtimeGoogleMapsKey || '';
const googleMapsKeySource = viteGoogleMapsKey ? 'vite-env' : runtimeGoogleMapsKey ? 'runtime' : 'none';
let googleMapsPromise: Promise<void> | null = null;

const SERVICE_AREAS = [
  { city: 'Hyderabad', lat: 17.385, lng: 78.4867, radiusKm: 30 },
  { city: 'Bangalore', lat: 12.9716, lng: 77.5946, radiusKm: 30 },
  { city: 'Mumbai', lat: 19.076, lng: 72.8777, radiusKm: 30 },
];

const DEFAULT_CENTER = SERVICE_AREAS[0];
const OUT_OF_RANGE_MESSAGE = 'This area is currently outside GearUp service range.';

const loadGoogleMaps = () => {
  console.log('GearUp Maps diagnostics', {
    hasMapsEnvKey: Boolean(viteGoogleMapsKey),
    hasRuntimeGoogleMapsKey: Boolean(runtimeGoogleMapsKey),
    selectedMapsKeySource: googleMapsKeySource,
    hasWindowGoogleMaps: Boolean(window.google?.maps),
  });

  if (!googleMapsKey) {
    console.log('GearUp Maps script load failure', 'GOOGLE_MAPS_KEY_MISSING');
    return Promise.reject(new Error('GOOGLE_MAPS_KEY_MISSING'));
  }
  if (window.google?.maps?.places) {
    console.log('GearUp Maps script load success', {
      hasWindowGoogleMaps: Boolean(window.google?.maps),
    });
    return Promise.resolve();
  }
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-gearup-google-maps="true"]');
    if (existing) {
      existing.addEventListener('load', () => {
        console.log('GearUp Maps script load success', {
          hasWindowGoogleMaps: Boolean(window.google?.maps),
        });
        resolve();
      }, { once: true });
      existing.addEventListener('error', (event) => {
        console.log('GearUp Maps script load failure', event);
        reject(new Error('GOOGLE_MAPS_LOAD_FAILED'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.gearupGoogleMaps = 'true';
    script.onload = () => {
      console.log('GearUp Maps script load success', {
        hasWindowGoogleMaps: Boolean(window.google?.maps),
      });
      resolve();
    };
    script.onerror = (event) => {
      console.log('GearUp Maps script load failure', event);
      reject(new Error('GOOGLE_MAPS_LOAD_FAILED'));
    };
    document.head.appendChild(script);
  });

  return googleMapsPromise;
};

const getComponent = (components: any[] = [], types: string[]) =>
  components.find((component) => types.some((type) => component.types?.includes(type)))?.long_name || '';

const normalizeCity = (value = '') => {
  const lower = value.toLowerCase();
  if (lower.includes('bengaluru') || lower.includes('bangalore')) return 'Bangalore';
  if (lower.includes('mumbai')) return 'Mumbai';
  if (lower.includes('hyderabad')) return 'Hyderabad';
  return CITIES.includes(value) ? value : '';
};

const distanceKm = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
  const earthRadiusKm = 6371;
  const latDelta = ((to.lat - from.lat) * Math.PI) / 180;
  const lngDelta = ((to.lng - from.lng) * Math.PI) / 180;
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const supportedServiceArea = (lat: number, lng: number) =>
  SERVICE_AREAS.find((area) => distanceKm({ lat, lng }, area) <= area.radiusKm) || null;

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
    getComponent(components, ['locality']) ||
    place.name ||
    '';
  const lat = place.geometry?.location?.lat?.();
  const lng = place.geometry?.location?.lng?.();

  return {
    formattedAddress: place.formatted_address || place.description || place.name || '',
    city: normalizeCity(rawCity),
    area,
    lat: typeof lat === 'number' ? lat : null,
    lng: typeof lng === 'number' ? lng : null,
  };
};

const mapPreviewUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`;

export default function AddressModal({ open, onClose, editAddress }: AddressModalProps) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const addresses: GearUpAddress[] = profile?.addresses || [];
  const placesServiceRef = useRef<any>(null);
  const [step, setStep] = useState<AddressStep>('location');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsFailed, setMapsFailed] = useState(false);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [form, setForm] = useState<AddressForm>({
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

  const selectedHasPin = typeof form.lat === 'number' && typeof form.lng === 'number';
  const canUseMaps = Boolean(googleMapsKey) && mapsReady && !mapsFailed;
  const selectedSummary =
    form.formattedAddress ||
    (selectedHasPin && !form.houseOrBuilding && !form.area ? 'Location captured. Add house/area details.' : '') ||
    formatAddress(form) ||
    `${form.city || 'Hyderabad'} pickup address`;

  useEffect(() => {
    if (!open) return;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (editAddress) {
      setStep('details');
      setLocationAccuracy(null);
      setSearchQuery(editAddress.formattedAddress || formatAddress(editAddress));
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

    setStep('location');
    setLocationAccuracy(null);
    setSearchQuery('');
    setSuggestions([]);
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
    if (!open) return;
    if (!googleMapsKey) {
      console.log('GearUp Maps unavailable', {
        hasMapsEnvKey: Boolean(viteGoogleMapsKey),
        hasRuntimeGoogleMapsKey: Boolean(runtimeGoogleMapsKey),
        selectedMapsKeySource: googleMapsKeySource,
        hasWindowGoogleMaps: Boolean(window.google?.maps),
      });
      setMapsReady(false);
      setMapsFailed(true);
      return;
    }

    setMapsLoading(true);
    setMapsFailed(false);
    loadGoogleMaps()
      .then(() => {
        setMapsReady(true);
        const serviceHost = document.createElement('div');
        placesServiceRef.current = new window.google.maps.places.PlacesService(serviceHost);
        console.log('GearUp Maps ready', {
          hasWindowGoogleMaps: Boolean(window.google?.maps),
        });
      })
      .catch((err) => {
        console.log('GearUp Maps failed in AddressModal', err);
        setMapsReady(false);
        setMapsFailed(true);
      })
      .finally(() => setMapsLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open || !canUseMaps || searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSuggestionsLoading(true);
      const autocomplete = new window.google.maps.places.AutocompleteService();
      autocomplete.getPlacePredictions(
        {
          input: searchQuery,
          componentRestrictions: { country: 'in' },
          locationBias: {
            lat: selectedHasPin ? form.lat : DEFAULT_CENTER.lat,
            lng: selectedHasPin ? form.lng : DEFAULT_CENTER.lng,
          },
        },
        (predictions: PlaceSuggestion[] | null, status: string) => {
          if (cancelled) return;
          setSuggestionsLoading(false);
          if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions) {
            setSuggestions([]);
            return;
          }
          setSuggestions(predictions.slice(0, 5));
        }
      );
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canUseMaps, form.lat, form.lng, open, searchQuery, selectedHasPin]);

  const ensureSupportedPin = (lat: number, lng: number) => {
    const supported = supportedServiceArea(lat, lng);
    if (!supported) {
      showToast(OUT_OF_RANGE_MESSAGE, 'warning');
      return null;
    }
    return supported;
  };

  const applyPlace = (place: any) => {
    const next = placeToAddressFields(place);
    if (typeof next.lat === 'number' && typeof next.lng === 'number') {
      const supported = ensureSupportedPin(next.lat, next.lng);
      if (!supported) return;
      next.city = next.city || supported.city;
    }

    setForm((current) => ({
      ...current,
      formattedAddress: next.formattedAddress,
      city: next.city || current.city,
      area: next.area || current.area,
      lat: next.lat,
      lng: next.lng,
    }));
    setSearchQuery(next.formattedAddress || searchQuery);
    setSuggestions([]);
    setStep('details');
  };

  const selectSuggestion = (suggestion: PlaceSuggestion) => {
    if (!placesServiceRef.current) return;

    placesServiceRef.current.getDetails(
      {
        placeId: suggestion.place_id,
        fields: ['address_components', 'formatted_address', 'geometry', 'name'],
      },
      (place: any, status: string) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place) {
          showToast('Could not load this place. Try another result.', 'error');
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
    } catch {
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
        const accuracy = typeof position.coords.accuracy === 'number' ? position.coords.accuracy : null;
        setLocationAccuracy(accuracy);
        const supported = ensureSupportedPin(lat, lng);
        if (!supported) {
          setLocating(false);
          return;
        }

        const geocoded = await reverseGeocode(lat, lng);
        setForm((current) => ({
          ...current,
          lat,
          lng,
          formattedAddress: geocoded?.formattedAddress || current.formattedAddress,
          city: geocoded?.city || supported.city || current.city,
          area: geocoded?.area || current.area,
        }));
        setSearchQuery(geocoded?.formattedAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        showToast(accuracy && accuracy > 500 ? 'Location may be approximate. Adjust address details manually.' : 'Location captured. Add house/area details.', accuracy && accuracy > 500 ? 'warning' : 'success');
        setStep('details');
        setLocating(false);
      },
      () => {
        showToast('Location permission denied. Manual address still works during beta.', 'warning');
        setStep('details');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const continueWithoutPin = () => {
    setForm((current) => ({
      ...current,
      city: current.city || profile?.city || 'Hyderabad',
    }));
    setStep('details');
  };

  const confirmLocation = () => {
    if (selectedHasPin && !ensureSupportedPin(form.lat as number, form.lng as number)) return;
    setStep('details');
  };

  const saveAddress = async () => {
    if (!user) return;
    if (!form.houseOrBuilding.trim() || !form.area.trim() || !form.city) {
      showToast('Please add house/building, area, and city.', 'warning');
      return;
    }
    if (selectedHasPin && !ensureSupportedPin(form.lat as number, form.lng as number)) return;

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
        ? addresses.map((item) => (item.id === editAddress.id ? address : item))
        : [...addresses.map((item) => (addresses.length === 0 ? { ...item, isDefault: false } : item)), address];

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
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 18 }}
            className="relative z-10 w-full max-w-[500px] max-h-[92dvh] bg-[#121212] border border-white/10 rounded-[28px] shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
          >
            <div className="px-5 sm:px-6 py-5 flex items-center justify-between border-b border-white/5 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {step === 'details' && !editAddress && (
                  <button onClick={() => setStep('location')} className="p-2 -ml-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all">
                    <ArrowLeft size={18} />
                  </button>
                )}
                <div className="w-9 h-9 rounded-[14px] bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center shrink-0">
                  <MapPin size={18} className="text-[#A855F7]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[16px] font-bold text-white tracking-tight">
                    {step === 'location' ? 'Select Your Location' : editAddress ? 'Edit Address' : 'Add Address Details'}
                  </h2>
                  <p className="text-[11px] text-white/40 truncate">Exact map pin is optional during beta. Manual address works.</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all shrink-0">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
              {step === 'location' ? (
                <div className="space-y-4">
                  {googleMapsKey && !mapsFailed ? (
                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider">Search Location</label>
                      <div className="relative">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
                        <input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={mapsLoading ? 'Loading Google Places...' : 'Search for apartment, street name, landmark...'}
                          disabled={mapsLoading || !mapsReady}
                          className="w-full bg-[#0A0A0A] text-white border border-white/10 rounded-[16px] py-3.5 pl-10 pr-4 text-[13px] focus:border-[#A855F7] outline-none placeholder:text-white/25 disabled:opacity-50"
                        />
                        {suggestionsLoading && <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 animate-spin" />}
                      </div>
                      {suggestions.length > 0 && (
                        <div className="rounded-[18px] border border-white/10 bg-[#0A0A0A] overflow-hidden shadow-2xl">
                          {suggestions.map((suggestion) => (
                            <button
                              key={suggestion.place_id}
                              onClick={() => selectSuggestion(suggestion)}
                              className="w-full text-left px-4 py-3 border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors"
                            >
                              <p className="text-[13px] font-bold text-white">{suggestion.structured_formatting?.main_text || suggestion.description}</p>
                              <p className="text-[11px] text-white/45 truncate">{suggestion.structured_formatting?.secondary_text || suggestion.description}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-[18px] border border-white/10 bg-[#0A0A0A] p-4">
                      <p className="text-[13px] font-bold text-white">Manual address mode</p>
                      <p className="text-[12px] text-white/45 mt-1">Google Maps is unavailable here, but you can still save a beta pickup address.</p>
                    </div>
                  )}

                  <button
                    onClick={useCurrentLocation}
                    disabled={locating}
                    className="w-full bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 text-[#2DD4BF] font-bold py-3 rounded-[16px] text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {locating ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                    {locating ? 'Getting current location...' : 'Use Current Location'}
                  </button>

                  <MapPreview
                    lat={form.lat}
                    lng={form.lng}
                    fallbackCity={form.city || profile?.city || 'Hyderabad'}
                    summary={selectedSummary}
                    mapsAvailable={Boolean(googleMapsKey) && !mapsFailed}
                  />

                  <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1">Selected location</p>
                    <p className="text-[13px] font-bold text-white leading-relaxed">{selectedSummary}</p>
                    <p className="text-[12px] text-white/45 mt-1">{selectedHasPin ? `${form.city || 'Supported city'} map pin selected` : 'No map pin selected yet. Manual address works for beta.'}</p>
                    {locationAccuracy && locationAccuracy > 500 && (
                      <p className="text-[12px] text-[#F97316] mt-2">Location may be approximate. Adjust address details manually.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <MapPreview
                    lat={form.lat}
                    lng={form.lng}
                    fallbackCity={form.city || profile?.city || 'Hyderabad'}
                    summary={selectedSummary}
                    mapsAvailable={Boolean(googleMapsKey) && !mapsFailed}
                    compact
                  />

                  <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1">Selected address</p>
                      <p className="text-[13px] font-bold text-white leading-relaxed">{selectedSummary}</p>
                      {locationAccuracy && locationAccuracy > 500 && (
                        <p className="text-[12px] text-[#F97316] mt-2">Location may be approximate. Adjust address details manually.</p>
                      )}
                    </div>
                    {!editAddress && (
                      <button onClick={() => setStep('location')} className="text-[12px] font-bold text-[#A855F7] hover:text-white shrink-0">
                        Change
                      </button>
                    )}
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

                  <Field
                    label="House No. and Floor"
                    value={form.houseOrBuilding}
                    placeholder="Flat 402, 4th floor"
                    onChange={(value) => setForm({ ...form, houseOrBuilding: value })}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">City</label>
                      <select
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value, formattedAddress: selectedHasPin ? form.formattedAddress : '' })}
                        className="w-full bg-[#0A0A0A] text-white border border-white/10 rounded-[14px] p-3.5 text-[13px] focus:border-[#A855F7] outline-none"
                      >
                        {CITIES.map((city) => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>
                    <Field
                      label="Area / Locality"
                      value={form.area}
                      placeholder="Madhapur, Indiranagar, Bandra..."
                      onChange={(value) => setForm({ ...form, area: value })}
                    />
                  </div>
                  <Field
                    label="Landmark"
                    value={form.landmark}
                    placeholder="Near metro station, gate, store"
                    onChange={(value) => setForm({ ...form, landmark: value })}
                  />
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
                </div>
              )}
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-white/5 flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0">
              <button onClick={onClose} className="w-full sm:w-auto px-6 py-3 text-white/50 hover:text-white font-bold text-[13px] rounded-[18px] hover:bg-white/5">
                Later
              </button>
              {step === 'location' ? (
                <>
                  <button onClick={continueWithoutPin} className="w-full sm:w-auto px-6 py-3 text-white/70 hover:text-white font-bold text-[13px] rounded-[18px] hover:bg-white/5 border border-white/10">
                    Continue Manually
                  </button>
                  <button
                    onClick={confirmLocation}
                    disabled={!selectedHasPin}
                    className="w-full sm:w-auto px-6 py-3 bg-[#A855F7] text-white font-bold rounded-[18px] hover:bg-[#9333EA] transition-all text-[13px] disabled:opacity-50"
                  >
                    Confirm Location
                  </button>
                </>
              ) : (
                <button
                  onClick={saveAddress}
                  disabled={saving}
                  className="w-full sm:w-auto px-6 py-3 bg-[#A855F7] text-white font-bold rounded-[18px] hover:bg-[#9333EA] transition-all text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? 'Saving...' : 'Save Address'}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function MapPreview({
  lat,
  lng,
  fallbackCity,
  summary,
  mapsAvailable,
  compact = false,
}: {
  lat: number | null;
  lng: number | null;
  fallbackCity: string;
  summary: string;
  mapsAvailable: boolean;
  compact?: boolean;
}) {
  const city = SERVICE_AREAS.find((area) => area.city === fallbackCity) || DEFAULT_CENTER;
  const previewLat = typeof lat === 'number' ? lat : city.lat;
  const previewLng = typeof lng === 'number' ? lng : city.lng;

  return (
    <div className={`${compact ? 'h-[140px]' : 'h-[230px]'} rounded-[22px] overflow-hidden border border-white/10 bg-[#0A0A0A] relative`}>
      {mapsAvailable ? (
        <iframe
          title="Address map preview"
          src={mapPreviewUrl(previewLat, previewLng)}
          className="w-full h-full border-0 opacity-80 [filter:invert(0.88)_hue-rotate(180deg)_saturate(0.75)_brightness(0.82)]"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.18),rgba(10,10,10,1)_60%)] flex items-center justify-center p-6 text-center">
          <div>
            <MapPin size={22} className="text-[#A855F7] mx-auto mb-3" />
            <p className="text-[13px] font-bold text-white">Map preview unavailable. You can still save address manually.</p>
          </div>
        </div>
      )}
      {mapsAvailable && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
          <div className="w-9 h-9 rounded-full bg-[#A855F7] border-4 border-white/90 shadow-2xl flex items-center justify-center">
            <MapPin size={16} className="text-white" />
          </div>
        </div>
      )}
      <div className="absolute left-3 right-3 bottom-3 rounded-[16px] bg-black/70 border border-white/10 backdrop-blur-md px-3 py-2">
        <p className="text-[12px] font-bold text-white truncate">{summary}</p>
        <p className="text-[10px] text-white/45">{typeof lat === 'number' && typeof lng === 'number' ? 'Map pin selected' : 'Preview center. Exact pin optional in beta.'}</p>
      </div>
    </div>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0A0A0A] text-white border border-white/10 rounded-[14px] p-3.5 text-[13px] focus:border-[#A855F7] outline-none placeholder:text-white/25"
      />
    </div>
  );
}
