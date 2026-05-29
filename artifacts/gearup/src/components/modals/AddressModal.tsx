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

type GearUpRuntimeWindow = Window & {
  __GEARUP_CONFIG__?: {
    razorpayKey?: string;
    googleMapsKey?: string;
  };
};

type Step = 'location' | 'details';
type LatLng = { lat: number; lng: number };

const runtimeWindow = window as GearUpRuntimeWindow;
const getGoogleMapsKey = () => import.meta.env.VITE_GOOGLE_MAPS_API_KEY || runtimeWindow.__GEARUP_CONFIG__?.googleMapsKey || '';

const SERVICE_CITY_CENTERS = [
  { city: 'Hyderabad', lat: 17.385, lng: 78.4867, radiusKm: 30 },
  { city: 'Bangalore', lat: 12.9716, lng: 77.5946, radiusKm: 30 },
  { city: 'Mumbai', lat: 19.076, lng: 72.8777, radiusKm: 30 },
];

const DEFAULT_CENTER: LatLng = { lat: 17.385, lng: 78.4867 };
const OUT_OF_RANGE_MESSAGE = 'This area is currently outside GearUp service range.';

const loadGoogleMaps = () => {
  const googleMapsKey = getGoogleMapsKey();
  if (!googleMapsKey) return Promise.reject(new Error('GOOGLE_MAPS_KEY_MISSING'));
  if (window.google?.maps?.places) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-gearup-google-maps="true"]');
    if (existing) {
      if (window.google?.maps?.places) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('GOOGLE_MAPS_LOAD_FAILED')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&libraries=places&v=weekly`;
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

const distanceKm = (a: LatLng, b: LatLng) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
};

const getSupportedServiceCity = (lat: number | null, lng: number | null) => {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return SERVICE_CITY_CENTERS.find((center) => distanceKm({ lat, lng }, center) <= center.radiusKm) || null;
};

type AddressModalProps = {
  open: boolean;
  onClose: () => void;
  editAddress?: GearUpAddress | null;
};

export default function AddressModal({ open, onClose, editAddress }: AddressModalProps) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const googleMapsKey = getGoogleMapsKey();
  const addresses: GearUpAddress[] = profile?.addresses || [];
  const placesHostRef = useRef<HTMLDivElement | null>(null);
  const placesServiceRef = useRef<any>(null);
  const autocompleteServiceRef = useRef<any>(null);
  const reverseLookupRef = useRef(0);
  const lastReverseLookupRef = useRef('');
  const [step, setStep] = useState<Step>('location');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [placesReady, setPlacesReady] = useState(false);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [mapCenter, setMapCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [locationError, setLocationError] = useState('');
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

  const selectedLocationReady = typeof form.lat === 'number' && typeof form.lng === 'number';
  const manualFallback = !googleMapsKey;
  const canConfirmLocation = selectedLocationReady && !locationError;
  const canSaveAddress = saving || (!manualFallback && !selectedLocationReady) || !form.houseFlat.trim();

  useEffect(() => {
    if (!open) return;
    console.log('Google Maps key loaded:', !!googleMapsKey);
    if (!googleMapsKey) {
      console.log('Google Maps script loaded:', false);
      console.log('Places service ready:', false);
    }
  }, [open, googleMapsKey]);

  useEffect(() => {
    if (!open) return;
    autocompleteServiceRef.current = null;
    placesServiceRef.current = null;
    reverseLookupRef.current = 0;
    lastReverseLookupRef.current = '';
    setPredictions([]);
    setSearchQuery('');
    setPlacesReady(false);
    setLocationError('');

    if (editAddress) {
      const lat = typeof editAddress.lat === 'number' ? editAddress.lat : null;
      const lng = typeof editAddress.lng === 'number' ? editAddress.lng : null;
      if (lat && lng) setMapCenter({ lat, lng });
      setStep('details');
      setForm({
        label: editAddress.label || 'Home',
        city: editAddress.city || profile?.city || 'Hyderabad',
        houseFlat: editAddress.houseOrBuilding || '',
        building: '',
        area: editAddress.area || '',
        landmark: editAddress.landmark || '',
        instructions: editAddress.instructions || '',
        lat,
        lng,
        formattedAddress: editAddress.formattedAddress || '',
      });
      return;
    }

    setStep(manualFallback ? 'details' : 'location');
    setMapCenter(DEFAULT_CENTER);
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
  }, [open, editAddress, profile?.city, manualFallback]);

  useEffect(() => {
    if (!open || !googleMapsKey) return;

    setMapsLoading(true);
    loadGoogleMaps()
      .then(() => {
        console.log('Google Maps script loaded:', true);
        setMapsReady(true);
      })
      .catch((err) => {
        console.log('Google Maps script loaded:', false);
        console.log('Places service ready:', false);
        console.error('Google Maps load failed', err);
        setMapsReady(false);
      })
      .finally(() => setMapsLoading(false));
  }, [open, googleMapsKey]);

  useEffect(() => {
    if (!open || !mapsReady || !placesHostRef.current) return;
    if (!window.google?.maps?.places?.AutocompleteService || !window.google?.maps?.places?.PlacesService) {
      setPlacesReady(false);
      console.log('Places service ready:', false);
      return;
    }
    autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
    placesServiceRef.current = new window.google.maps.places.PlacesService(placesHostRef.current);
    setPlacesReady(true);
    console.log('Places service ready:', true);
  }, [open, mapsReady]);

  useEffect(() => {
    if (!open || !mapsReady || editAddress || manualFallback) return;
    if (!navigator.permissions || !navigator.geolocation) return;

    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((permission) => {
        if (permission.state !== 'granted') return;
        navigator.geolocation.getCurrentPosition((position) => {
          updateLocationFromCoordinates(position.coords.latitude, position.coords.longitude, { silent: true });
        });
      })
      .catch(() => undefined);
  }, [open, mapsReady, editAddress, manualFallback]);

  useEffect(() => {
    if (!placesReady || !autocompleteServiceRef.current || searchQuery.trim().length < 2) {
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
          setPredictions(results.slice(0, 6));
        }
      );
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [placesReady, searchQuery]);

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

  const updateLocationFromCoordinates = async (
    lat: number,
    lng: number,
    options: { silent?: boolean; successMessage?: string } = {}
  ) => {
    const roundedKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    setMapCenter({ lat, lng });

    if (lastReverseLookupRef.current === roundedKey) return true;
    lastReverseLookupRef.current = roundedKey;
    const lookupId = reverseLookupRef.current + 1;
    reverseLookupRef.current = lookupId;

    const serviceCity = getSupportedServiceCity(lat, lng);
    if (!serviceCity) {
      setLocationError(OUT_OF_RANGE_MESSAGE);
      setForm((current) => ({ ...current, lat, lng, formattedAddress: '', area: '' }));
      if (!options.silent) showToast(OUT_OF_RANGE_MESSAGE, 'error');
      return false;
    }

    setLocationError('');
    const geocoded = await reverseGeocode(lat, lng);
    if (lookupId !== reverseLookupRef.current) return true;

    setForm((current) => ({
      ...current,
      lat,
      lng,
      formattedAddress: geocoded?.formattedAddress || current.formattedAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      city: serviceCity.city || geocoded?.city || current.city,
      area: geocoded?.area || current.area,
    }));
    if (options.successMessage) showToast(options.successMessage, 'success');
    return true;
  };

  const applyPlace = (place: any) => {
    const next = placeToAddressFields(place);
    const serviceCity = getSupportedServiceCity(next.lat, next.lng);
    if (!serviceCity || typeof next.lat !== 'number' || typeof next.lng !== 'number') {
      setLocationError(OUT_OF_RANGE_MESSAGE);
      showToast(OUT_OF_RANGE_MESSAGE, 'error');
      return;
    }

    setLocationError('');
    setMapCenter({ lat: next.lat, lng: next.lng });
    setForm((current) => ({
      ...current,
      formattedAddress: next.formattedAddress,
      city: serviceCity.city || next.city || current.city,
      area: next.area || current.area,
      lat: next.lat,
      lng: next.lng,
    }));
    setSearchQuery(next.formattedAddress);
    setPredictions([]);
    lastReverseLookupRef.current = `${next.lat.toFixed(5)},${next.lng.toFixed(5)}`;
  };

  const selectPrediction = (prediction: any) => {
    if (!placesServiceRef.current) {
      showToast('Places search is still loading. Try again in a moment.', 'warning');
      return;
    }

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

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast('Current location is not supported on this browser.', 'error');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const updated = await updateLocationFromCoordinates(position.coords.latitude, position.coords.longitude, {
          successMessage: 'Location detected. Confirm it on the map.',
        });
        if (!updated) setSearchQuery('');
        setLocating(false);
      },
      () => {
        showToast('Location permission denied. Search for your area instead.', 'error');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const confirmLocation = () => {
    if (!canConfirmLocation) {
      showToast(locationError || 'Choose a location on the map first.', 'error');
      return;
    }
    setStep('details');
  };

  const saveAddress = async () => {
    if (!user) return;
    const houseOrBuilding = [form.houseFlat.trim(), form.building.trim()].filter(Boolean).join(', ');
    if (!houseOrBuilding) {
      showToast('Please add your house or flat details.', 'warning');
      return;
    }
    if (!manualFallback && !selectedLocationReady) {
      showToast('Please confirm a pickup location first.', 'warning');
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
            className="relative z-10 w-full max-w-[560px] max-h-[92dvh] bg-[#121212] border border-white/10 rounded-[28px] shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
          >
            <div className="px-5 sm:px-6 py-5 flex items-center justify-between border-b border-white/5 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {step === 'details' && !manualFallback && (
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
                  <h2 className="text-[16px] font-bold text-white tracking-tight">
                    {editAddress ? 'Edit Address' : step === 'location' ? 'Select Your Location' : 'Add Address Details'}
                  </h2>
                  <p className="text-[11px] text-white/40 truncate">
                    {step === 'location' ? 'Search, use current location, or adjust the map' : 'Add house and pickup notes'}
                  </p>
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
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35 z-10" />
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for apartment, street name, landmark..."
                        disabled={mapsLoading}
                        className="w-full h-14 bg-[#0A0A0A] text-white border border-white/10 rounded-[18px] pl-12 pr-4 text-[14px] focus:border-[#A855F7] outline-none placeholder:text-white/25 disabled:opacity-60"
                      />
                    </div>

                    {googleMapsKey ? (
                      <div className="relative z-20">
                        {(loadingPredictions || predictions.length > 0 || searchQuery.trim().length >= 2) && (
                          <div className="absolute left-0 right-0 top-0 bg-[#0A0A0A] border border-white/10 rounded-[20px] overflow-hidden shadow-[0_18px_60px_rgba(0,0,0,0.65)] max-h-[230px] overflow-y-auto">
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
                              <p className="p-4 text-white/35 text-[12px]">{placesReady ? 'No places found. Try a nearby landmark.' : 'Places search is loading...'}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-[#0A0A0A] border border-white/10 rounded-[20px] p-4">
                        <p className="text-white text-[13px] font-bold">Google Maps is not configured</p>
                        <p className="text-white/45 text-[12px] mt-1">Add the address manually for now. Maps search will appear when the key is available.</p>
                        <button
                          onClick={() => setStep('details')}
                          className="mt-4 w-full bg-white/5 border border-white/10 text-white/70 font-bold py-3 rounded-[16px] text-[13px] hover:bg-white/10 transition-all"
                        >
                          Continue Manually
                        </button>
                      </div>
                    )}

                    <button
                      onClick={useCurrentLocation}
                      disabled={locating || !googleMapsKey}
                      className="w-full bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 text-[#2DD4BF] font-bold py-3.5 rounded-[18px] text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {locating ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                      {locating ? 'Detecting location...' : 'Use Current Location'}
                    </button>

                    <GoogleMapCanvas
                      mapsReady={mapsReady}
                      center={mapCenter}
                      onCenterChange={(lat, lng) => updateLocationFromCoordinates(lat, lng, { silent: true })}
                    />

                    <LocationSummary
                      loading={mapsReady && selectedLocationReady && !form.formattedAddress}
                      error={locationError}
                      area={form.area}
                      city={form.city}
                      formattedAddress={form.formattedAddress}
                    />

                    <button
                      onClick={confirmLocation}
                      disabled={!canConfirmLocation}
                      className="w-full bg-[#A855F7] text-white font-bold py-3.5 rounded-[18px] text-[13px] hover:bg-[#9333EA] transition-all disabled:opacity-50 disabled:hover:bg-[#A855F7]"
                    >
                      Confirm Location
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
                    {!manualFallback && (
                      <>
                        <MapPreview lat={form.lat} lng={form.lng} label={form.formattedAddress || 'Selected location'} />
                        <div className="bg-[#0A0A0A] border border-white/10 rounded-[20px] p-4 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] text-white/35 font-bold uppercase tracking-wider">Selected Location</p>
                            <p className="text-white text-[13px] font-semibold mt-1 leading-relaxed">{form.formattedAddress || formatAddress({ city: form.city, area: form.area })}</p>
                          </div>
                          <button
                            onClick={() => setStep('location')}
                            className="px-3 py-2 rounded-[14px] bg-white/5 border border-white/10 text-white/70 hover:text-white text-[12px] font-bold transition-all shrink-0"
                          >
                            Change
                          </button>
                        </div>
                      </>
                    )}

                    {manualFallback && (
                      <div className="bg-[#0A0A0A] border border-white/10 rounded-[20px] p-4">
                        <p className="text-white text-[13px] font-bold">Manual address</p>
                        <p className="text-white/45 text-[12px] mt-1">Google Maps key is missing, so location pin details can be added later.</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="House No. & Floor" required value={form.houseFlat} onChange={(value) => setForm({ ...form, houseFlat: value })} />
                      <Field label="Building & Block No." value={form.building} onChange={(value) => setForm({ ...form, building: value })} />
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

                    <Field label="Landmark & Area Name" value={form.landmark} onChange={(value) => setForm({ ...form, landmark: value, formattedAddress: '' })} />

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
                  disabled={canSaveAddress}
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

function GoogleMapCanvas({ mapsReady, center, onCenterChange }: { mapsReady: boolean; center: LatLng; onCenterChange: (lat: number, lng: number) => void }) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const listenerRef = useRef<any>(null);
  const onCenterChangeRef = useRef(onCenterChange);

  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);

  useEffect(() => {
    if (!mapsReady || !mapNodeRef.current || mapRef.current) return;

    mapRef.current = new window.google.maps.Map(mapNodeRef.current, {
      center,
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#171717' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#d6d6d6' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#171717' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#242424' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
      ],
    });

    listenerRef.current = mapRef.current.addListener('idle', () => {
      const nextCenter = mapRef.current?.getCenter?.();
      if (!nextCenter) return;
      onCenterChangeRef.current(nextCenter.lat(), nextCenter.lng());
    });

    return () => {
      listenerRef.current?.remove?.();
      listenerRef.current = null;
      mapRef.current = null;
    };
  }, [mapsReady]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.panTo(center);
  }, [center.lat, center.lng]);

  return (
    <div className="h-[280px] sm:h-[320px] rounded-[24px] overflow-hidden border border-white/10 bg-[#0A0A0A] relative">
      {mapsReady ? (
        <div ref={mapNodeRef} className="w-full h-full" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-8">
          <Loader2 size={24} className="text-[#A855F7] animate-spin" />
          <p className="text-white/50 text-[13px] leading-relaxed">Loading map...</p>
        </div>
      )}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pointer-events-none">
        <MapPin size={34} className="text-[#A855F7] drop-shadow-[0_0_14px_rgba(168,85,247,0.9)]" fill="#A855F7" />
      </div>
    </div>
  );
}

function LocationSummary({ loading, error, area, city, formattedAddress }: { loading: boolean; error: string; area: string; city: string; formattedAddress: string }) {
  return (
    <div className={`bg-[#0A0A0A] border rounded-[20px] p-4 ${error ? 'border-red-500/30' : 'border-white/10'}`}>
      <p className="text-[11px] text-white/35 font-bold uppercase tracking-wider">Selected Location</p>
      {error ? (
        <p className="text-red-300 text-[13px] font-semibold mt-1">{error}</p>
      ) : loading ? (
        <p className="text-white/45 text-[13px] mt-1">Finding this location...</p>
      ) : formattedAddress || area || city ? (
        <>
          <p className="text-white text-[13px] font-semibold mt-1">{area || formattedAddress || 'Pinned location'}</p>
          <p className="text-white/45 text-[12px] mt-0.5">{city || formattedAddress}</p>
        </>
      ) : (
        <p className="text-white/45 text-[13px] mt-1">Move the map or search to choose a pickup point.</p>
      )}
    </div>
  );
}

function MapPreview({ lat, lng, label }: { lat: number | null; lng: number | null; label: string }) {
  return (
    <div className="h-[150px] rounded-[22px] overflow-hidden border border-white/10 bg-[#0A0A0A] relative">
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

function Field({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">
        {label} {required && <span className="text-[#A855F7]">*</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0A0A0A] text-white border border-white/10 rounded-[14px] p-3.5 text-[13px] focus:border-[#A855F7] outline-none placeholder:text-white/25"
      />
    </div>
  );
}
