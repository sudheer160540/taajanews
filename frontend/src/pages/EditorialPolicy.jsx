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
        <ListItemText
          primary={typeof item === 'object' ? <><strong>{item.bold}</strong>{item.rest}</> : item}
          primaryTypographyProps={{ variant: 'body2' }}
        />
      </ListItem>
    ))}
  </List>
);

const NumberedList = ({ items }) => (
  <List dense disablePadding sx={{ pl: 2 }}>
    {items.map((item, i) => (
      <ListItem key={i} sx={{ display: 'list-item', listStyleType: 'decimal', pl: 0, py: 0.3 }}>
        <ListItemText
          primary={typeof item === 'object' ? <><strong>{item.bold}</strong>{item.rest}</> : item}
          primaryTypographyProps={{ variant: 'body2' }}
        />
      </ListItem>
    ))}
  </List>
);

const EditorialPolicy = () => {
  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h4" fontWeight={800} gutterBottom align="center" sx={{ color: '#B80000' }}>
        TAAJA NEWS – EDITORIAL POLICY
      </Typography>
      <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
        (English Master Version) Last Updated: 09/03/2026
      </Typography>
      <Divider sx={{ my: 3 }} />

      <Section number={1} title="Editorial Core Principles">
        <Typography variant="body2">
          Taaja News is committed to the fundamental values of journalism:{' '}
          <strong>Accuracy</strong>, <strong>Neutrality</strong>, and <strong>Verification</strong>.
          Our mission is to provide reliable news summaries while maintaining a strictly professional and unbiased approach.
        </Typography>
      </Section>

      <Section number={2} title="Content Sourcing & Source Disclosure">
        <BulletList items={[
          { bold: 'National & International News: ', rest: 'Information, including photographs and multimedia from national/international agencies or government portals, is published with clear Source Disclosure. We credit the original platform to maintain transparency regarding the origin of the information.' },
          { bold: 'State & Local News: ', rest: 'These reports are directly contributed by our Field Reporters and Community Contributors.' },
          { bold: 'Official Data: ', rest: 'We rely on official press releases and announcements from Government bodies (such as PIB and I&PR) to ensure the integrity of the data provided.' },
        ]} />
      </Section>

      <Section number={3} title="Reporting Standards">
        <BulletList items={[
          { bold: '5W1H Principle: ', rest: 'Every story is structured around the Who, What, Where, When, Why, and How to ensure comprehensive coverage.' },
          { bold: 'Inverted Pyramid Style: ', rest: 'We prioritize the most critical information at the beginning of the news report.' },
          { bold: 'Concise Format: ', rest: 'We specialize in short, independent news summaries designed for quick and clear consumption.' },
        ]} />
      </Section>

      <Section number={4} title="Liability & Responsibility (Disclaimer)">
        <BulletList items={[
          { bold: 'Individual Responsibility: ', rest: 'Every local and state news report features a clear byline (Name of the Writer or Reporter). The respective reporter or source is solely responsible for the content and factual accuracy of that specific news item.' },
          { bold: 'Limitation of Liability: ', rest: 'Taaja News does not bear any direct or indirect liability for the content provided by independent reporters or external sources. We act as a platform for dissemination, and the legal responsibility rests with the original author/source.' },
        ]} />
      </Section>

      <Section number={5} title="Corrections & Fact-Verification Policy">
        <Typography variant="body2" gutterBottom>
          We are committed to correcting any inaccuracies promptly. Our process includes:
        </Typography>
        <NumberedList items={[
          { bold: 'Verification: ', rest: 'Upon receiving a complaint or feedback regarding a report, our editorial team will immediately re-verify the facts with the primary source.' },
          { bold: 'Unconditional Action: ', rest: 'If the information is found to be incorrect or misleading, we reserve the right to unconditionally modify or entirely remove the content.' },
          { bold: 'Transparency: ', rest: 'For significant factual corrections, a "Correction Note" will be added to the story to keep our readers informed.' },
        ]} />
      </Section>

      <Section number={6} title="Contact for Editorial Concerns">
        <Typography variant="body2">
          For any grievances, factual corrections, or feedback regarding our content, please contact the Editorial Desk:
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          📧 Email:{' '}
          <Box component="a" href="mailto:editor@taajanews.net" sx={{ color: '#B80000', fontWeight: 600 }}>
            editor@taajanews.net
          </Box>
        </Typography>
      </Section>
    </Container>
  );
};

export default EditorialPolicy;
