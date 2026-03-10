import { Box, Container, Typography, Divider, List, ListItem, ListItemText } from '@mui/material';

const Section = ({ number, title, children }) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="h6" fontWeight={700} gutterBottom sx={{ color: '#B80000' }}>
      {number}. {title}
    </Typography>
    {children}
  </Box>
);

const BulletList = ({ items }) => (
  <List dense disablePadding sx={{ pl: 2 }}>
    {items.map((item, i) => (
      <ListItem key={i} sx={{ display: 'list-item', listStyleType: 'disc', pl: 0, py: 0.3 }}>
        <ListItemText primary={item} primaryTypographyProps={{ variant: 'body2' }} />
      </ListItem>
    ))}
  </List>
);

const TermsAndConditions = () => {
  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h4" fontWeight={800} gutterBottom align="center" sx={{ color: '#B80000' }}>
        TAAJA NEWS – TERMS &amp; CONDITIONS
      </Typography>
      <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
        Updated: 09/03/2026
      </Typography>
      <Divider sx={{ my: 3 }} />

      <Section number={1} title="Acceptance of Terms">
        <Typography variant="body2">
          By downloading, installing, or using Taaja News, you agree to comply with and be bound by these Terms &amp; Conditions. If you do not agree, please do not use the application.
        </Typography>
      </Section>

      <Section number={2} title="Nature of Service">
        <Typography variant="body2">
          Taaja News provides short-format news summaries. While AI tools may assist in data collection, all news is reviewed by human editors. We collect news from Government websites, press notes, and journalistic sources. Local news is contributed by our Reporters/Community Reporters; their names or sources will be disclosed. The respective writer/reporter bears responsibility for their specific reports. Taaja News is a private platform and not an official government entity.
        </Typography>
      </Section>

      <Section number={3} title="User Conduct">
        <Typography variant="body2" gutterBottom>Users agree:</Typography>
        <BulletList items={[
          'Not to misuse the platform or attempt unauthorized access.',
          'Not to copy, reproduce, or redistribute content for commercial purposes without written permission.',
          'Not to use the platform to spread misinformation or engage in illegal activities.'
        ]} />
      </Section>

      <Section number={4} title="Intellectual Property Rights">
        <Typography variant="body2">
          All content, including text, design, graphics, logos, and layout, is the property of Taaja News. Unauthorized use, including removing watermarks or branding from shared content, is strictly prohibited.
        </Typography>
      </Section>

      <Section number={5} title="Accuracy & Journalistic Ethics">
        <Typography variant="body2">
          We strive for 100% accuracy and adhere to journalistic ethics. However, Taaja News does not guarantee the absolute completeness or real-time accuracy of every report. News is provided "as is" for informational purposes.
        </Typography>
      </Section>

      <Section number={6} title="Limitation of Liability">
        <Typography variant="body2">
          Taaja News, its management, or editors shall not be liable for any direct or indirect loss, financial damages, or reputational harm arising from the use of the app or reliance on its content.
        </Typography>
      </Section>

      <Section number={7} title="Content Modification">
        <Typography variant="body2">
          We reserve the right to edit, remove, or update any news story or suspend user access at any time without prior notice for editorial or legal reasons.
        </Typography>
      </Section>

      <Section number={8} title="Grievance Redressal">
        <Typography variant="body2" gutterBottom>
          In compliance with Indian IT Rules, any complaints regarding content should be directed to our Grievance Officer at:{' '}
          <Box component="a" href="mailto:taajanews.net@gmail.com" sx={{ color: '#B80000', fontWeight: 600 }}>
            taajanews.net@gmail.com
          </Box>
        </Typography>
        <Typography variant="body2">
          Upon receiving a formal complaint, we will investigate the matter thoroughly. If the complaint is found to be valid and justified, we reserve the right to unconditionally modify the content or remove it entirely from the platform to ensure accuracy and compliance with our editorial standards.
        </Typography>
      </Section>

      <Section number={9} title="Governing Law & Jurisdiction">
        <Typography variant="body2">
          These Terms shall be governed by the laws of India. Any disputes are subject to the exclusive jurisdiction of the courts in Hyderabad, Telangana, India.
        </Typography>
      </Section>

      <Section number={10} title="Governing Version Clause">
        <Typography variant="body2">
          In case of any discrepancy between translated versions, the English version shall prevail.
        </Typography>
      </Section>
    </Container>
  );
};

export default TermsAndConditions;
