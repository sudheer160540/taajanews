import { Box, Typography, Grid, Link, Divider, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const footerLinks = [
  { label: 'Terms & Conditions', path: '/terms' },
  { label: 'Editorial Policy', path: '/editorial-policy' },
  { label: 'About Us', path: '/about' },
  { label: 'Contact Us', href: 'mailto:taajanews.net@gmail.com' },
];

const Footer = () => {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: '#1a1a1a',
        color: 'white',
        mt: 'auto',
      }}
    >
      {/* Red brand bar — mirrors BBC header style */}
      <Box sx={{ bgcolor: '#B80000', py: 1.5, px: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            component="img"
            src="/logo.png"
            alt="Taaja News"
            sx={{ width: 36, height: 36, borderRadius: '4px', objectFit: 'cover' }}
          />
          <Typography variant="h6" fontWeight={900} letterSpacing={1} sx={{ color: 'white' }}>
            TAAJA NEWS
          </Typography>
        </Box>
      </Box>

      {/* Links grid */}
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Grid container spacing={1}>
          {footerLinks.map((item) => (
            <Grid item xs={6} sm={3} key={item.label}>
              {item.href ? (
                <Link
                  href={item.href}
                  underline="hover"
                  sx={{
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    display: 'block',
                    py: 0.5,
                    '&:hover': { color: '#fff' },
                  }}
                >
                  {item.label}
                </Link>
              ) : (
                <Link
                  component="button"
                  underline="hover"
                  onClick={() => navigate(item.path)}
                  sx={{
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    display: 'block',
                    py: 0.5,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    '&:hover': { color: '#fff' },
                  }}
                >
                  {item.label}
                </Link>
              )}
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)', my: 2 }} />

        {/* Copyright */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
            © {year} Taaja News. All rights reserved.
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>
            Taaja News is a private platform and not an official government entity.{' '}
            <Link
              component="button"
              underline="hover"
              onClick={() => navigate('/terms')}
              sx={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: 'inherit',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontStyle: 'italic',
                '&:hover': { color: '#fff' },
              }}
            >
              Learn about our linking policy.
            </Link>
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
