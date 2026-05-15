/** Избранное и сравнение — API (авторизован) или localStorage (гость). */

export const FAV_KEY = "af_favorites";
export const CMP_KEY = "af_compare";
export const CMP_MAX = 3;

export function getLocalIds(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

export function setLocalIds(key, ids) {
  localStorage.setItem(key, JSON.stringify([...new Set(ids)].slice(0, 50)));
}

export function createSavedStore({ getUser, api }) {
  let favoriteIds = [];
  let compareIds = [];

  function isLoggedIn() {
    return Boolean(getUser());
  }

  function isFavorite(id) {
    return favoriteIds.includes(id);
  }

  function isCompared(id) {
    return compareIds.includes(id);
  }

  async function refresh() {
    if (!isLoggedIn()) {
      favoriteIds = getLocalIds(FAV_KEY);
      compareIds = getLocalIds(CMP_KEY);
      return;
    }
    try {
      const [fav, cmp] = await Promise.all([
        api("/api/me/favorites/ids"),
        api("/api/me/compare/ids"),
      ]);
      favoriteIds = Array.isArray(fav) ? fav : [];
      compareIds = Array.isArray(cmp) ? cmp : [];
    } catch {
      favoriteIds = [];
      compareIds = [];
    }
  }

  async function toggleFavorite(id) {
    if (!isLoggedIn()) {
      const ids = getLocalIds(FAV_KEY);
      const i = ids.indexOf(id);
      if (i >= 0) ids.splice(i, 1);
      else ids.push(id);
      setLocalIds(FAV_KEY, ids);
      favoriteIds = ids;
      return ids.includes(id);
    }
    const r = await api(`/api/listings/${encodeURIComponent(id)}/favorite`, {
      method: "POST",
      body: "{}",
    });
    await refresh();
    return r.active;
  }

  async function toggleCompare(id) {
    if (!isLoggedIn()) {
      const ids = getLocalIds(CMP_KEY);
      const i = ids.indexOf(id);
      if (i >= 0) ids.splice(i, 1);
      else {
        if (ids.length >= CMP_MAX) ids.shift();
        ids.push(id);
      }
      setLocalIds(CMP_KEY, ids);
      compareIds = ids;
      return ids.includes(id);
    }
    try {
      const r = await api(`/api/listings/${encodeURIComponent(id)}/compare`, {
        method: "POST",
        body: "{}",
      });
      await refresh();
      return r.active;
    } catch (e) {
      if (e.status === 400) throw new Error("limit");
      throw e;
    }
  }

  async function loadFavoritesList() {
    if (!isLoggedIn()) {
      const ids = getLocalIds(FAV_KEY);
      const items = await Promise.all(
        ids.map((id) => api(`/api/listings/${id}`).catch(() => null))
      );
      return items.filter(Boolean);
    }
    return api("/api/me/favorites");
  }

  async function loadCompareList() {
    if (!isLoggedIn()) {
      const ids = getLocalIds(CMP_KEY);
      const items = await Promise.all(
        ids.map((id) => api(`/api/listings/${id}`).catch(() => null))
      );
      return items.filter(Boolean);
    }
    return api("/api/me/compare");
  }

  return {
    get compareCount() {
      return compareIds.length;
    },
    isFavorite,
    isCompared,
    refresh,
    toggleFavorite,
    toggleCompare,
    loadFavoritesList,
    loadCompareList,
  };
}
