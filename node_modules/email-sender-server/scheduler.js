import { getDb } from './database.js';
import { getTransporter, sendEmail, preWarmConnection } from './emailService.js';

// SSE clients listening for real-time updates
let sseClients = [];

// In-memory state of the active scheduled task
export let activeTask = {
  id: null,
  recipient: '',
  subject: '',
  body: '',
  isHtml: false,
  scheduledTime: null, // milliseconds epoch
  status: 'idle', // 'idle', 'scheduled', 'pre-warming', 'sending', 'completed', 'cancelled'
  accounts: {} // email -> { email, status, startTime, sentTime, duration, response, error }
};

// Timer handles
let preWarmTimer = null;
let executeTimer = null;
let serverTimeCron = null;

/**
 * Registers an SSE client connection.
 */
export function addSseClient(res) {
  sseClients.push(res);
  
  // Send current active task state immediately upon connection
  sendToClient(res, 'init', activeTask);

  // If there's no server time cron running and we have clients, start it
  if (!serverTimeCron && sseClients.length > 0) {
    serverTimeCron = setInterval(() => {
      broadcast('time', {
        serverTime: Date.now()
      });
    }, 1000);
  }
}

/**
 * Removes an SSE client connection.
 */
export function removeSseClient(res) {
  sseClients = sseClients.filter(client => client !== res);
  if (sseClients.length === 0 && serverTimeCron) {
    clearInterval(serverTimeCron);
    serverTimeCron = null;
  }
}

/**
 * Broadcasts an event to all SSE clients.
 */
function broadcast(event, data) {
  sseClients.forEach(client => {
    sendToClient(client, event, data);
  });
}

/**
 * Helper to write SSE formatted data to a client stream.
 */
