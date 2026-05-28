import { Box, Container, Typography, Divider, List, ListItem, ListItemText, Grid, Paper } from '@mui/material';
import {
  FlashOn as CrispIcon,
  Verified as EditorialIcon,
  Translate as LangIcon,
  LocationOn as LocalIcon,
  People as CommunityIcon,
  Source as SourceIcon,
  Lock as PrivacyIcon,
  FactCheck as FactIcon,
} from '@mui/icons-material';

const FeatureCard = ({ icon, title, desc }) => (
  <Paper elevation={1} sx={{ p: 2.5, height: '100%', borderTop: '3px solid', borderColor: 'secondary.main', borderRadius: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
      <Box sx={{ color: 'secondary.main' }}>{icon}</Box>
      <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
    </Box>
    <Typography variant="body2" color="text.secondary">{desc}</Typography>
  </Paper>
);

const AboutUs = () => {
  const whyFeatures = [
    {
      icon: <CrispIcon />,
      title: 'Short & Crisp',
      desc: 'Get all the essential facts of a story in just a few sentences. Perfect for your busy lifestyle.',
    },
    {
      icon: <EditorialIcon />,
      title: 'Editorial Excellence',
      desc: 'Every news story undergoes a rigorous review process by our professional editorial team to ensure accuracy, neutrality, and journalistic standards.',
    },
    {
      icon: <LangIcon />,
      title: 'Multi-Language Support',
      desc: 'Stay updated in your preferred language—English, Telugu, or Hindi.',
    },
    {
      icon: <LocalIcon />,
      title: 'Hyper-Local Coverage',
      desc: 'From global events to your local community updates, we bridge the gap with our "Global to Local" approach.',
    },
  ];

  const keyFeatures = [
    {
      icon: <CommunityIcon />,
      title: 'Socio-Economic Empowerment (Local Yellow Pages)',
      desc: 'More than just news, TAAJA News is committed to the social and economic welfare of its users. Our built-in Local Yellow Pages feature acts as a bridge for community networking. If they wish, users can choose to list their professional details to enhance their local visibility and economic opportunities. We are providing this feature free of cost to promote community growth and help local professionals connect with their audience.',
    },
    {
      icon: <SourceIcon />,
      title: 'Source Disclosure',
      desc: 'We prioritize transparency. Every local report features a clear byline (Reporter name), and official sources are explicitly disclosed for every story to maintain integrity.',
    },
    {
      icon: <PrivacyIcon />,
      title: 'Privacy First',
      desc: 'Your data security is our priority. You have full control over your profile visibility and directory listings within the app.',
    },
    {
      icon: <FactIcon />,
      title: 'Verified Sourcing',
      desc: 'We collect news from trusted sources, including Government portals (PIB, I&PR), official press notes, and our dedicated network of field reporters.',
    },
  ];

  return (
    <Box>
      {/* Hero Banner */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #4875BC 0%, #FF1424 100%)',
          color: 'white',
          py: { xs: 5, md: 8 },
          px: 2,
          textAlign: 'center',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Box
            component="img"
            src="/logo.png"
            alt="Taaja News"
            sx={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.6)' }}
          />
        </Box>
        <Typography variant="h3" fontWeight={900} gutterBottom>
          TAAJA NEWS
        </Typography>
        <Typography variant="h6" sx={{ opacity: 0.9, fontStyle: 'italic', maxWidth: 600, mx: 'auto' }}>
          "Latest short news in English, Telugu &amp; Hindi. Real-time global to local updates."
        </Typography>
      </Box>

      <Container maxWidth="md" sx={{ py: 5 }}>
        {/* About Intro */}
        <Typography variant="h5" fontWeight={800} gutterBottom sx={{ color: 'secondary.main' }}>
          Experience News Like Never Before with TAAJA News – Global to Local.
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          TAAJA News is a professional short-news platform designed for the modern reader. We deliver the most significant National, International, State, and Local news in a concise, factual, and easy-to-read format. Our mission is to keep you informed without the clutter, following the core principles of professional journalism.
        </Typography>

        <Divider sx={{ my: 4 }} />

        {/* Why TAAJA News */}
        <Typography variant="h5" fontWeight={800} gutterBottom>
          Why TAAJA News?
        </Typography>
        <Grid container spacing={2} sx={{ mb: 5 }}>
          {whyFeatures.map((f) => (
            <Grid item xs={12} sm={6} key={f.title}>
              <FeatureCard icon={f.icon} title={f.title} desc={f.desc} />
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 4 }} />

        {/* Key Features */}
        <Typography variant="h5" fontWeight={800} gutterBottom>
          Key Features
        </Typography>
        <Grid container spacing={2} sx={{ mb: 5 }}>
          {keyFeatures.map((f) => (
            <Grid item xs={12} sm={6} key={f.title}>
              <FeatureCard icon={f.icon} title={f.title} desc={f.desc} />
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 4 }} />

        {/* CTA */}
        <Box
          sx={{
            textAlign: 'center',
            py: 4,
            px: 3,
            bgcolor: '#f0f4fb',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'primary.light',
          }}
        >
          <Typography variant="h6" fontWeight={700} sx={{ color: 'secondary.main' }} gutterBottom>
            Stay ahead of the world with TAAJA News.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Download now and join the community of informed citizens.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default AboutUs;
