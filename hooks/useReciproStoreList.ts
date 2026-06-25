"use client";

import { useState, useEffect, useRef } from "react";

export type ReciproStore = { id: string; name: string };

function isStore(s: unknown): s is ReciproStore {
  return (
    typeof s === "object" &&
    s !== null &&
    typeof (s as ReciproStore).id === "string" &&
    typeof (s as ReciproStore).name === "string"
  );
}

export function useReciproStoreList({
  customerID,
  token,
  enabled,
  initialStoreId,
}: {
  customerID: string;
  token: string | null;
  enabled: boolean;
  initialStoreId: string;
}): {
  stores: ReciproStore[];
  isLoading: boolean;
  error: string | null;
  selectedStoreId: string;
  setSelectedStoreId: (id: string) => void;
} {
  const [stores, setStores] = useState<ReciproStore[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState(initialStoreId);

  const didAutoSelectRef = useRef(false);
  const initialStoreIdRef = useRef(initialStoreId);
  useEffect(() => {
    initialStoreIdRef.current = initialStoreId;
  }, [initialStoreId]);

  // Sync Firestore-loaded initialStoreId before auto-selection happens
  useEffect(() => {
    if (!didAutoSelectRef.current && initialStoreId) {
      setSelectedStoreId(initialStoreId);
    }
  }, [initialStoreId]);

  // Reset on logout
  useEffect(() => {
    if (!enabled) {
      setStores([]);
      setError(null);
      setSelectedStoreId("");
      didAutoSelectRef.current = false;
    }
  }, [enabled]);

  // Fetch store list
  useEffect(() => {
    if (!enabled || !customerID || !token) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const r = await fetch("/api/recipro/getStoreList", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ customerID }),
        });
        const data: unknown = await r.json();
        if (cancelled) return;

        const list: ReciproStore[] = Array.isArray(
          (data as { result?: unknown })?.result
        )
          ? ((data as { result: unknown[] }).result).filter(isStore)
          : [];

        setStores(list);
        didAutoSelectRef.current = true;

        if (list.length === 1) {
          setSelectedStoreId(list[0].id);
        } else if (list.length > 1) {
          const preferred = initialStoreIdRef.current;
          const match = preferred ? list.find((s) => s.id === preferred) : null;
          setSelectedStoreId(match?.id ?? list[0].id);
        }
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "店舗一覧の取得に失敗しました"
          );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, customerID, token]);

  return { stores, isLoading, error, selectedStoreId, setSelectedStoreId };
}
