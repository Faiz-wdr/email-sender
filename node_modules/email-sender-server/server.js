import express from 'express';
import cors from 'cors';
import { getDb } from './database.js';
import { detectSmtpSettings } from './smtp_helper.js';
import { closeTransporter, preWarmConnection, sendEmail } from './emailService.js';
import {
  scheduleTask,
  cancelActiveSchedule,
  executeSend,
  addSseClient,
  removeSseClient,
  activeTask
} from './scheduler.js';

const app = express();
const PORT = process.env.PORT || 5995;

app.use(cors());
app.use(express.json());

// Path rewrite middleware for Vercel deployment
app.use((req, res, next) => {
  if (req.url && req.url.startsWith('/api')) {
    req.url = req.url.replace(/^\/api/, '');
  }
  next();
});

// Initialize Database on startup
getDb().catch(err => {
  console.error("Failed to initialize database:", err);
});

// ==========================================
// 1. SYSTEM TIME & STATUS STREAM (SSE)
// ==========================================

// Server-Sent Events (SSE) endpoint for real-time status updates
app.get('/status', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  addSseClient(res);

  req.on('close', () => {
    removeSseClient(res);
  });
});

// Returns current server epoch time
app.get('/server-time', (req, res) => {
  res.json({ serverTime: Date.now() });
});

// Get current state snapshot
app.get('/status/snapshot', (req, res) => {
  res.json(activeTask);
});

// ==========================================
// 2. SMTP ACCOUNTS ENDPOINTS
// ==========================================

