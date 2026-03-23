import {
  Box,
  Container,
  Typography,
  Divider,
  Grid,
  Card,
  CardContent,
  Button,
} from '@mui/material';
import {
  Email as EmailIcon,
  Phone as PhoneIcon,
  ReportProblem as GrievanceIcon,
  Feedback as FeedbackIcon,
  Campaign as CampaignIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const ContactUs = () => {
  const navigate = useNavigate();

  const ContactCard = ({ icon, title, items, color = '#B80000' }) => (
    <Card
      elevation={3}
      sx={{
        height: '100%',
        borderTop: `4px solid ${color}`,
        borderRadius: 2,
        transition: 'transform 0.2s',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              bgcolor: color,
              borderRadius: '50%',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Typography variant="h6" fontWeight={700} sx={{ color }}>
            {title}
          </Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        {items.map((item, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Box sx={{ color, flexShrink: 0 }}>{item.icon}</Box>
            <Box>
              {item.label && (
                <Typography variant="caption" color="text.secondary" display="block">
                  {item.label}
                </Typography>
              )}
              {item.href ? (
                <Typography
                  component="a"
                  href={item.href}
                  variant="body2"
                  fontWeight={600}
                  sx={{ color, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                  {item.value}
                </Typography>
              ) : (
                <Typography variant="body2" fontWeight={600}>
                  {item.value}
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ bgcolor: '#fafafa', minHeight: '100vh', pb: 6 }}>
      {/* Hero Banner */}
      <Box
        sx={{
          bgcolor: '#B80000',
          color: '#fff',
          py: { xs: 5, md: 7 },
          textAlign: 'center',
          px: 2,
        }}
      >
        <Typography variant="h3" fontWeight={800} gutterBottom>
          Contact Us
        </Typography>
        <Typography variant="subtitle1" sx={{ opacity: 0.85, maxWidth: 600, mx: 'auto' }}>
          We value your feedback, tips, and suggestions. Reach out to us anytime.
        </Typography>
      </Box>

      <Container maxWidth="md" sx={{ mt: -4 }}>
        {/* Intro Card */}
        <Card elevation={4} sx={{ borderRadius: 3, mb: 5, p: { xs: 2, md: 4 } }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <CampaignIcon sx={{ color: '#B80000', fontSize: 32 }} />
              <Typography variant="h5" fontWeight={700} sx={{ color: '#B80000' }}>
                Our Commitment to You
              </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.9 }}>
              At <strong>TAAJA News</strong>, we believe in transparent and accountable journalism.
              We highly value the feedback from our readers to help us improve our services and
              maintain the integrity of our news coverage. Your suggestions, tips, or critiques are
              essential to our growth as a responsible news organization.
            </Typography>

            <Box
              sx={{
                mt: 3,
                p: 2.5,
                bgcolor: '#fff5f5',
                borderLeft: '4px solid #B80000',
                borderRadius: 1,
              }}
            >
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Reporting Errors &amp; Corrections
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                If you find any factual errors, typos, or biased reporting in our stories, please
                bring it to our notice immediately. We have a dedicated process to review such claims
                and issue corrections promptly. Your vigilance helps us stay committed to the truth
                and ensures that our audience receives only verified information.
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Contact Cards */}
        <Grid container spacing={3}>
          {/* Feedback */}
          <Grid item xs={12} sm={6}>
            <ContactCard
              icon={<FeedbackIcon />}
              title="Contact for Feedback"
              color="#B80000"
              items={[
                {
                  icon: <EmailIcon fontSize="small" />,
                  label: 'Email',
                  value: 'support@taajanews.net',
                  href: 'mailto:support@taajanews.net',
                },
                {
                  icon: <PhoneIcon fontSize="small" />,
                  label: 'Phone',
                  value: '7207205910',
                  href: 'tel:7207205910',
                },
              ]}
            />
          </Grid>

          {/* Grievance */}
          <Grid item xs={12} sm={6}>
            <ContactCard
              icon={<GrievanceIcon />}
              title="Grievance Officer"
              color="#1565C0"
              items={[
                {
                  icon: <EmailIcon fontSize="small" />,
                  label: 'Email',
                  value: 'grievance@taajanews.net',
                  href: 'mailto:grievance@taajanews.net',
                },
                {
                  icon: <PhoneIcon fontSize="small" />,
                  label: 'Phone',
                  value: '9849236750',
                  href: 'tel:9849236750',
                },
              ]}
            />
          </Grid>
        </Grid>

        {/* Back Button */}
        <Box sx={{ textAlign: 'center', mt: 5 }}>
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate(-1)}
            sx={{
              borderColor: '#B80000',
              color: '#B80000',
              fontWeight: 600,
              px: 4,
              '&:hover': { bgcolor: '#B80000', color: '#fff' },
            }}
          >
            ← Go Back
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export default ContactUs;
