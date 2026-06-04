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
 * Subscribes to the live sending status stream via Server-Sent Events (SSE).
 */
export function subscribeToStatus(handlers) {
  const eventSource = new EventSource(`${API_BASE}/status`);

  const eventTypes = ['init', 'update', 'account_update', 'task_complete', 'time', 'error'];
  
  eventTypes.forEach(type => {
    if (handlers[type]) {
      eventSource.addEventListener(type, (event) => {
        try {
          const data = JSON.parse(event.data);
          handlers[type](data);
        } catch (err) {
          console.error(`Error parsing SSE data for type ${type}:`, err);
        }
      });
    }
  });

  return () => {
    eventSource.close();
  };
}
