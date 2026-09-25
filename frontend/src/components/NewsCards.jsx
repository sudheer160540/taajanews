import { Box, Typography, CardActionArea, Chip } from '@mui/material';
import { PlayCircleFilled as PlayCircleFilledIcon, AccessTime as AccessTimeIcon } from '@mui/icons-material';
import { getYoutubeEmbedId } from '../utils/youtube';

export const IMAGE_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="240"%3E%3Crect fill="%23e8eef7" width="400" height="240"/%3E%3C/svg%3E';

const getCategoryName = (category, lang) => {
  if (!category?.name) return null;
  return typeof category.name === 'string' ? category.name : category.name[lang] || category.name.en;
};

/** Relative time, e.g. "4 గంటల క్రితం" / "4 hours ago" — same units as the home feed. */
const formatTimeAgo = (dateString, t) => {
  if (!dateString) return '';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return `1 ${t('minsAgo')}`;
  if (mins < 60) return `${mins} ${t('minsAgo')}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${t('hoursAgo')}`;
  const days = Math.floor(hrs / 24);
  return `${days} ${t('daysAgo')}`;
};

/** Small red pill for the article's category — used under the headline on every card. */
export const CategoryPill = ({ label, color, sx }) => {
  if (!label) return null;
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        height: 22,
        fontSize: '0.7rem',
        fontWeight: 700,
        bgcolor: color || 'secondary.main',
        color: '#fff',
        borderRadius: '4px',
        '& .MuiChip-label': { px: 1 },
        ...sx
      }}
    />
  );
};

const PlayOverlay = () => (
  <Box
    aria-hidden
    sx={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none'
    }}
  >
    <Box
      sx={{
        bgcolor: 'rgba(0,0,0,0.55)',
        borderRadius: '50%',
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <PlayCircleFilledIcon sx={{ fontSize: 26, color: 'white' }} />
    </Box>
  </Box>
);

/**
 * Standard news card: square thumbnail on the left, bold two-line headline
 * on the right, category pill on its own row underneath. This is the card
 * used everywhere articles are listed as a grid (home feed, category pages,
 * related stories) — modeled on navadishadaily.com's listing cards.
 */
export const NewsGridCard = ({ article, onNavigate, lang, t }) => {
  const hasVideo = !!getYoutubeEmbedId(article.youtubeUrl);
  const imageUrl = article.featuredImage?.url || IMAGE_PLACEHOLDER;
  const categoryName = getCategoryName(article.category, lang);
  const categoryColor = article.category?.color;
  const timeAgo = t ? formatTimeAgo(article.publishedAt, t) : '';

  return (
    <CardActionArea
      onClick={() => onNavigate(article.slug)}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 1,
        p: 1.25,
        height: '100%',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: '#fff',
        textAlign: 'left',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.25, width: '100%' }}>
        <Box sx={{ position: 'relative', width: 96, height: 76, flexShrink: 0, borderRadius: 1, overflow: 'hidden' }}>
          <Box
            component="img"
            src={imageUrl}
            alt={article.title}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {hasVideo && <PlayOverlay />}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0, flex: 1 }}>
          <Typography
            variant="subtitle2"
            fontWeight={700}
            sx={{
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              color: 'text.primary'
            }}
          >
            {article.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <CategoryPill label={categoryName} color={categoryColor} />
            {timeAgo && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  {timeAgo}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </CardActionArea>
  );
};

/**
 * "More News" rail for the article page — a red header bar followed by a
 * plain, compact headline list (no thumbnails), matching the reference
 * site's sidebar. Sticky on desktop, sits below the story on mobile.
 */
export const MoreNewsRail = ({ articles, onNavigate, title }) => {
  if (!articles?.length) return null;

  return (
    <Box
      sx={{
        borderRadius: 1,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: '#fff'
      }}
    >
      <Box sx={{ bgcolor: 'secondary.main', px: 2, py: 1.1 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#fff', letterSpacing: 0.3 }}>
          {title}
        </Typography>
      </Box>
      <Box>
        {articles.map((article, index) => (
          <Box
            key={article._id}
            onClick={() => onNavigate(article.slug)}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              px: 2,
              py: 1.1,
              cursor: 'pointer',
              borderBottom: index < articles.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
              '&:hover .more-news-title': { color: 'primary.main' }
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                bgcolor: 'secondary.main',
                mt: 0.9,
                flexShrink: 0
              }}
            />
            <Typography
              className="more-news-title"
              variant="body2"
              sx={{
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                color: 'text.primary'
              }}
            >
              {article.title}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
