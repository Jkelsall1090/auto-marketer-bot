import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'https://esm.sh/@react-email/components@0.0.22'
import React from 'https://esm.sh/react@18.3.1'

interface MarketingEmailProps {
  previewText?: string
  headline: string
  content: string
  ctaText?: string
  ctaUrl?: string
  productName?: string
  logoUrl?: string
  brandColor?: string
  footerText?: string
}

export const MarketingEmail = ({
  previewText = "Check out what's new",
  headline,
  content,
  ctaText = "Learn More",
  ctaUrl = "#",
  productName = "Our Product",
  logoUrl,
  brandColor = "#6366f1",
  footerText = "You're receiving this because you signed up for updates.",
}: MarketingEmailProps) => (
  <Html>
    <Head />
    <Preview>{previewText}</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <Section style={header}>
          {logoUrl ? (
            <Img src={logoUrl} width="120" height="40" alt={productName} style={logo} />
          ) : (
            <Text style={logoText}>{productName}</Text>
          )}
        </Section>

        {/* Hero Section */}
        <Section style={heroSection}>
          <Heading style={h1}>{headline}</Heading>
        </Section>

        {/* Content */}
        <Section style={contentSection}>
          {content.split('\n\n').map((paragraph, index) => (
            <Text key={index} style={text}>
              {paragraph}
            </Text>
          ))}
        </Section>

        {/* CTA Button */}
        {ctaUrl && ctaUrl !== "#" && (
          <Section style={ctaSection}>
            <Button style={{ ...button, backgroundColor: brandColor }} href={ctaUrl}>
              {ctaText}
            </Button>
          </Section>
        )}

        <Hr style={hr} />

        {/* Footer */}
        <Section style={footer}>
          <Text style={footerTextStyle}>{footerText}</Text>
          <Text style={footerLinks}>
            <Link href="#" style={link}>Unsubscribe</Link>
            {' • '}
            <Link href="#" style={link}>Privacy Policy</Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MarketingEmail

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0',
  maxWidth: '600px',
  borderRadius: '8px',
  overflow: 'hidden' as const,
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
}

const header = {
  padding: '32px 40px 24px',
  textAlign: 'center' as const,
}

const logo = {
  margin: '0 auto',
}

const logoText = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#1a1a2e',
  margin: '0',
}

const heroSection = {
  padding: '0 40px 24px',
  textAlign: 'center' as const,
}

const h1 = {
  color: '#1a1a2e',
  fontSize: '28px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0',
}

const contentSection = {
  padding: '0 40px 32px',
}

const text = {
  color: '#4a5568',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

const ctaSection = {
  padding: '0 40px 40px',
  textAlign: 'center' as const,
}

const button = {
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
}

const hr = {
  borderColor: '#e2e8f0',
  margin: '0 40px',
}

const footer = {
  padding: '24px 40px 32px',
  textAlign: 'center' as const,
}

const footerTextStyle = {
  color: '#718096',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '0 0 8px',
}

const footerLinks = {
  color: '#718096',
  fontSize: '13px',
  margin: '0',
}

const link = {
  color: '#6366f1',
  textDecoration: 'underline',
}
