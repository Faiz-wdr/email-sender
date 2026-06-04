import React, { useState, useEffect, useRef } from 'react';
import { api, subscribeToStatus } from './utils/api.js';
import SmtpAccounts from './components/SmtpAccounts.jsx';
import EmailConfig from './components/EmailConfig.jsx';
import LiveStatus from './components/LiveStatus.jsx';
import LogsTable from './components/LogsTable.jsx';
import ConfirmationModal from './components/ConfirmationModal.jsx';
import Toast from './components/Toast.jsx';
import SmtpWizard from './components/SmtpWizard.jsx';
import SmtpHelp from './components/SmtpHelp.jsx';

export default function App() {
  // Navigation & Layout States
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // SMTP & Template Data States
  const [accounts, setAccounts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  
  // Loading & Action States
  const [verifying, setVerifying] = useState(false);
  const [toast, setToast] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  
  // Email Form States (Initialized empty, will load from localStorage)
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isHtml, setIsHtml] = useState(false);

  // Active Sending Task (live status from SSE)
  const [activeTask, setActiveTask] = useState({
    id: null,
    recipient: '',
    subject: '',
    body: '',
    isHtml: false,
    scheduledTime: null,
    status: 'idle',
    accounts: {}
  });
  const [liveStats, setLiveStats] = useState(null);

  // Confirmation Modal State
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    actionType: null, // 'send_now'
    payload: null
  });

  // Reference for scrolling to sections
  const accountsRef = useRef(null);
  const emailConfigRef = useRef(null);
  const statusRef = useRef(null);
  const logsRef = useRef(null);

  // Show toast helper
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  // 1. Initial Data Fetching
  const fetchInitialData = async () => {
    try {
      const [accs, tmpls, historyLogs] = await Promise.all([
        api.getAccounts(),
        api.getTemplates(),
        api.getLogs()
      ]);
      setAccounts(accs);
      setTemplates(tmpls);
      setLogs(historyLogs);
    } catch (error) {
      showToast(`Error fetching initial data: ${error.message}`, 'error');
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // 2. Listen to SSE Stream
  useEffect(() => {
    const unsubscribe = subscribeToStatus({
      init: (data) => {
        setActiveTask(data);
      },
      update: (data) => {
        setActiveTask(data);
        if (data.status === 'sending') {
          setLiveStats(null);
          scrollToRef(statusRef);
        }
      },
      account_update: ({ email, data }) => {
        setActiveTask(prev => ({
          ...prev,
          accounts: {
            ...prev.accounts,
            [email]: data
          }
        }));
      },
      task_complete: ({ logs: freshLogs, stats }) => {
        setLiveStats(stats);
        setLogs(prev => [...freshLogs, ...prev]);
        showToast(`Send completed! ${stats.totalSent} sent, ${stats.totalFailed} failed.`, 'success');
        scrollToRef(logsRef);
      },
      error: ({ message }) => {
        showToast(message, 'error');
      }
    });

    return () => unsubscribe();
  }, []);

  // 4. Form Auto-Save (LocalStorage)
  useEffect(() => {
    const r = localStorage.getItem('smtp_sender_recipient') || '';
    const s = localStorage.getItem('smtp_sender_subject') || '';
    const b = localStorage.getItem('smtp_sender_body') || '';
    const h = localStorage.getItem('smtp_sender_isHtml') === 'true';
    if (r) setRecipient(r);
    if (s) setSubject(s);
    if (b) setBody(b);
    setIsHtml(h);
  }, []);

  useEffect(() => {
    localStorage.setItem('smtp_sender_recipient', recipient);
  }, [recipient]);
  useEffect(() => {
    localStorage.setItem('smtp_sender_subject', subject);
  }, [subject]);
  useEffect(() => {
    localStorage.setItem('smtp_sender_body', body);
  }, [body]);
  useEffect(() => {
    localStorage.setItem('smtp_sender_isHtml', String(isHtml));
  }, [isHtml]);

  // 5. Internet Connectivity Event Listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Scroll to layout sections
  const scrollToRef = (ref) => {
    if (ref && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setDrawerOpen(false);
  };

  // ==========================================
  // ACTION HANDLERS
  // ==========================================

  // Verify single credentials
  const handleVerifySingle = async (id) => {
    showToast("Verifying SMTP credentials...", "info");
    try {
      const res = await api.verifyAccountSingle(id);
      setAccounts(prev => prev.map(a => a.id === res.account.id ? res.account : a));
      if (res.success) {
        showToast("✓ SMTP Connection Successful", "success");
      } else {
        const errorReason = res.account.error ? `Reason: ${res.account.error}` : "SMTP verification failed.";
        showToast(`✗ SMTP Verification Failed. ${errorReason}`, "error");
      }
    } catch (error) {
      showToast(`Verification check failed: ${error.message}`, "error");
    }
  };

  // Verify Accounts Credentials
  const handleVerifyAccounts = async () => {
    setVerifying(true);
    showToast("Verifying SMTP credentials for all accounts. Please wait...", "info");
    try {
      const res = await api.verifyAccounts();
      if (res.success) {
        setAccounts(res.accounts);
        const successes = res.results.filter(r => r.success).length;
        const failures = res.results.filter(r => !r.success).length;
        showToast(`Verification completed: ${successes} valid, ${failures} invalid.`, successes > 0 ? 'success' : 'warning');
      }
    } catch (error) {
      showToast(`Verification failed: ${error.message}`, "error");
    } finally {
      setVerifying(false);
    }
  };

  // Manual Add Account
  const handleAddAccount = async (data) => {
    try {
      const newAcc = await api.addAccount(data);
      setAccounts(prev => [newAcc, ...prev]);
      showToast(`Account ${newAcc.email} added successfully.`, "success");
    } catch (error) {
      showToast(`Error adding account: ${error.message}`, "error");
      throw error;
    }
  };

  // Update Account
  const handleUpdateAccount = async (id, data) => {
    try {
      const updated = await api.updateAccount(id, data);
      setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a));
      showToast(`Account ${updated.email} updated successfully.`, "success");
    } catch (error) {
      showToast(`Error updating account: ${error.message}`, "error");
      throw error;
    }
  };

  // Delete Account
  const handleDeleteAccount = async (id) => {
    if (!window.confirm("Are you sure you want to delete this SMTP account?")) return;
    try {
      await api.deleteAccount(id);
      setAccounts(prev => prev.filter(a => a.id !== id));
      showToast("Account removed successfully.", "success");
    } catch (error) {
      showToast(`Error removing account: ${error.message}`, "error");
    }
  };

  // Import CSV Accounts
  const handleImportAccounts = async (csvText) => {
    try {
      const res = await api.importAccounts(csvText);
      if (res.success) {
        showToast(`Imported ${res.count} accounts successfully. Checking credentials...`, "info");
        await handleVerifyAccounts();
      }
    } catch (error) {
      showToast(`CSV Import failed: ${error.message}`, "error");
      throw error;
    }
  };

  // Test send from single account
  const handleTestSendSingle = async (accountId) => {
    if (!recipient || !subject || !body) {
      showToast("Please enter a Recipient, Subject, and Body first.", "warning");
      scrollToRef(emailConfigRef);
      return;
    }

    const testRecipient = window.prompt("Enter recipient for single test email:", recipient);
    if (!testRecipient) return;

    showToast("Sending test email...", "info");
    try {
      const res = await api.sendTest({
        accountId,
        testRecipient,
        subject,
        body,
        isHtml
      });
      if (res.success) {
        showToast(`Test email sent successfully: ${res.response}`, "success");
      }
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  // Save templates
  const handleSaveTemplate = async (name, sub, textBody, htmlMode) => {
    try {
      const saved = await api.saveTemplate({ name, subject: sub, body: textBody, isHtml: htmlMode });
      setTemplates(prev => {
        const exists = prev.some(t => t.name === saved.name);
        if (exists) {
          return prev.map(t => t.name === saved.name ? saved : t);
        }
        return [saved, ...prev];
      });
      showToast(`Template "${saved.name}" saved successfully.`, "success");
    } catch (error) {
      showToast(`Error saving template: ${error.message}`, "error");
      throw error;
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (id) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    try {
      await api.deleteTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      showToast("Template deleted successfully.", "success");
    } catch (error) {
      showToast(`Error deleting template: ${error.message}`, "error");
    }
  };

  // Immediate send confirmation prompt
  const triggerSendNow = () => {
    if (!recipient || !subject || !body) {
      showToast("Please specify recipient, subject, and body.", "warning");
      return;
    }
    const verifiedAccounts = accounts.filter(a => a.status === 'valid');
    if (verifiedAccounts.length === 0) {
      showToast("You need at least 1 verified (Active) SMTP account to send.", "warning");
      return;
    }

    setModal({
      isOpen: true,
      title: "Confirm Immediate Dispatch",
      message: `You are about to send this email simultaneously from ${verifiedAccounts.length} verified SMTP account(s) immediately to recipient: "${recipient}". Proceed?`,
      actionType: 'send_now',
      payload: null
    });
  };

  // Execute confirmed action
  const handleConfirmAction = async () => {
    const { actionType } = modal;
    setModal({ isOpen: false, title: '', message: '', actionType: null, payload: null });

    try {
      if (actionType === 'send_now') {
        showToast("Immediate transmission triggered.", "info");
        await api.sendNow({ recipient, subject, body, isHtml });
      }
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  const activeAccountsCount = accounts.filter(a => a.status === 'valid').length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans select-none antialiased">
      {/* Top Banner for Offline Warning */}
      {!isOnline && (
        <div className="bg-rose-500 text-white text-xs font-semibold py-1.5 px-4 text-center shadow-sm flex items-center justify-center gap-1.5 animate-pulse">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Internet Connection Lost. Checking connection status...
        </div>
      )}

      {/* Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xl">✉️</span>
          <div>
            <h1 className="text-sm font-bold text-slate-800 tracking-tight leading-none">SMTP Multi-Sender</h1>
            <span className="text-[10px] text-slate-400 font-medium font-mono uppercase">Precision Exam Tool</span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center space-x-4 text-xs font-semibold text-slate-600">
          <button onClick={() => scrollToRef(accountsRef)} className="hover:text-indigo-650">Accounts</button>
          <button onClick={() => scrollToRef(emailConfigRef)} className="hover:text-indigo-650">Email Payload</button>
          <button onClick={() => scrollToRef(statusRef)} className="hover:text-indigo-650">Live Status</button>
          <button onClick={() => scrollToRef(logsRef)} className="hover:text-indigo-650">Logs</button>
        </nav>

        {/* Mobile Hamburger Menu Toggle */}
        <div className="flex items-center gap-3 md:hidden">
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${isOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </div>
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="p-1 text-slate-500 hover:text-slate-700 focus:outline-none"
          >
            <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* Navigation Drawer (Mobile) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs"
          ></div>
          
          {/* Drawer Panel */}
          <div className="relative w-64 max-w-xs bg-white h-full shadow-xl flex flex-col p-4 z-10 border-r border-slate-100">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-400">Navigation</span>
              <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="flex flex-col space-y-3 text-sm font-medium text-slate-700">
              <button onClick={() => scrollToRef(accountsRef)} className="text-left py-1 hover:text-indigo-600 transition-colors">SMTP Accounts</button>
              <button onClick={() => scrollToRef(emailConfigRef)} className="text-left py-1 hover:text-indigo-600 transition-colors">Email Config</button>
              <button onClick={() => scrollToRef(statusRef)} className="text-left py-1 hover:text-indigo-600 transition-colors">Live Status</button>
              <button onClick={() => scrollToRef(logsRef)} className="text-left py-1 hover:text-indigo-600 transition-colors">Historical Logs</button>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
        
        {/* Row 1: Accounts and Configurations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {/* SMTP Accounts */}
          <div ref={accountsRef} className="lg:col-span-2 space-y-4">
            <SmtpAccounts
              accounts={accounts}
              onAdd={handleAddAccount}
              onUpdate={handleUpdateAccount}
              onDelete={handleDeleteAccount}
              onImport={handleImportAccounts}
              onVerifyAll={handleVerifyAccounts}
              onVerifySingle={handleVerifySingle}
              onTestSend={handleTestSendSingle}
              onOpenWizard={() => setWizardOpen(true)}
              verifying={verifying}
            />
            <SmtpHelp />
          </div>

          {/* Email Payload Configuration */}
          <div ref={emailConfigRef}>
            <EmailConfig
              recipient={recipient}
              setRecipient={setRecipient}
              subject={subject}
              setSubject={setSubject}
              body={body}
              setBody={setBody}
              isHtml={isHtml}
              setIsHtml={setIsHtml}
              templates={templates}
              onSaveTemplate={handleSaveTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              onSendNow={triggerSendNow}
              activeAccountsCount={activeAccountsCount}
              sending={activeTask.status === 'sending'}
            />
          </div>
        </div>

        {/* Live Status Progress Panel */}
        <div ref={statusRef}>
          <LiveStatus activeTask={activeTask} />
        </div>

        {/* Historical Transmission Logs */}
        <div ref={logsRef}>
          <LogsTable logs={logs} stats={liveStats} />
        </div>

      </main>

      {/* Confirmation Dialog Modal */}
      <ConfirmationModal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        onConfirm={handleConfirmAction}
        onCancel={() => setModal({ isOpen: false, title: '', message: '', actionType: null, payload: null })}
      />

      {/* Onboarding Setup Wizard Assistant */}
      <SmtpWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onAdd={handleAddAccount}
        showToast={showToast}
      />

      {/* Toast Notification Container */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
