import { Box, Container, Typography, Divider, List, ListItem, ListItemText } from '@mui/material';

const Section = ({ number, title, children }) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: '#B80000' }}>
      {number}. {title}
    </Typography>
    {children}
  </Box>
);

const SubSection = ({ number, title, children }) => (
  <Box sx={{ mb: 2, pl: 1 }}>
    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
      {number} {title}
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

const PrivacyPolicy = () => {
  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h4" fontWeight={800} gutterBottom align="center" sx={{ color: '#B80000' }}>
        TAAJA NEWS – PRIVACY POLICY
      </Typography>
      <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
        (English Master Version) Last Updated: 16/03/2026
      </Typography>
      <Divider sx={{ my: 3 }} />

      {/* 1. Introduction */}
      <Section number={1} title="Introduction">
        <Typography variant="body2" paragraph>
          Taaja News respects the privacy of its users. This Privacy Policy explains how we collect, use,
          store, and protect your information. By downloading, installing, or using the app, you agree to
          the terms outlined in this policy.
        </Typography>

        <SubSection number="1.1" title="Information We Collect">
          <BulletList items={[
            { bold: 'Personal Information: ', rest: 'Name, email address, phone number, and professional details (optional).' },
            { bold: 'Feedback & Communication: ', rest: 'Details provided during support requests or feedback.' },
            { bold: 'Device Information: ', rest: 'Device ID, model, and operating system.' },
            { bold: 'Location Information: ', rest: 'We may access device location to provide location-based news and relevant notifications.' },
          ]} />
        </SubSection>

        <SubSection number="1.2" title="Local Yellow Pages Directory (Optional)">
          <Typography variant="body2" paragraph>
            We collect professional details and phone numbers to enhance social and economic networking opportunities.
          </Typography>
          <BulletList items={[
            { bold: 'Consent: ', rest: 'These details are included in the "Local Yellow Pages Directory" only with explicit user consent.' },
            { bold: 'Privacy Control: ', rest: 'Users can enable or disable their visibility in the directory at any time using the privacy toggle in settings. If the toggle is off, your details remain private and hidden.' },
          ]} />
        </SubSection>
      </Section>

      {/* 2. How We Use Your Information */}
      <Section number={2} title="How We Use Your Information">
        <Typography variant="body2" gutterBottom>
          We use the collected information to:
        </Typography>
        <BulletList items={[
          'Provide, maintain, and improve our services.',
          'Analyse user engagement and app stability.',
          'Send important news notifications and updates.',
          'Deliver informational content and relevant promotional material.',
          'Respond to user complaints, feedback, or support requests.',
        ]} />
      </Section>

      {/* 3. Notifications */}
      <Section number={3} title="Notifications">
        <Typography variant="body2">
          Our app sends push notifications using device identifiers to deliver real-time news updates
          and important alerts.
        </Typography>
      </Section>

      {/* 4. Data Storage and Security */}
      <Section number={4} title="Data Storage and Security">
        <Typography variant="body2">
          We implement industry-standard measures to protect your data. However, please note that
          no digital platform can guarantee 100% security.
        </Typography>
      </Section>

      {/* 5. Sharing of Information */}
      <Section number={5} title="Sharing of Information">
        <Typography variant="body2" gutterBottom>
          We do not sell, trade, or rent your personal information. Data may be shared only:
        </Typography>
        <BulletList items={[
          'To comply with legal obligations or government requests.',
          'To protect the rights, safety, and integrity of Taaja News.',
        ]} />
      </Section>

      {/* 6. User Rights & Data Control */}
      <Section number={6} title="User Rights & Data Control">
        <Typography variant="body2" gutterBottom>
          Users hold the authority to:
        </Typography>
        <BulletList items={[
          { bold: 'Delete Personal Data: ', rest: 'Erase personal information from our records at any time.' },
          { bold: 'Access Data Details: ', rest: 'Obtain details of the specific information we have collected.' },
          { bold: 'Manage Consent: ', rest: 'Withdraw consent for the Yellow Pages listing instantly via app settings.' },
          {
            bold: 'Contact: ',
            rest: 'For any privacy-related actions, email: taajanews.net@gmail.com. We will process such requests within a reasonable timeframe.',
          },
        ]} />
      </Section>

      {/* 7. Children's Privacy */}
      <Section number={7} title="Children's Privacy">
        <Typography variant="body2">
          Taaja News is not intended for children under 13 years of age. We do not knowingly collect
          personal information from children.
        </Typography>
      </Section>

      {/* 8. Third-Party Services */}
      <Section number={8} title="Third-Party Services">
        <Typography variant="body2">
          The app utilizes third-party services like Firebase Analytics to monitor performance and
          improve user experience. These services collect non-personal data according to their
          respective privacy policies.
        </Typography>
      </Section>

      {/* 9. Changes to This Policy */}
      <Section number={9} title="Changes to This Policy">
        <Typography variant="body2">
          We may update this policy periodically. Continued use of the app after updates constitutes
          acceptance of the revised terms.
        </Typography>
      </Section>

      {/* 10. Governing Version Clause */}
      <Section number={10} title="Governing Version Clause">
        <Typography variant="body2">
          In case of any ambiguity or difference in interpretation between translated versions, the
          English version shall prevail.
        </Typography>
      </Section>

      <Divider sx={{ my: 3 }} />
      <Typography variant="body2" color="text.secondary" align="center">
        For any privacy-related concerns, contact us at{' '}
        <Box component="a" href="mailto:taajanews.net@gmail.com" sx={{ color: '#B80000', fontWeight: 600 }}>
          taajanews.net@gmail.com
        </Box>
      </Typography>
    </Container>
  );
};

export default PrivacyPolicy;
