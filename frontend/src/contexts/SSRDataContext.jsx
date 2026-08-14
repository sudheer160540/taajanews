import { createContext, useContext } from 'react';

/**
 * Carries data prefetched on the server (e.g. an article by slug) down to the
 * page component so the very first render — on both server and client — has
 * content. This is what makes article pages SEO-complete: the headline, body,
 * and per-article <Seo> meta are present in the initial HTML response.
 *
 * On the server, the value is injected by entry-server. On the client, it is
 * read from window.__SSR_STATE__ (serialized into the HTML by the server) so
 * hydration matches the server markup exactly.
 */
const SSRDataContext = createContext(null);

export const SSRDataProvider = ({ value, children }) => (
  <SSRDataContext.Provider value={value || null}>{children}</SSRDataContext.Provider>
);

/**
 * Returns the prefetched payload for the given key (e.g. `article:<slug>`),
 * or null when there is no server-provided data (normal client navigation).
 */
export const useSSRData = (key) => {
  const store = useContext(SSRDataContext);
  if (!store) return null;
  if (key == null) return store;
  return store[key] ?? null;
};

export default SSRDataContext;