// Get all SMTP accounts
app.get('/accounts', async (req, res) => {
  try {
    const db = await getDb();
    const accounts = await db.all("SELECT * FROM smtp_accounts ORDER BY id DESC");
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test SMTP connection properties before saving
app.post('/accounts/test', async (req, res) => {
  const { email, host, port, username, password, secure } = req.body;
  if (!email || !host || !port || !username || !password) {
    return res.status(400).json({ error: "Email, host, port, username, and password are required." });
  }

  try {
    const isSecure = secure === true || secure === 1 || secure === 'true';
    const tempAccount = {
      email,
      host,
      port: parseInt(port, 10),
      username,
      password,
      secure: isSecure ? 1 : 0
    };

    // Force recreate transporter for email to prevent cached validation
    closeTransporter(email);

    const check = await preWarmConnection(tempAccount);
    if (check.success) {
      res.json({ success: true, message: "✓ SMTP Connection Successful" });
    } else {
      res.json({ 
        success: false, 
        message: "✗ Authentication Failed", 
        error: check.error || "Authentication failed." 
      });
    }
  } catch (error) {
    res.json({ 
      success: false, 
      message: "✗ SMTP Connection Failed", 
      error: error.message 
    });
  }
});

// Add SMTP account manually
app.post('/accounts', async (req, res) => {
  const { account_name, email, host, port, username, password, secure, enabled } = req.body;
  if (!account_name || !email || !host || !port || !username || !password) {
    return res.status(400).json({ error: "Missing required fields. Account Name, Email, Host, Port, Username, and Password are required." });
  }

  try {
    const db = await getDb();
    const secureInt = secure ? 1 : 0;
    const enabledInt = enabled !== undefined ? (enabled ? 1 : 0) : 1;

    await db.run(`
      INSERT INTO smtp_accounts (account_name, email, host, port, username, password, secure, enabled, verification_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unverified')
    `, [account_name, email, host, parseInt(port, 10), username, password, secureInt, enabledInt]);

    const newAccount = await db.get("SELECT * FROM smtp_accounts WHERE email = ?", [email]);
    res.status(201).json(newAccount);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: "An account with this email already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update SMTP account
app.put('/accounts/:id', async (req, res) => {
  const { id } = req.params;
  const { account_name, email, host, port, username, password, secure, enabled } = req.body;

  try {
    const db = await getDb();
    const existing = await db.get("SELECT * FROM smtp_accounts WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ error: "SMTP account not found" });
    }

    const finalName = account_name || existing.account_name;
    const finalEmail = email || existing.email;
    const finalHost = host || existing.host;
    const finalPort = port !== undefined ? parseInt(port, 10) : existing.port;
    const finalUsername = username || existing.username;
    const finalPassword = password !== undefined && password !== '' ? password : existing.password;
    const finalSecure = secure !== undefined ? (secure ? 1 : 0) : existing.secure;
    const finalEnabled = enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled;

    await db.run(`
      UPDATE smtp_accounts 
      SET account_name = ?, email = ?, host = ?, port = ?, username = ?, password = ?, secure = ?, enabled = ?, verification_status = 'unverified', error = NULL
      WHERE id = ?
    `, [finalName, finalEmail, finalHost, finalPort, finalUsername, finalPassword, finalSecure, finalEnabled, id]);

    // Close cached transport as credentials/details changed
    closeTransporter(existing.email);

    const updated = await db.get("SELECT * FROM smtp_accounts WHERE id = ?", [id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete SMTP account
app.delete('/accounts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const account = await db.get("SELECT * FROM smtp_accounts WHERE id = ?", [id]);
    if (account) {
      closeTransporter(account.email);
      await db.run("DELETE FROM smtp_accounts WHERE id = ?", [id]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import SMTP accounts via CSV text
app.post('/accounts/import', async (req, res) => {
  const { csvText } = req.body;
  if (!csvText) {
    return res.status(400).json({ error: "CSV text is required" });
  }

  try {
    const db = await getDb();
    const lines = csvText.split(/\r?\n/);
    let importedCount = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split(',');
      if (parts.length < 6) continue;

      const email = parts[0].trim();
      const host = parts[1].trim();
      const portStr = parts[2].trim();
      const username = parts[3].trim();
      const password = parts[4].trim();
      const secureStr = parts[5].trim().toLowerCase();

      // Skip header row
      if (email.toLowerCase() === 'email' || host.toLowerCase() === 'host') continue;
      if (!email.includes('@') || !host || !portStr || !username || !password) continue;

      const port = parseInt(portStr, 10);
      const secure = (secureStr === 'true' || secureStr === '1') ? 1 : 0;
      
      const account_name = email.split('@')[0] + ' (' + host + ')';

      await db.run(`
        INSERT INTO smtp_accounts (account_name, email, host, port, username, password, secure, enabled, verification_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'unverified')
        ON CONFLICT(email) DO UPDATE SET
          account_name = excluded.account_name,
          host = excluded.host,
          port = excluded.port,
          username = excluded.username,
          password = excluded.password,
          secure = excluded.secure,
          verification_status = 'unverified',
          error = NULL,
          last_verified = NULL
      `, [account_name, email, host, port, username, password, secure]);

      closeTransporter(email);
      importedCount++;
    }

    res.json({ success: true, count: importedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify credentials of a single SMTP account
app.post('/accounts/verify/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const account = await db.get("SELECT * FROM smtp_accounts WHERE id = ?", [id]);
    if (!account) {
      return res.status(404).json({ error: "SMTP account not found" });
    }

    // Force recreate transporter
    closeTransporter(account.email);

    const check = await preWarmConnection(account);
    const newStatus = check.success ? 'Active' : 'Failed Verification';
    const lastVerified = new Date().toISOString();
    const errorMsg = check.success ? null : (check.error || "Authentication failed.");

    await db.run(
      "UPDATE smtp_accounts SET verification_status = ?, error = ?, last_verified = ? WHERE id = ?",
      [newStatus, errorMsg, lastVerified, id]
    );

    const updated = await db.get("SELECT * FROM smtp_accounts WHERE id = ?", [id]);
    res.json({ success: check.success, account: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify credentials of ALL SMTP accounts (enabled only)
app.post('/accounts/verify', async (req, res) => {
  try {
    const db = await getDb();
    const accounts = await db.all("SELECT * FROM smtp_accounts WHERE enabled = 1");
    
    if (accounts.length === 0) {
      return res.json({ success: true, verified: [], message: "No enabled SMTP accounts to verify." });
    }

    const verificationResults = [];
    const batchSize = 10;
    
    for (let i = 0; i < accounts.length; i += batchSize) {
      const batch = accounts.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (acc) => {
        closeTransporter(acc.email);
        const check = await preWarmConnection(acc);
        const newStatus = check.success ? 'Active' : 'Failed Verification';
        const lastVerified = new Date().toISOString();
        const errorMsg = check.success ? null : (check.error || "Authentication failed.");

        await db.run(
          "UPDATE smtp_accounts SET verification_status = ?, error = ?, last_verified = ? WHERE id = ?",
          [newStatus, errorMsg, lastVerified, acc.id]
        );

        verificationResults.push({
          email: acc.email,
          success: check.success,
          error: errorMsg
        });
      });

      await Promise.all(batchPromises);
    }

    const updatedAccounts = await db.all("SELECT * FROM smtp_accounts ORDER BY id DESC");
    res.json({ success: true, accounts: updatedAccounts, results: verificationResults });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. EMAIL TEMPLATE ENDPOINTS
// ==========================================

// Get all templates
app.get('/templates', async (req, res) => {
  try {
    const db = await getDb();
    const templates = await db.all("SELECT * FROM email_templates ORDER BY id DESC");
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create/Update template
app.post('/templates', async (req, res) => {
  const { name, subject, body, isHtml } = req.body;
  if (!name || !subject || !body) {
    return res.status(400).json({ error: "Name, subject, and body are required" });
  }

  try {
    const db = await getDb();
    const isHtmlInt = isHtml ? 1 : 0;
    
    await db.run(`
      INSERT INTO email_templates (name, subject, body, is_html)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        subject = excluded.subject,
        body = excluded.body,
        is_html = excluded.is_html
    `, [name, subject, body, isHtmlInt]);

    const saved = await db.get("SELECT * FROM email_templates WHERE name = ?", [name]);
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete template
app.delete('/templates/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    await db.run("DELETE FROM email_templates WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. ACTION & SCHEDULER ENDPOINTS
// ==========================================

// Send Test Email using Selected Account
app.post('/send/test', async (req, res) => {
  const { accountId, testRecipient, subject, body, isHtml } = req.body;
  if (!accountId || !testRecipient || !subject || !body) {
    return res.status(400).json({ error: "Account ID, recipient, subject, and body are required." });
  }

  try {
    const db = await getDb();
    const account = await db.get("SELECT * FROM smtp_accounts WHERE id = ?", [accountId]);
    
    if (!account) {
      return res.status(404).json({ error: "SMTP Account not found" });
    }

    const result = await sendEmail({
      account,
      recipient: testRecipient,
      subject,
      body,
      isHtml
    });

    res.json({ success: true, message: "Test email sent successfully", response: result.response });
  } catch (error) {
    res.status(500).json({ error: `SMTP Send Error: ${error.message}` });
  }
});

// Immediate multi-account parallel email sending
app.post('/send/now', async (req, res) => {
  const { recipient, subject, body, isHtml } = req.body;
  if (!recipient || !subject || !body) {
    return res.status(400).json({ error: "Recipient, subject, and body are required." });
  }

  try {
    if (process.env.VERCEL) {
      // In serverless, we must await the sending before returning the response
      // to ensure the lambda executes the send logic to completion
      await executeSend(true);
      res.json({ success: true, message: "Immediate send completed successfully." });
    } else {
      executeSend(true); // manual immediate send
      res.json({ success: true, message: "Immediate send sequence initiated." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create/Schedule Send Task
app.post('/schedule/create', async (req, res) => {
  const { recipient, subject, body, isHtml, scheduledTime } = req.body;
  if (!recipient || !subject || !body || !scheduledTime) {
    return res.status(400).json({ error: "Recipient, subject, body, and scheduled time are required." });
  }

  try {
    const db = await getDb();
    const isHtmlInt = isHtml ? 1 : 0;

    // Save scheduled task to DB
    const result = await db.run(`
      INSERT INTO scheduled_tasks (recipient, subject, body, is_html, scheduled_time, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `, [recipient, subject, body, isHtmlInt, scheduledTime]);

    const taskId = result.lastID;
    const task = await db.get("SELECT * FROM scheduled_tasks WHERE id = ?", [taskId]);

    // Schedule task in-memory
    await scheduleTask(task);

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel Scheduled Send Task
app.post('/schedule/cancel', async (req, res) => {
  try {
    await cancelActiveSchedule();
    res.json({ success: true, message: "Scheduled sending task cancelled." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. SEND LOGS ENDPOINTS
// ==========================================

// Get all send logs
app.get('/logs', async (req, res) => {
  try {
    const db = await getDb();
    const logs = await db.all("SELECT * FROM send_logs ORDER BY id DESC");
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start Server
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
