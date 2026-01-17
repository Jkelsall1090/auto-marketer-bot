import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from 'https://esm.sh/@react-email/components@0.0.22'
import React from 'https://esm.sh/react@18.3.1'

interface NewsletterSection {
  title: string
  content: string
  linkUrl?: string
  linkText?: string
}

interface NewsletterEmailProps {
  previewText?: string
  issueNumber?: string
  date?: string
  headline: string
  introContent: string
  sections?: NewsletterSection[]
  productName?: string
  logoUrl?: string
  brandColor?: string
}

export const NewsletterEmail = ({
  previewText = "Your weekly digest",
  issueNumber = "01",
  date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  headline,
  introContent,
  sections = [],
  productName = "Newsletter",
  logoUrl,
  brandColor = "#6366f1",
}: NewsletterEmailProps) => (
  <Html>
    <Head />
    <Preview>{previewText}</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <Section style={header}>
          <Row>
            <Column>
              {logoUrl ? (
                <Img src={logoUrl} width="100" height="32" alt={productName} />
              ) : (
                <Text style={logoText}>{productName}</Text>
              )}
            </Column>
            <Column align="right">
              <Text style={issueText}>Issue #{issueNumber}</Text>
            </Column>
          </Row>
        </Section>

        {/* Date Bar */}
        <Section style={{ ...dateBar, backgroundColor: brandColor }}>
          <Text style={dateText}>{date}</Text>
        </Section>

        {/* Main Headline */}
        <Section style={heroSection}>
          <Heading style={h1}>{headline}</Heading>
          <Text style={introText}>{introContent}</Text>
        </Section>

        <Hr style={hr} />

        {/* Content Sections */}
        {sections.length > 0 ? (
          sections.map((section, index) => (
            <Section key={index} style={articleSection}>
              <Heading as="h2" style={h2}>{section.title}</Heading>
              <Text style={text}>{section.content}</Text>
              {section.linkUrl && (
                <Link href={section.linkUrl} style={{ ...readMore, color: brandColor }}>
                  {section.linkText || 'Read more →'}
                </Link>
              )}
              {index < sections.length - 1 && <Hr style={sectionHr} />}
            </Section>
          ))
        ) : (
          <Section style={articleSection}>
            <Text style={text}>
              {introContent}
            </Text>
          </Section>
        )}

        <Hr style={hr} />

        {/* Footer */}
        <Section style={footer}>
          <Text style={footerText}>
            You're receiving this newsletter because you subscribed.
          </Text>
          <Text style={footerLinks}>
            <Link href="#" style={link}>Unsubscribe</Link>
            {' • '}
            <Link href="#" style={link}>View in browser</Link>
            {' • '}
            <Link href="#" style={link}>Forward to a friend</Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default NewsletterEmail

const main = {
  backgroundColor: '#f0f4f8',
  fontFamily: 'Georgia, "Times New Roman", serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  maxWidth: '600px',
  borderRadius: '0',
  overflow: 'hidden' as const,
}

const header = {
  padding: '24px 32px',
  borderBottom: '1px solid #e2e8f0',
}

const logoText = {
  fontSize: '20px',
  fontWeight: '700',
  color: '#1a1a2e',
  margin: '0',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const issueText = {
  fontSize: '13px',
  color: '#718096',
  margin: '0',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const dateBar = {
  padding: '12px 32px',
  textAlign: 'center' as const,
}

const dateText = {
  color: '#ffffff',
  fontSize: '12px',
  fontWeight: '600',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
  margin: '0',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const heroSection = {
  padding: '40px 32px 32px',
}

const h1 = {
  color: '#1a1a2e',
  fontSize: '32px',
  fontWeight: '700',
  lineHeight: '1.2',
  margin: '0 0 20px',
}

const introText = {
  color: '#4a5568',
  fontSize: '18px',
  lineHeight: '1.7',
  margin: '0',
}

const hr = {
  borderColor: '#e2e8f0',
  margin: '0 32px',
}

const sectionHr = {
  borderColor: '#e2e8f0',
  margin: '24px 0',
}

const articleSection = {
  padding: '32px',
}

const h2 = {
  color: '#1a1a2e',
  fontSize: '22px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 16px',
}

const text = {
  color: '#4a5568',
  fontSize: '16px',
  lineHeight: '1.7',
  margin: '0 0 16px',
}

const readMore = {
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const footer = {
  padding: '32px',
  textAlign: 'center' as const,
  backgroundColor: '#f7fafc',
}

const footerText = {
  color: '#718096',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '0 0 12px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const footerLinks = {
  color: '#718096',
  fontSize: '13px',
  margin: '0',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const link = {
  color: '#6366f1',
  textDecoration: 'underline',
}
