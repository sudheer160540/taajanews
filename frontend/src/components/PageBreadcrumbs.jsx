import { Link as RouterLink } from 'react-router-dom';
import { Breadcrumbs, Link, Typography } from '@mui/material';
import { NavigateNext as NavNextIcon } from '@mui/icons-material';

/**
 * Resolve a breadcrumb label. API often localizes `name` to a plain string.
 */
export const getBreadcrumbLabel = (item, lang = 'en') => {
  if (!item?.name) return '';
  if (typeof item.name === 'string') return item.name.trim();
  if (typeof item.name === 'object') {
    return String(
      item.name[lang] || item.name.en || item.name.te || Object.values(item.name)[0] || ''
    ).trim();
  }
  return '';
};

/**
 * Keep only crumbs with a real slug + visible label (no empty "Home > >" gaps).
 */
export const filterValidBreadcrumbs = (items, lang = 'en') => {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.slug) return false;
    const label = getBreadcrumbLabel(item, lang);
    if (!label) return false;
    const key = String(item.slug);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Accumulating category trail breadcrumb: Home > A > B > C
 * @param {Function} [onCrumbClick] - (item) => void; if provided, used instead of plain Link nav
 * @param {Function} [onHomeClick] - () => void; optional home handler
 */
const PageBreadcrumbs = ({
  items = [],
  lang = 'en',
  homeLabel = 'Home',
  sx,
  onCrumbClick,
  onHomeClick
}) => {
  const crumbs = filterValidBreadcrumbs(items, lang);

  if (crumbs.length === 0) {
    return null;
  }

  return (
    <Breadcrumbs
      separator={<NavNextIcon fontSize="small" />}
      aria-label="Breadcrumb"
      sx={{ mb: 2, ...sx }}
    >
      {onHomeClick ? (
        <Link
          component="button"
          type="button"
          underline="hover"
          color="inherit"
          onClick={onHomeClick}
          sx={{
            textDecoration: 'none',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            font: 'inherit',
            padding: 0
          }}
        >
          {homeLabel}
        </Link>
      ) : (
        <Link
          component={RouterLink}
          to="/"
          underline="hover"
          color="inherit"
          sx={{ textDecoration: 'none' }}
        >
          {homeLabel}
        </Link>
      )}
      {crumbs.map((item, index) => {
        const label = getBreadcrumbLabel(item, lang);
        const isLast = index === crumbs.length - 1;

        if (isLast) {
          return (
            <Typography key={`${item.slug}-${index}`} color="text.primary" fontWeight={600}>
              {label}
            </Typography>
          );
        }

        if (onCrumbClick) {
          return (
            <Link
              key={`${item.slug}-${index}`}
              component="button"
              type="button"
              underline="hover"
              color="inherit"
              onClick={() => onCrumbClick(item)}
              sx={{
                textDecoration: 'none',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                font: 'inherit',
                padding: 0
              }}
            >
              {label}
            </Link>
          );
        }

        return (
          <Link
            key={`${item.slug}-${index}`}
            component={RouterLink}
            to={`/category/${item.slug}`}
            underline="hover"
            color="inherit"
            sx={{ textDecoration: 'none' }}
          >
            {label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
};

export default PageBreadcrumbs;
