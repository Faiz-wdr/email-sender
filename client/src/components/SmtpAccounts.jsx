import React, { useState } from 'react';
import { formatDateTime } from '../utils/time.js';

export default function SmtpAccounts({
  accounts,
  onAdd,
  onUpdate,
  onDelete,
  onImport,
  onVerifyAll,
  onVerifySingle,
  onTestSend,
  onOpenWizard,
  verifying
}) {
  const [showForm, setShowForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form States
  const [accountName, setAccountName] = useState('');
  const [email, setEmail] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(false);
  const [enabled, setEnabled] = useState(true);

  // CSV Paste State
  const [csvText, setCsvText] = useState('');

  // Handle Quick Presets
  const handleAddGmailPreset = () => {
    setEditingId(null);
    setAccountName('Gmail Account');
    setEmail('');
    setHost('smtp.gmail.com');
    setPort('587');
    setUsername('');
    setPassword('');
    setSecure(false);
    setEnabled(true);
    setShowForm(true);
    setShowImportForm(false);
  };

  const handleAddCustomPreset = () => {
    setEditingId(null);
    setAccountName('Custom SMTP');
    setEmail('');
    setHost('');
    setPort('587');
    setUsername('');
    setPassword('');
    setSecure(false);
    setEnabled(true);
    setShowForm(true);
    setShowImportForm(false);
  };

  const handleStartEdit = (acc) => {
    setEditingId(acc.id);
    setAccountName(acc.account_name);
    setEmail(acc.email);
    setHost(acc.host);
    setPort(acc.port.toString());
    setUsername(acc.username);
    setPassword(''); // leave blank for security
    setSecure(acc.secure === 1 || acc.secure === true);
    setEnabled(acc.enabled === 1 || acc.enabled === true);
    setShowForm(true);
    setShowImportForm(false);
  };

  // Form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!accountName.trim() || !email.trim() || !host.trim() || !port.trim() || !username.trim()) {
      alert("Please fill in all required fields.");
      return;
    }

    const payload = {
      account_name: accountName.trim(),
      email: email.trim(),
      host: host.trim(),
      port: parseInt(port, 10),
      username: username.trim(),
      password, // will not update in backend if blank during edit
      secure: secure ? 1 : 0,
      enabled: enabled ? 1 : 0
    };

    if (editingId) {
      onUpdate(editingId, payload);
    } else {
      if (!password) {
        alert("Password is required for new accounts.");
        return;
      }
      onAdd(payload);
    }

    // Reset Form
    setShowForm(false);
    setEditingId(null);
    setAccountName('');
    setEmail('');
    setHost('');
    setPort('587');
    setUsername('');
    setPassword('');
    setSecure(false);
    setEnabled(true);
  };

  // CSV paste import
  const handleCsvSubmit = (e) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    onImport(csvText);
    setCsvText('');
    setShowImportForm(false);
  };

  // CSV file upload import
  const handleCsvFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      onImport(event.target.result);
      setShowImportForm(false);
    };
    reader.readAsText(file);
  };

  // Toggle account enabled/disabled directly from list
  const handleToggleEnabled = (acc) => {
    onUpdate(acc.id, {
      ...acc,
      enabled: acc.enabled === 1 ? 0 : 1
    });
  };

  // Status Badge Builder
  const getStatusBadge = (acc) => {
    if (acc.enabled === 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-650 border border-slate-200">
          <span className="w-1.5 h-1.5 mr-1 rounded-full bg-slate-400"></span>
          Inactive
        </span>
      );
    }
    
    if (acc.verification_status === 'Active') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-250" title="SMTP connection active & verified">
          <span className="w-1.5 h-1.5 mr-1 rounded-full bg-emerald-500 animate-pulse"></span>
          Active
        </span>
      );
    }

    if (acc.verification_status === 'Failed Verification') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200" title={acc.error || "SMTP check failed"}>
          <span className="w-1.5 h-1.5 mr-1 rounded-full bg-rose-500"></span>
          Failed Verification
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200" title="Account not yet verified">
        <span className="w-1.5 h-1.5 mr-1 rounded-full bg-amber-500"></span>
        Unverified
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div>
          <h2 className="text-base font-semibold text-slate-900">SMTP Accounts</h2>
          <p className="text-xs text-slate-500">{accounts.length} account(s) loaded</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={onOpenWizard}
            className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-all flex items-center justify-center gap-1.5 focus:outline-none w-full sm:w-auto"
          >
            Setup Assistant
          </button>
          <button
            onClick={onVerifyAll}
            disabled={verifying || accounts.filter(a => a.enabled === 1).length === 0}
            className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 focus:outline-none w-full sm:w-auto"
          >
            {verifying ? (
              <svg className="animate-spin h-3.5 w-3.5 text-indigo-700" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )}
            Verify Enabled
          </button>
          <button
            onClick={() => {
              setShowImportForm(!showImportForm);
              setShowForm(false);
            }}
            className="col-span-2 sm:col-span-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-all focus:outline-none w-full sm:w-auto text-center justify-center"
          >
            Import CSV
          </button>
          <div className="col-span-2 sm:col-span-1 flex rounded-md shadow-sm w-full sm:w-auto">
            <button
              onClick={handleAddGmailPreset}
              className="flex-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-l-md transition-all focus:outline-none text-center justify-center"
            >
              Add Gmail
            </button>
            <button
              onClick={handleAddCustomPreset}
              className="flex-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border-y border-r border-slate-200 hover:bg-slate-50 rounded-r-md transition-all focus:outline-none text-center justify-center"
            >
              Add Custom
            </button>
          </div>
        </div>
      </div>

      {/* CSV Import */}
      {showImportForm && (
        <div className="p-4 bg-slate-50 border-b border-slate-100 text-xs">
          <form onSubmit={handleCsvSubmit} className="space-y-3">
            <div>
              <label className="block font-medium text-slate-750 mb-1">
                Upload CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvFileUpload}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-705 hover:file:bg-indigo-100 cursor-pointer"
              />
              <span className="block text-[10px] text-slate-400 mt-1 leading-relaxed">
                Expected CSV Format (No header row required):<br />
                <code className="font-mono bg-white p-0.5 border rounded">email,host,port,username,password,secure</code>
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider text-slate-400">
                <span className="bg-slate-50 px-2">or paste CSV rows</span>
              </div>
            </div>
            <div>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="sender1@gmail.com,smtp.gmail.com,587,sender1@gmail.com,apppasscode123,false&#10;sender2@yahoo.com,smtp.mail.yahoo.com,465,sender2@yahoo.com,pass123,true"
                className="w-full h-24 p-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono resize-none leading-relaxed"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImportForm(false)}
                className="px-3 py-1 border border-slate-200 bg-white hover:bg-slate-50 rounded"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={!csvText.trim()}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50 font-semibold"
              >
                Import
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Manual Setup Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="sm:col-span-2">
            <h3 className="font-bold text-slate-700 uppercase tracking-wider">
              {editingId ? "Edit SMTP Account" : "Add SMTP Account"}
            </h3>
          </div>
          <div>
            <label className="block font-medium text-slate-650 mb-0.5">Account Name</label>
            <input
              type="text"
              required
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. My Gmail"
              className="w-full px-2.5 py-1.5 border border-slate-205 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-650 mb-0.5">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (!editingId) setUsername(e.target.value);
              }}
              placeholder="e.g. user@domain.com"
              className="w-full px-2.5 py-1.5 border border-slate-205 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-650 mb-0.5">SMTP Host</label>
            <input
              type="text"
              required
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="e.g. smtp.gmail.com"
              className="w-full px-2.5 py-1.5 border border-slate-205 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-medium text-slate-650 mb-0.5">SMTP Port</label>
              <input
                type="number"
                required
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="587 / 465"
                className="w-full px-2.5 py-1.5 border border-slate-205 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
            <div className="flex items-center mt-4">
              <input
                type="checkbox"
                id="secureManual"
                checked={secure}
                onChange={(e) => setSecure(e.target.checked)}
                className="h-3.5 w-3.5 text-indigo-600 border-slate-350 rounded focus:ring-indigo-500"
              />
              <label htmlFor="secureManual" className="ml-1.5 select-none font-medium text-slate-650">
                SSL/TLS
              </label>
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-650 mb-0.5">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Same as email address"
              className="w-full px-2.5 py-1.5 border border-slate-205 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-650 mb-0.5">Password / App Password</label>
            <input
              type="password"
              required={!editingId}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editingId ? "(Unchanged if empty)" : "Enter password"}
              className="w-full px-2.5 py-1.5 border border-slate-205 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between py-1 bg-white px-2.5 border rounded-md">
            <span className="font-semibold text-slate-750">Account Enabled</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650"></div>
            </label>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 mt-1">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded text-slate-650 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded font-semibold shadow-sm"
            >
              {editingId ? "Update" : "Save"}
            </button>
          </div>
        </form>
      )}

      {/* Account Grid/Table */}
      <div className="overflow-x-auto">
        {accounts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs leading-relaxed space-y-3">
            <div className="text-sm font-semibold text-slate-750">No Active SMTP Account</div>
            <p className="text-slate-400 max-w-sm mx-auto">
              Please configure your first SMTP sender account before dispatching emails.
            </p>
            <button
              onClick={onOpenWizard}
              className="px-4 py-2 bg-indigo-650 hover:bg-indigo-750 text-white font-bold rounded-lg shadow transition-all focus:outline-none text-xs"
            >
              Setup First SMTP Account
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email / Name</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Host</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Last Verified</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {accounts.map((acc) => (
                    <tr key={acc.id} className={`hover:bg-slate-50/50 ${acc.enabled === 0 ? 'opacity-65' : ''}`}>
                      <td className="px-4 py-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          {/* Inline enable toggle */}
                          <label className="relative inline-flex items-center cursor-pointer scale-75">
                            <input
                              type="checkbox"
                              checked={acc.enabled === 1}
                              onChange={() => handleToggleEnabled(acc)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4.5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800 break-all leading-snug">{acc.email}</span>
                            <span className="text-[10px] text-slate-400 leading-tight">{acc.account_name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-655 font-mono break-all">
                        {acc.host}:{acc.port} {acc.secure === 1 ? '(SSL)' : ''}
                      </td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                        {getStatusBadge(acc)}
                        {acc.verification_status === 'Failed Verification' && acc.error && (
                          <div className="text-[9px] text-rose-500 font-medium max-w-[150px] truncate block mt-0.5" title={acc.error}>
                            Err: {acc.error}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 font-mono hidden sm:table-cell">
                        {acc.last_verified ? formatDateTime(acc.last_verified) : 'Never'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs whitespace-nowrap space-x-1.5">
                        <button
                          onClick={() => onVerifySingle(acc.id)}
                          disabled={acc.enabled === 0}
                          className="px-2 py-0.5 border border-slate-200 text-indigo-700 hover:text-indigo-850 hover:bg-slate-50 bg-white rounded text-[10px] font-bold disabled:opacity-50 focus:outline-none"
                        >
                          Verify Again
                        </button>
                        <button
                          onClick={() => handleStartEdit(acc)}
                          className="text-slate-500 hover:text-indigo-650 font-medium focus:outline-none"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(acc.id)}
                          className="text-slate-450 hover:text-rose-655 font-medium focus:outline-none"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="block md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-slate-50/20">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className={`p-4 space-y-3 rounded-xl border transition-all ${
                    acc.enabled === 0 
                      ? 'bg-slate-50/40 opacity-75 border-slate-200 shadow-sm' 
                      : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                  }`}
                >
                  {/* Header: Email and Toggle */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-slate-800 break-all text-xs">
                        {acc.email}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {acc.account_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">
                        {acc.enabled === 1 ? 'Enabled' : 'Disabled'}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer scale-75">
                        <input
                          type="checkbox"
                          checked={acc.enabled === 1}
                          onChange={() => handleToggleEnabled(acc)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4.5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>
                  </div>

                  {/* Connection Details Box */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 p-2.5 rounded border border-slate-100">
                    <div className="col-span-2 min-[400px]:col-span-1">
                      <span className="block text-slate-400 uppercase font-bold text-[8px] tracking-wider mb-0.5">Host Config</span>
                      <span className="font-mono text-slate-700 break-all">
                        {acc.host}:{acc.port} {acc.secure === 1 ? '(SSL)' : ''}
                      </span>
                    </div>
                    <div className="col-span-2 min-[400px]:col-span-1">
                      <span className="block text-slate-400 uppercase font-bold text-[8px] tracking-wider mb-0.5">Verification</span>
                      <div className="inline-block">{getStatusBadge(acc)}</div>
                    </div>
                    <div className="col-span-2 border-t border-slate-200/60 pt-1.5 mt-1">
                      <span className="block text-slate-405 uppercase font-bold text-[8px] tracking-wider mb-0.5">Last Checked</span>
                      <span className="font-mono text-slate-650">
                        {acc.last_verified ? formatDateTime(acc.last_verified) : 'Never'}
                      </span>
                    </div>
                  </div>

                  {/* Collapsible Verification Error */}
                  {acc.verification_status === 'Failed Verification' && acc.error && (
                    <div className="text-[10px] bg-rose-50 text-rose-800 p-2.5 rounded border border-rose-100 break-all leading-normal font-medium">
                      <span className="font-bold text-rose-700 block mb-0.5">Verification Error:</span>
                      {acc.error}
                    </div>
                  )}

                  {/* Row Actions */}
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      onClick={() => onVerifySingle(acc.id)}
                      disabled={acc.enabled === 0}
                      className="px-2.5 py-1 text-[10px] font-bold border border-slate-200 bg-white hover:bg-slate-50 text-indigo-700 rounded transition-all disabled:opacity-50 focus:outline-none"
                    >
                      Verify Again
                    </button>
                    <button
                      onClick={() => handleStartEdit(acc)}
                      className="px-2.5 py-1 text-[10px] font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded transition-all focus:outline-none"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(acc.id)}
                      className="px-2.5 py-1 text-[10px] font-bold border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-650 rounded transition-all focus:outline-none"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
