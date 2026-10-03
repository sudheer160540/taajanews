import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { ADSENSE_CLIENT, shouldShowAds } from '../utils/googleTags';

/**
 * One AdSense display ad unit. Renders nothing unless AdSense is configured
 * and a slot id (from AdSense → Ads → By ad unit) is provided.
 */
const AdSlot = ({ slot, format = 'auto', minHeight = 100, sx }) => {
  const { pathname } = useLocation();
  const pushed = useRef(false);
  const enabled = Boolean(slot) && shouldShowAds(pathname);

  useEffect(() => {
    if (!enabled || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.warn('[ads] AdSense push failed:', err.message);
    }
  }, [enabled]);

  if (!enabled) return null;

  return (
    <Box sx={{ my: 2, minHeight, textAlign: 'center', overflow: 'hidden', ...sx }}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </Box>
  );
};

export default AdSlot;
