import { Box } from '@mui/material';

/**
 * Optimized image for mobile: lazy-loads below-the-fold images,
 * keeps aspect ratio, and avoids blocking the main thread.
 */
const LazyImage = ({
  src,
  alt = '',
  eager = false,
  sx = {},
  ...rest
}) => (
  <Box
    component="img"
    src={src}
    alt={alt}
    loading={eager ? 'eager' : 'lazy'}
    decoding="async"
    fetchPriority={eager ? 'high' : 'low'}
    sx={{
      display: 'block',
      maxWidth: '100%',
      ...sx
    }}
    {...rest}
  />
);

export default LazyImage;
