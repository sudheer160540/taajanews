import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  loadGoogleAnalytics,
  loadAdSense,
  trackPageView,
  shouldShowAds
} from '../utils/googleTags';

/** Loads Google Analytics / AdSense once and reports SPA page views. Renders nothing. */
const GoogleTags = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    loadGoogleAnalytics();
    if (shouldShowAds(pathname)) loadAdSense();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastTitle = useRef('');

  useEffect(() => {
    if (shouldShowAds(pathname)) loadAdSense();

    // Article titles arrive after the route changes, so wait for <title> to
    // change (max 2.5s) before reporting, otherwise GA logs the stale title.
    let done = false;
    const send = () => {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(timer);
      lastTitle.current = document.title;
      trackPageView(pathname, search);
    };
    const observer = new MutationObserver(() => {
      if (document.title && document.title !== lastTitle.current) send();
    });
    // <title> may be created/replaced by react-helmet, so watch the whole <head>.
    observer.observe(document.head, { childList: true, characterData: true, subtree: true });
    const timer = setTimeout(send, 2500);
    return () => {
      done = true;
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [pathname, search]);

  return null;
};

export default GoogleTags;
