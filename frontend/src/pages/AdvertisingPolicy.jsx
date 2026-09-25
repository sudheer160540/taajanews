import { Box, Container, Typography, Divider, List, ListItem, ListItemText, Link } from '@mui/material';

const Section = ({ number, title, children }) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: 'secondary.main' }}>
      {number}. {title}
    </Typography>
    {children}
  </Box>
);

const SubSection = ({ title, children }) => (
  <Box sx={{ mb: 2 }}>
    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
      {title}
    </Typography>
    {children}
  </Box>
);

const BulletList = ({ items }) => (
  <List dense disablePadding sx={{ pl: 2 }}>
    {items.map((item, i) => (
      <ListItem key={i} sx={{ display: 'list-item', listStyleType: 'disc', pl: 0, py: 0.3 }}>
        <ListItemText
          primary={typeof item === 'object' ? <><strong>{item.bold}</strong>{item.rest}</> : item}
          primaryTypographyProps={{ variant: 'body2' }}
        />
      </ListItem>
    ))}
  </List>
);

const AdvertisingPolicy = () => {
  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h4" fontWeight={800} gutterBottom align="center" sx={{ color: 'secondary.main' }}>
        TAAJA NEWS – ADVERTISING & REVENUE POLICY
      </Typography>
      <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
        Updated: 12 April 2026
      </Typography>
      <Divider sx={{ my: 3 }} />

      {/* Third-Party Content & Live Streaming Disclaimer */}
      <Section number="" title="Third-Party Content & Live Streaming Disclaimer">
        <Typography variant="body2" paragraph>
          The live TV channels and videos displayed in this app are sourced directly from YouTube
          using standard public embedding methods. All copyrights, trademarks, and content ownership
          belong solely to the respective channels and content creators. "TAAJA NEWS" does not host,
          upload, or claim ownership of any third-party broadcasts.
        </Typography>
        <Typography variant="body2" paragraph>
          If any channel owner wishes to remove their live stream link from our platform, we will
          remove it immediately, unconditionally. The respective management may contact us in this
          regard at our official email:{' '}
          <Link href="mailto:taajanews.net@gmail.com" underline="hover">
            taajanews.net@gmail.com
          </Link>
          , phone: 9849486750.
        </Typography>
      </Section>

      <Typography variant="body2" paragraph>
        For the TAAJA NEWS App, advertising and revenue generation are not the primary priorities.
        We explicitly state that this application is not created primarily for affiliate marketing
        or advertising revenue.
      </Typography>
      <Typography variant="body2" paragraph sx={{ mb: 3 }}>
        Our primary commitment is to provide high-quality, professional, and reliable news coverage
        to our audience. Disseminating timely and accurate news remains the platform's core mission,
        and editorial integrity always takes precedence over commercial considerations.
      </Typography>

      {/* 1. Departmental Independence */}
      <Section number={1} title="Departmental Independence – Separation of Responsibilities">
        <Typography variant="body2" paragraph>
          To ensure unbiased and independent reporting, TAAJA NEWS maintains a strict separation
          between its Editorial Department and Advertising Department.
        </Typography>

        <SubSection title="Zero Influence">
          <Typography variant="body2" paragraph>
            The Advertising Department operates independently and has no influence, control, or
            decision-making authority over editorial matters, including story selection, news
            coverage, reporting, or publication decisions.
          </Typography>
        </SubSection>

        <SubSection title="Editorial Integrity">
          <Typography variant="body2" paragraph>
            Our journalists and editors work independently of commercial interests. Advertisers,
            sponsors, or other commercial partners cannot dictate, preview, alter, or otherwise
            influence news content published on the TAAJA NEWS platform.
          </Typography>
        </SubSection>
      </Section>

      {/* 2. Advertising Standards */}
      <Section number={2} title="Advertising Standards">
        <SubSection title="News-First Approach">
          <Typography variant="body2" paragraph>
            TAAJA NEWS ensures that news content is never overshadowed or compromised by
            advertising. The user experience is designed to support seamless news consumption
            without intrusive advertising interruptions.
          </Typography>
        </SubSection>

        <SubSection title="Transparency and Distinction">
          <Typography variant="body2" paragraph>
            We maintain a clear and visible distinction between editorial news content and
            promotional material. All advertisements and sponsored or promotional content are
            clearly labeled to prevent confusion with original news articles.
          </Typography>
        </SubSection>

        <SubSection title="Compliance">
          <Typography variant="body2" paragraph>
            TAAJA NEWS follows applicable Google Play News policies and other relevant platform
            requirements, while prioritizing public-interest journalism over advertising
            objectives. Editorial integrity always takes precedence over commercial
            considerations.
          </Typography>
        </SubSection>
      </Section>

      {/* 3. Feedback & Reader's Voice */}
      <Section number={3} title="Feedback & Reader's Voice">
        <SubSection title="Your Voice Matters">
          <Typography variant="body2" paragraph>
            At TAAJA NEWS, we believe in transparent and accountable journalism. We highly value
            feedback from our readers, as it helps us improve our services and maintain the
            integrity of our news coverage.
          </Typography>
          <Typography variant="body2" paragraph>
            Your suggestions, news tips, feedback, and critiques are important to our growth as a
            responsible news organization.
          </Typography>
        </SubSection>

        <SubSection title="Reporting Errors & Corrections">
          <Typography variant="body2" paragraph>
            If you identify any factual errors, typographical errors, inaccuracies, or concerns
            regarding bias in our stories, please bring them to our attention promptly.
          </Typography>
          <Typography variant="body2" paragraph>
            We have a dedicated process to review such concerns and, where appropriate, issue
            corrections or updates promptly. Your vigilance helps us remain committed to accuracy
            and ensures that our audience receives verified and reliable information.
          </Typography>
        </SubSection>

        <SubSection title="Contact for Feedback">
          <BulletList items={[
            { bold: 'Email: ', rest: <Link href="mailto:support@taajanews.net" underline="hover">support@taajanews.net</Link> },
            { bold: 'Phone: ', rest: '7207205910' },
          ]} />
        </SubSection>
      </Section>

      {/* 4. Grievance Redressal */}
      <Section number={4} title="Grievance Redressal">
        <Typography variant="body2" paragraph>
          For complaints, grievances, or concerns regarding our content, services, or policies,
          please contact us using the details below:
        </Typography>
        <BulletList items={[
          { bold: 'Email: ', rest: <Link href="mailto:grievance@taajanews.net" underline="hover">grievance@taajanews.net</Link> },
          { bold: 'Phone: ', rest: '9849486750' },
        ]} />
      </Section>
    </Container>
  );
};

export default AdvertisingPolicy;
