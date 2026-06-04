import nodemailer from 'nodemailer';

// Cache for active transporters to maintain persistent connections
const transporterCache = new Map();

/**
 * Retrieves a cached transporter or creates a new pooled transporter.
 */
export function getTransporter(account, forceRecreate = false) {
  const cacheKey = account.email;
  
  if (!forceRecreate && transporterCache.has(cacheKey)) {
    return transporterCache.get(cacheKey);
  }

  // Close old transporter if we are recreating
  if (transporterCache.has(cacheKey)) {
    closeTransporter(cacheKey);
  }

  const isSecure = account.secure === 1 || account.secure === true;

  const config = {
    host: account.host,
    port: parseInt(account.port, 10),
    secure: isSecure,
    auth: {
      user: account.username,
      pass: account.password
    },
    // Pool configuration to optimize latency and enable connection pre-warming
    pool: true,
    maxConnections: 1, // 1 connection per account is ideal since each sends exactly 1 message
    maxMessages: Infinity,
    connectionTimeout: 10000, // 10 seconds timeout
    greetingTimeout: 10000,
    socketTimeout: 15000
  };

  const transporter = nodemailer.createTransport(config);
  transporterCache.set(cacheKey, transporter);
  return transporter;
}

/**
 * Closes and removes a cached transporter.
 */
export function closeTransporter(email) {
  if (transporterCache.has(email)) {
    try {
      const transporter = transporterCache.get(email);
      transporter.close();
    } catch (err) {
      console.error(`Error closing transporter for ${email}:`, err);
    }
    transporterCache.delete(email);
  }
}

/**
 * Verifies credentials and pre-warms the SMTP connection.
 * Pre-warming forces Nodemailer to establish the TCP/TLS socket handshake
 * and cache the active socket in the connection pool.
 */
export async function preWarmConnection(account) {
  const transporter = getTransporter(account);
  return new Promise((resolve) => {
    transporter.verify((error) => {
      if (error) {
        resolve({
          email: account.email,
          success: false,
          error: error.message
        });
      } else {
        resolve({
          email: account.email,
          success: true
        });
      }
    });
  });
}

/**
 * Sends a single email using a pooled transporter.
 */
export async function sendEmail({ account, recipient, subject, body, isHtml }) {
  const transporter = getTransporter(account);
  const mailOptions = {
    from: `"${account.account_name || account.email}" <${account.email}>`,
    to: recipient,
    subject: subject,
    [isHtml ? 'html' : 'text']: body
  };

  return transporter.sendMail(mailOptions);
}
