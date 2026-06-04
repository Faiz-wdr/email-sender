const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // SMTP Accounts
  getAccounts: () => request('/accounts'),
  addAccount: (data) => request('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id, data) => request(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: (id) => request(`/accounts/${id}`, { method: 'DELETE' }),
  importAccounts: (csvText) => request('/accounts/import', { method: 'POST', body: JSON.stringify({ csvText }) }),
  verifyAccounts: () => request('/accounts/verify', { method: 'POST' }),
  verifyAccountSingle: (id) => request(`/accounts/verify/${id}`, { method: 'POST' }),
  testConnection: (data) => request('/accounts/test', { method: 'POST', body: JSON.stringify(data) }),

  // Templates
  getTemplates: () => request('/templates'),
  saveTemplate: (data) => request('/templates', { method: 'POST', body: JSON.stringify(data) }),
  deleteTemplate: (id) => request(`/templates/${id}`, { method: 'DELETE' }),

  // Sending Actions
  sendTest: (data) => request('/send/test', { method: 'POST', body: JSON.stringify(data) }),
  sendNow: (data) => request('/send/now', { method: 'POST', body: JSON.stringify(data) }),
  scheduleTask: (data) => request('/schedule/create', { method: 'POST', body: JSON.stringify(data) }),
  cancelSchedule: () => request('/schedule/cancel', { method: 'POST' }),

  // Historical Logs
  getLogs: () => request('/logs'),

  // System Time
  getServerTime: () => request('/server-time'),
};

/**
 * Subscribes to the live sending status stream via Server-Sent Events (SSE),
 * with an automatic fallback to HTTP polling if connection fails (e.g., in serverless environments).
 */
export function subscribeToStatus(handlers) {
  let eventSource = null;
  let pollInterval = null;
  let isClosed = false;
  let activeTaskId = null;
  let lastLogsCount = 0;

  // Initialize last logs count for tracking increments
  fetch(`${API_BASE}/logs`)
    .then(r => r.json())
    .then(logs => { lastLogsCount = logs.length; })
    .catch(() => {});

  const startPolling = () => {
    if (pollInterval || isClosed) return;
    console.log("Starting HTTP status polling fallback...");

    const pollFunc = async () => {
      if (isClosed) return;
      try {
        const response = await fetch(`${API_BASE}/status/snapshot`);
        if (!response.ok) throw new Error("Status snapshot fetch failed");
        const statusData = await response.json();
        
        if (handlers.init && activeTaskId === null) {
          handlers.init(statusData);
          activeTaskId = statusData.id || -1;
        } else if (handlers.update) {
          handlers.update(statusData);
        }

        if (statusData.accounts && handlers.account_update) {
          Object.keys(statusData.accounts).forEach(email => {
            handlers.account_update({ email, data: statusData.accounts[email] });
          });
        }

        if (statusData.status === 'completed' || statusData.status === 'idle') {
          const logsResponse = await fetch(`${API_BASE}/logs`);
          if (logsResponse.ok) {
            const logsData = await logsResponse.json();
            if (logsData.length > lastLogsCount) {
              const freshLogs = logsData.slice(0, logsData.length - lastLogsCount);
              lastLogsCount = logsData.length;
              
              if (handlers.task_complete) {
                const totalSent = freshLogs.filter(l => l.status === 'SUCCESS').length;
                const totalFailed = freshLogs.filter(l => l.status === 'FAILED').length;
                handlers.task_complete({
                  logs: freshLogs,
                  stats: {
                    totalSent,
                    totalFailed,
                    averageSendTime: 0,
                    fastestSendTime: 0,
                    slowestSendTime: 0
                  }
                });
              }
            }
          }
        }
      } catch (err) {
        if (handlers.error) {
          handlers.error({ message: `Polling error: ${err.message}` });
        }
      }
    };

    pollFunc();
    pollInterval = setInterval(pollFunc, 2000);
  };

  try {
    eventSource = new EventSource(`${API_BASE}/status`);

    const eventTypes = ['init', 'update', 'account_update', 'task_complete', 'time', 'error'];
    
    eventTypes.forEach(type => {
      if (handlers[type]) {
        eventSource.addEventListener(type, (event) => {
          try {
            const data = JSON.parse(event.data);
            handlers[type](data);
            if (type === 'init') {
              activeTaskId = data.id || -1;
            }
          } catch (err) {
            console.error(`Error parsing SSE data for type ${type}:`, err);
          }
        });
      }
    });

    eventSource.onerror = () => {
      // If Vercel/lambda or SSE fails, switch to polling
      eventSource.close();
      startPolling();
    };

  } catch (e) {
    startPolling();
  }

  return () => {
    isClosed = true;
    if (eventSource) eventSource.close();
    if (pollInterval) clearInterval(pollInterval);
  };
}
