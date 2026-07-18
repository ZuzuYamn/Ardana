import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MapPin, Search, Loader2, Crosshair } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LocationSuggestion {
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  label: string;
}

interface LocationPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function LocationPicker({ value, onChange, placeholder, disabled, className }: LocationPickerProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/weather/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(t('weather.search_failed'));
      const data: LocationSuggestion[] = await res.json();
      setSuggestions(data);
      setShowDropdown(data.length > 0);
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchInput = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    searchTimeout.current = setTimeout(() => {
      void fetchSuggestions(q);
    }, 350);
  }, [fetchSuggestions]);

  const handleSelect = useCallback((loc: LocationSuggestion) => {
    onChange(loc.label);
    setSearchQuery('');
    setSuggestions([]);
    setShowDropdown(false);
  }, [onChange]);

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast({
        title: t('weather.location_unavailable'),
        description: t('weather.location_error'),
        variant: 'destructive',
      });
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(`/api/weather/geocode?q=${latitude},${longitude}`);
          if (!res.ok) throw new Error(t('weather.reverse_geocode_failed'));
          const data: LocationSuggestion[] = await res.json();
          if (data.length === 0) throw new Error(t('weather.no_results'));
          const loc = data[0];
          onChange(loc.label);
          toast({
            title: t('weather.location_saved'),
            description: t('weather.location_detected'),
          });
        } catch {
          toast({
            title: t('weather.location_unavailable'),
            description: t('weather.location_error'),
            variant: 'destructive',
          });
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (error) => {
        setIsDetectingLocation(false);
        let description = t('weather.location_error');
        if (error.code === error.PERMISSION_DENIED) {
          description = t('weather.location_permission_denied');
        } else if (error.code === error.TIMEOUT) {
          description = t('weather.location_timeout');
        }
        toast({
          title: t('weather.location_unavailable'),
          description,
          variant: 'destructive',
        });
      }
    );
  }, [onChange, t, toast]);

  return (
    <div ref={containerRef} className={cn('space-y-2', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            handleSearchInput(e.target.value);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          placeholder={placeholder ?? t('plant_new.location_field_placeholder')}
          disabled={disabled}
          className="pl-9"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}

        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
            {suggestions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                {t('plant_new.location_no_results')}
              </div>
            ) : (
              suggestions.map((loc, i) => (
                <button
                  key={`${loc.lat}-${loc.lon}-${i}`}
                  type="button"
                  className="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-2 text-sm"
                  onClick={() => handleSelect(loc)}
                >
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{loc.label}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground hover:text-primary"
        onClick={handleUseCurrentLocation}
        disabled={isDetectingLocation || disabled}
      >
        {isDetectingLocation ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('plant_new.location_detecting')}
          </>
        ) : (
          <>
            <Crosshair className="mr-2 h-4 w-4" />
            {t('plant_new.use_current_location')}
          </>
        )}
      </Button>
    </div>
  );
}
