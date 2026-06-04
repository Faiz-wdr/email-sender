/**
 * Auto-detects SMTP configuration parameters based on the email domain name.
 * Supports Gmail, Outlook/Hotmail, and Yahoo. Custom domains default to empty values.
 */
export function detectSmtpSettings(email) {
  if (!email || !email.includes('@')) {
    return {
      provider: 'custom',
      host: '',
      port: 587,
      secure: false
    };
  }

  const domain = email.split('@')[1].toLowerCase();

  if (domain === 'gmail.com') {
    return {
      provider: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true
    };
  }

  if (
    domain === 'outlook.com' ||
    domain === 'hotmail.com' ||
    domain === 'live.com' ||
    domain === 'msn.com' ||
    domain.endsWith('.outlook.com')
  ) {
    return {
      provider: 'outlook',
      host: 'smtp.office365.com',
      port: 587,
      secure: false // Nodemailer will negotiate STARTTLS
    };
  }

  if (
    domain === 'yahoo.com' ||
    domain === 'ymail.com' ||
    domain === 'rocketmail.com' ||
    domain.endsWith('.yahoo.com')
  ) {
    return {
      provider: 'yahoo',
      host: 'smtp.mail.yahoo.com',
      port: 465,
      secure: true
    };
  }

  return {
    provider: 'custom',
    host: '',
    port: 587,
    secure: false
  };
}
