import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'https://esm.sh/@react-email/components@0.0.22'
import React from 'https://esm.sh/react@18.3.1'

interface OutreachEmailProps {
  previewText?: string
  recipientName?: string
  senderName: string
  senderTitle?: string
  senderCompany?: string
  content: string
  calendlyUrl?: string
  linkedInUrl?: string
  websiteUrl?: string
  signature?: string
}

export const OutreachEmail = ({
  previewText = "Quick question for you",
  recipientName = "there",
  senderName,
  senderTitle,
  senderCompany,
  content,
  calendlyUrl,
  linkedInUrl,
  websiteUrl,
  signature,
}: OutreachEmailProps) => (
  <Html>
    <Head />
    <Preview>{previewText}</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Email Content */}
        <Section style={contentSection}>
          <Text style={greeting}>Hi {recipientName},</Text>
          
          {content.split('\n\n').map((paragraph, index) => (
            <Text key={index} style={text}>
              {paragraph}
            </Text>
          ))}

          {/* Meeting Link */}
          {calendlyUrl && (
            <Text style={text}>
              If you're interested, feel free to{' '}
              <Link href={calendlyUrl} style={link}>grab a time on my calendar</Link>
              {' '}that works for you.
            </Text>
          )}

          <Text style={signoff}>Best,</Text>
          
          {/* Signature Block */}
          <Section style={signatureBlock}>
            <Text style={sigName}>{senderName}</Text>
            {senderTitle && (
              <Text style={sigTitle}>{senderTitle}{senderCompany ? ` at ${senderCompany}` : ''}</Text>
            )}
            {(linkedInUrl || websiteUrl) && (
              <Text style={sigLinks}>
                {linkedInUrl && (
                  <Link href={linkedInUrl} style={sigLink}>LinkedIn</Link>
                )}
                {linkedInUrl && websiteUrl && ' • '}
                {websiteUrl && (
                  <Link href={websiteUrl} style={sigLink}>Website</Link>
                )}
              </Text>
            )}
          </Section>
        </Section>

        <Hr style={hr} />

        {/* Minimal Footer */}
        <Section style={footer}>
          <Text style={footerText}>
            Not interested?{' '}
            <Link href="#" style={footerLink}>Let me know</Link>
            {' '}and I won't reach out again.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default OutreachEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
}

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '560px',
}

const contentSection = {
  padding: '0',
}

const greeting = {
  color: '#1a1a2e',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 20px',
}

const text = {
  color: '#374151',
  fontSize: '15px',
  lineHeight: '1.7',
  margin: '0 0 16px',
}

const link = {
  color: '#2563eb',
  textDecoration: 'underline',
}

const signoff = {
  color: '#374151',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '24px 0 4px',
}

const signatureBlock = {
  marginTop: '4px',
}

const sigName = {
  color: '#1a1a2e',
  fontSize: '15px',
  fontWeight: '600',
  margin: '0',
}

const sigTitle = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '2px 0 0',
}

const sigLinks = {
  margin: '8px 0 0',
}

const sigLink = {
  color: '#6b7280',
  fontSize: '13px',
  textDecoration: 'none',
}

const hr = {
  borderColor: '#e5e7eb',
  margin: '32px 0 16px',
}

const footer = {
  padding: '0',
}

const footerText = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0',
}

const footerLink = {
  color: '#9ca3af',
  textDecoration: 'underline',
}
