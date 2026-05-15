import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../api/client";
import { useAuth } from "../auth/AuthContext";

const CMP_MAX = 3;

export function useSavedListings() {
  const { token } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) {
      setFavoriteIds([]);
      setCompareIds([]);
      setReady(true);
      return;
    }
    try {
      const [fav, cmp] = await Promise.all([
        apiGet<string[]>("/api/me/favorites/ids"),
        apiGet<string[]>("/api/me/compare/ids"),
      ]);
      setFavoriteIds(fav);
      setCompareIds(cmp);
    } catch {
      setFavoriteIds([]);
      setCompareIds([]);
    } finally {
      setReady(true);
    }
  }, [token]);

  useEffect(() => {
    setReady(false);
    void refresh();
  }, [refresh]);

  const toggleFavorite = useCallback(
    async (listingId: string): Promise<boolean> => {
      if (!token) return false;
      const data = await apiPost<{ active: boolean }>(
        `/api/listings/${listingId}/favorite`,
        {}
      );
      setFavoriteIds((prev) => {
        if (data.active) return [...new Set([...prev, listingId])];
        return prev.filter((id) => id !== listingId);
      });
      return data.active;
    },
    [token]
  );

  const toggleCompare = useCallback(
    async (listingId: string): Promise<boolean | "limit"> => {
      if (!token) return false;
      try {
        const data = await apiPost<{ active: boolean }>(
          `/api/listings/${listingId}/compare`,
          {}
        );
        setCompareIds((prev) => {
          if (data.active) return [...new Set([...prev, listingId])];
          return prev.filter((id) => id !== listingId);
        });
        return data.active;
      } catch (e) {
        const err = e as { status?: number; message?: string };
        if (err.status === 400) return "limit";
        throw e;
      }
    },
    [token]
  );

  return {
    ready,
    favoriteIds,
    compareIds,
    compareMax: CMP_MAX,
    isFavorite: (id: string) => favoriteIds.includes(id),
    isCompared: (id: string) => compareIds.includes(id),
    refresh,
    toggleFavorite,
    toggleCompare,
  };
}
