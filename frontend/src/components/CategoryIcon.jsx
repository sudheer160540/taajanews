import { Box } from '@mui/material';
import {
  LocationOn as LocationOnIcon,
  Category as CategoryFallbackIcon
} from '@mui/icons-material';

const MATERIAL_ICON_MAP = {
  location_on: LocationOnIcon,
  location: LocationOnIcon,
  category: CategoryFallbackIcon
};

const isImageSrc = (value) => {
  if (!value || typeof value !== 'string') return false;
  return (
    /^https?:\/\//i.test(value) ||
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(value)
  );
};

/**
 * Renders category.icon — Azure/image URL or Material icon name (e.g. location_on).
 */
const CategoryIcon = ({ icon, color, size = 20, sx = {} }) => {
  if (!icon) return null;

  if (isImageSrc(icon)) {
    return (
      <Box
        component="img"
        src={icon}
        alt=""
        loading="lazy"
        sx={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
          flexShrink: 0,
          ...sx
        }}
      />
    );
  }

  const key = icon.trim().toLowerCase();
  const IconComp = MATERIAL_ICON_MAP[key] || CategoryFallbackIcon;

  return (
    <IconComp
      sx={{
        fontSize: size,
        width: size,
        height: size,
        color: color || 'inherit',
        flexShrink: 0,
        ...sx
      }}
    />
  );
};

export default CategoryIcon;
export { isImageSrc };
