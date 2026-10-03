// Google Analytics (GA4) + AdSense loader. Both are optional: nothing is
// loaded unless the matching env var is set.
//   VITE_GA_MEASUREMENT_ID   e.g. G-XXXXXXXXXX
//   VITE_ADSENSE_CLIENT      e.g. ca-pub-1234567890123456

export const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';
export const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT || '';

// Dashboard / auth screens are internal — never track or show ads there.
const isPrivatePath = (pathname = '') =>
  pathname.startsWith('/dashboard') ||
  pathname.startsWith('/auth') ||
  pathname.startsWith('/onboarding');

const addScript = (src, attrs = {}) => {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const el = document.createElement('script');
  el.async = true;
  el.src = src;
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  document.head.appendChild(el);
};

let gaLoaded = false;

export const loadGoogleAnalytics = () => {
  if (!GA_ID || gaLoaded || typeof window === 'undefined') return;
  gaLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments); // eslint-disable-line prefer-rest-params
  };
  window.gtag('js', new Date());
  // SPA: page views are sent manually on every route change.
  window.gtag('config', GA_ID, { send_page_view: false });
  addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`);
};

export const loadAdSense = () => {
  if (!ADSENSE_CLIENT || typeof window === 'undefined') return;
  addScript(
    `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`,
    { crossorigin: 'anonymous' }
  );
};

export const trackPageView = (pathname, search = '') => {
  if (!GA_ID || typeof window === 'undefined' || !window.gtag) return;
  if (isPrivatePath(pathname)) return;
  window.gtag('event', 'page_view', {
    page_path: pathname + search,
    page_location: window.location.href
    // page_title omitted: gtag reads document.title at send time
  });
};

export const shouldShowAds = (pathname) => Boolean(ADSENSE_CLIENT) && !isPrivatePath(pathname);