function sendToClient(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Resets the in-memory task state.
 */
export function resetActiveTask() {
  activeTask = {
    id: null,
    recipient: '',
    subject: '',
    body: '',
    isHtml: false,
    scheduledTime: null,
    status: 'idle',
    accounts: {}
  };
  broadcast('update', activeTask);
}

/**
 * Updates an account's live status and broadcasts the change.
 */
function updateAccountStatus(email, status, extra = {}) {
  if (activeTask.accounts[email]) {
    activeTask.accounts[email] = {
      ...activeTask.accounts[email],
      status,
      ...extra
    };
  } else {
    activeTask.accounts[email] = {
      email,
      status,
      startTime: null,
      sentTime: null,
      duration: null,
      response: null,
      error: null,
      ...extra
    };
  }
  broadcast('account_update', { email, data: activeTask.accounts[email] });
}

/**
 * Cancels any active timers and resets schedule.
 */
export async function cancelActiveSchedule() {
  if (preWarmTimer) {
    clearTimeout(preWarmTimer);
    preWarmTimer = null;
  }
  if (executeTimer) {
    clearTimeout(executeTimer);
    executeTimer = null;
  }

  if (activeTask.id) {
    const db = await getDb();
    await db.run(
      "UPDATE scheduled_tasks SET status = 'cancelled' WHERE id = ?",
      [activeTask.id]
    );
    activeTask.status = 'cancelled';
    broadcast('update', activeTask);
  }

  resetActiveTask();
}

/**
 * Initializes and schedules a task.
 */
export async function scheduleTask(task) {
  // Cancel existing schedule first
  await cancelActiveSchedule();

  const targetEpoch = new Date(task.scheduled_time).getTime();
  const now = Date.now();
  const delay = targetEpoch - now;

  if (delay <= 0) {
    throw new Error("Scheduled time must be in the future");
  }

  const db = await getDb();
  const accounts = await db.all("SELECT * FROM smtp_accounts WHERE enabled = 1 AND verification_status = 'Active'");
  
  if (accounts.length === 0) {
    throw new Error("No verified SMTP accounts available to schedule sending.");
  }

  activeTask = {
    id: task.id,
    recipient: task.recipient,
    subject: task.subject,
    body: task.body,
    isHtml: task.is_html === 1 || task.is_html === true,
    scheduledTime: targetEpoch,
    status: 'scheduled',
    accounts: {}
  };

  // Populate accounts in activeTask
  accounts.forEach(acc => {
    activeTask.accounts[acc.email] = {
      email: acc.email,
      status: 'Queued',
      startTime: null,
      sentTime: null,
      duration: null,
      response: null,
      error: null
    };
  });

  broadcast('update', activeTask);

  // 1. Schedule Pre-Warming (20 seconds before sending, or immediately if delay is less)
  const preWarmDelay = Math.max(0, delay - 20000);
  preWarmTimer = setTimeout(async () => {
    activeTask.status = 'pre-warming';
    broadcast('update', activeTask);
    
    // Warm connections in parallel
    const warmPromises = accounts.map(async (acc) => {
      updateAccountStatus(acc.email, 'Connecting', { response: 'Pre-warming socket...' });
      const res = await preWarmConnection(acc);
      if (res.success) {
        updateAccountStatus(acc.email, 'Queued', { response: 'Socket warmed & ready' });
      } else {
        updateAccountStatus(acc.email, 'Failed', { error: `Pre-warm failed: ${res.error}` });
      }
    });
    
    await Promise.all(warmPromises);
  }, preWarmDelay);

  // 2. High-Precision Sending Trigger
  // Schedule a coarse timeout 5ms before the exact time to transition to high-precision spin wait
  const executeDelay = delay - 5;
  if (executeDelay > 0) {
    executeTimer = setTimeout(() => {
      preciseWaitAndSend(targetEpoch);
    }, executeDelay);
  } else {
    // If delay is extremely short, enter precision loop immediately
    preciseWaitAndSend(targetEpoch);
  }
}

/**
 * Enters a high-frequency loop to execute at the exact millisecond.
 */
function preciseWaitAndSend(targetTime) {
  const checkTime = () => {
    const now = Date.now();
    if (now >= targetTime) {
      executeSend();
    } else if (targetTime - now > 2) {
      // If we have more than 2ms, release the CPU for 1ms
      setTimeout(checkTime, 1);
    } else {
      // Within 2ms, spin-wait as fast as possible to avoid scheduling latency
      setImmediate(checkTime);
    }
  };
  checkTime();
}

/**
 * Immediately executes the sending of emails across all SMTP accounts in parallel.
 */
export async function executeSend(manual = false) {
  // If we are already sending, don't execute again
  if (activeTask.status === 'sending') return;

  const now = Date.now();
  
  if (manual) {
    // For immediate send, prepare activeTask details
    const db = await getDb();
    const accounts = await db.all("SELECT * FROM smtp_accounts WHERE enabled = 1 AND verification_status = 'Active'");
    
    if (accounts.length === 0) {
      broadcast('error', { message: 'No verified SMTP accounts to send from.' });
      return;
    }

    activeTask.scheduledTime = now;
    activeTask.status = 'sending';
    activeTask.accounts = {};
    accounts.forEach(acc => {
      activeTask.accounts[acc.email] = {
        email: acc.email,
        status: 'Queued',
        startTime: null,
        sentTime: null,
        duration: null,
        response: null,
        error: null
      };
    });
  } else {
    activeTask.status = 'sending';
  }

  broadcast('update', activeTask);

  const db = await getDb();
  
  // Fetch active SMTP accounts
  const accounts = await db.all("SELECT * FROM smtp_accounts WHERE enabled = 1 AND verification_status = 'Active'");
  
  // Format target schedule ISO time for log entries
  const scheduledTimeStr = activeTask.scheduledTime 
    ? new Date(activeTask.scheduledTime).toISOString() 
    : new Date(now).toISOString();

  // Create individual send operations running in parallel
  const sendPromises = accounts.map(async (acc) => {
    const startTime = Date.now();
    const startTimeStr = new Date(startTime).toISOString();
    
    updateAccountStatus(acc.email, 'Sending', { 
      startTime: startTimeStr,
      response: 'Sending email data...'
    });

    try {
      const info = await sendEmail({
        account: acc,
        recipient: activeTask.recipient,
        subject: activeTask.subject,
        body: activeTask.body,
        isHtml: activeTask.isHtml
      });

      const endTime = Date.now();
      const endTimeStr = new Date(endTime).toISOString();
      const duration = endTime - startTime;

      updateAccountStatus(acc.email, 'Sent', {
        sentTime: endTimeStr,
        duration,
        response: info.response || 'OK'
      });

      // Log success to Database
      await db.run(`
        INSERT INTO send_logs (
          task_id, sender_email, recipient, status, scheduled_time, 
          start_time, end_time, duration, smtp_response
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        activeTask.id, acc.email, activeTask.recipient, 'SUCCESS', 
        scheduledTimeStr, startTimeStr, endTimeStr, duration, info.response || 'OK'
      ]);

    } catch (err) {
      const endTime = Date.now();
      const endTimeStr = new Date(endTime).toISOString();
      const duration = endTime - startTime;

      updateAccountStatus(acc.email, 'Failed', {
        sentTime: endTimeStr,
        duration,
        error: err.message
      });

      // Log failure to Database
      await db.run(`
        INSERT INTO send_logs (
          task_id, sender_email, recipient, status, scheduled_time, 
          start_time, end_time, duration, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        activeTask.id, acc.email, activeTask.recipient, 'FAILED', 
        scheduledTimeStr, startTimeStr, endTimeStr, duration, err.message
      ]);
    }
  });

  // Wait for all send requests to complete
  await Promise.all(sendPromises);

  // Mark task as completed
  activeTask.status = 'completed';
  broadcast('update', activeTask);

  if (activeTask.id) {
    await db.run(
      "UPDATE scheduled_tasks SET status = 'completed' WHERE id = ?",
      [activeTask.id]
    );
  }

  // Retrieve fresh logs for the client
  const freshLogs = await db.all("SELECT * FROM send_logs ORDER BY id DESC LIMIT ?", [accounts.length]);
  
  // Calculate sending stats
  let totalSent = 0;
  let totalFailed = 0;
  let totalDuration = 0;
  let fastest = Infinity;
  let slowest = -Infinity;
  let successfulCount = 0;

  freshLogs.forEach(log => {
    if (log.status === 'SUCCESS') {
      totalSent++;
      successfulCount++;
      totalDuration += log.duration;
      if (log.duration < fastest) fastest = log.duration;
      if (log.duration > slowest) slowest = log.duration;
    } else {
      totalFailed++;
    }
  });

  const stats = {
    totalSent,
    totalFailed,
    averageSendTime: successfulCount > 0 ? Math.round(totalDuration / successfulCount) : 0,
    fastestSendTime: fastest === Infinity ? 0 : fastest,
    slowestSendTime: slowest === -Infinity ? 0 : slowest
  };

  broadcast('task_complete', { logs: freshLogs, stats });
  
  // Reset after completed task
  preWarmTimer = null;
  executeTimer = null;
}
