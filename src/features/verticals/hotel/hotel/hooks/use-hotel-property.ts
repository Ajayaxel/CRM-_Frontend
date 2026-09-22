'use client';

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';
import { api } from '@/lib/api';

export interface HotelCategory {
  id: string; name: string; description: string | null;
  basePriceInr: number; capacity: number;
}

export interface HotelPropertyRow {
  id: string; name: string; description: string | null; address: string | null;
  starRating: number; roomCount: number; categories: HotelCategory[];
}

/**
 * Which property the console is looking at.
 *
 * Only the SELECTION lives here. The list of properties a user may operate is
 * server truth — `GET /hotel/properties` returns exactly the ones their roster
 * and permissions allow — so the store never invents an id and cannot widen
 * anyone's access by holding a stale one.
 */
interface PropertyState {
  selectedId: string | null;
  select: (id: string | null) => void;
}

const KEY = 'bmn.hotel.propertyId';

export const useHotelPropertyStore = create<PropertyState>((set) => ({
  selectedId: typeof window === 'undefined' ? null : window.localStorage.getItem(KEY),
  select: (id) => {
    if (typeof window !== 'undefined') {
      if (id) window.localStorage.setItem(KEY, id);
      else window.localStorage.removeItem(KEY);
    }
    set({ selectedId: id });
  },
}));

/**
 * The property context every hospitality screen reads.
 *
 * This exists because four screens shipped with `const propertyId =
 * 'mock-property'` hardcoded in them — a literal that matched nothing, so the
 * calls returned empty and the dashboards looked merely quiet rather than
 * broken. A receptionist rostered onto one building never chooses: `properties`
 * comes back with one row and `propertyId` is it. A group manager gets the
 * list and picks, and the pick survives a reload.
 */
export function useHotelProperty() {
  const { selectedId, select } = useHotelPropertyStore();

  const { data: properties = [], isLoading, error } = useQuery<HotelPropertyRow[]>({
    queryKey: ['hotel-properties'],
    queryFn: async () => (await api.get('/hotel/properties')).data,
    staleTime: 60_000,
  });

  // Settle the selection against what the server actually allows. A stored id
  // for a property the user has since been un-rostered from must not survive.
  const resolvedId = useMemo(() => {
    if (properties.length === 0) return null;
    if (selectedId && properties.some((p) => p.id === selectedId)) return selectedId;
    return properties[0].id;
  }, [properties, selectedId]);

  useEffect(() => {
    if (resolvedId && resolvedId !== selectedId) select(resolvedId);
  }, [resolvedId, selectedId, select]);

  const property = properties.find((p) => p.id === resolvedId) ?? null;

  return {
    properties,
    property,
    propertyId: resolvedId,
    categories: property?.categories ?? [],
    /** More than one property to operate — the only case that needs a picker. */
    needsPicker: properties.length > 1,
    /** No property at all: a fresh tenant, or a receptionist nobody rostered. */
    isUnassigned: !isLoading && properties.length === 0,
    isLoading,
    error,
    select,
  };
}
