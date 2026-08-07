import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'taaja_category_trail_v1';

const CategoryTrailContext = createContext(null);

const loadTrail = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.slug === 'string' && item.slug);
  } catch {
    return [];
  }
};

const persistTrail = (trail) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trail));
  } catch {
    /* ignore quota / private mode */
  }
};

/**
 * Accumulating category breadcrumb trail:
 * Home > CatA > CatB > CatC …
 * Previous selections stay when a new category is chosen.
 */
export const CategoryTrailProvider = ({ children }) => {
  const [trail, setTrail] = useState(loadTrail);

  const commit = useCallback((next) => {
    setTrail(next);
    persistTrail(next);
  }, []);

  const clearTrail = useCallback(() => {
    commit([]);
  }, [commit]);

  /**
   * Push a category onto the trail.
   * - If it is already the last item, refresh its label only.
   * - If it exists earlier, truncate to that point (re-select / breadcrumb click).
   * - Otherwise append (keeps all previously selected categories).
   */
  const pushCategory = useCallback((item) => {
    if (!item?.slug) return;

    const entry = {
      _id: item._id || item.slug,
      slug: item.slug,
      name: typeof item.name === 'string' ? item.name : item.name || item.slug
    };

    setTrail((prev) => {
      const existingIdx = prev.findIndex((c) => c.slug === entry.slug);
      let next;

      if (existingIdx >= 0) {
        next = [
          ...prev.slice(0, existingIdx),
          { ...prev[existingIdx], ...entry, name: entry.name || prev[existingIdx].name }
        ];
      } else {
        const last = prev[prev.length - 1];
        if (last?.slug === entry.slug) {
          next = [...prev.slice(0, -1), { ...last, ...entry }];
        } else {
          next = [...prev, entry];
        }
      }

      persistTrail(next);
      return next;
    });
  }, []);

  /** Truncate trail through the clicked crumb (inclusive), then navigate separately. */
  const truncateToSlug = useCallback((slug) => {
    if (!slug) return;
    setTrail((prev) => {
      const idx = prev.findIndex((c) => c.slug === slug);
      if (idx < 0) return prev;
      const next = prev.slice(0, idx + 1);
      persistTrail(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      trail,
      pushCategory,
      truncateToSlug,
      clearTrail
    }),
    [trail, pushCategory, truncateToSlug, clearTrail]
  );

  return (
    <CategoryTrailContext.Provider value={value}>
      {children}
    </CategoryTrailContext.Provider>
  );
};

export const useCategoryTrail = () => {
  const ctx = useContext(CategoryTrailContext);
  if (!ctx) {
    throw new Error('useCategoryTrail must be used within CategoryTrailProvider');
  }
  return ctx;
};
