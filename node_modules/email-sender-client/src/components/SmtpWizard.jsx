import React, { useState, useEffect } from 'react';
import { api } from '../utils/api.js';

export default function SmtpWizard({ isOpen, onClose, onAdd, showToast }) {
  const [step, setStep] = useState(1); // 1 = Select Provider, 2 = Fill Details & Test, 3 = Completed
  const [provider, setProvider] = useState('');
  
  // Form fields
  const [accountName, setAccountName] = useState('');
  const [email, setEmail] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(false);
  const [enabled, setEnabled] = useState(true);

  // Verification states
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string, error?: string }

  // Gmail Helper Wizard active steps
  const [gmailStep, setGmailStep] = useState(1);

  // Reset wizard on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setProvider('');
      setAccountName('');
      setEmail('');
      setHost('');
      setPort('587');
      setUsername('');
      setPassword('');
      setSecure(false);
      setEnabled(true);
      setTestResult(null);
      setGmailStep(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Auto configure presets
  const handleSelectProvider = (prov) => {
    setProvider(prov);
    setTestResult(null);
    
    // Set default naming and servers
    switch (prov) {
      case 'gmail':
        setAccountName('Gmail Account');
        setHost('smtp.gmail.com');
        setPort('587');
        setSecure(false);
        break;
      case 'outlook':
        setAccountName('Outlook Account');
        setHost('smtp.office365.com');
        setPort('587');
        setSecure(false);
        break;
      case 'yahoo':
        setAccountName('Yahoo Account');
        setHost('smtp.mail.yahoo.com');
        setPort('465');
        setSecure(true);
        break;
      case 'zoho':
        setAccountName('Zoho Account');
        setHost('smtp.zoho.com');
        setPort('465');
        setSecure(true);
        break;
      default: // custom
        setAccountName('Custom SMTP');
        setHost('');
        setPort('587');
        setSecure(false);
        break;
    }
    
    setStep(2);
  };

  // Sync Username with Email automatically if Custom SMTP isn't selected or if Username is empty
  const handleEmailChange = (val) => {
    setEmail(val);
    if (provider !== 'custom') {
      setUsername(val);
    }
  };

  // Validate form fields
  const validateFields = () => {
    if (!accountName.trim()) return "Account Name is required.";
    if (!email.trim() || !email.includes('@')) return "A valid Email Address is required.";
    if (!host.trim()) return "SMTP Host is required.";
    if (!port.trim() || isNaN(port)) return "A valid SMTP Port number is required.";
    if (!username.trim()) return "Username is required.";
    if (!password.trim()) return "Password / App Password is required.";
    return null;
  };

  // Test SMTP connection
  const handleTestConnection = async () => {
    const errorMsg = validateFields();
    if (errorMsg) {
      showToast(errorMsg, 'warning');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await api.testConnection({
        email,
        host,
        port: parseInt(port, 10),
        username,
        password,
        secure
      });

      setTestResult(result);
      if (result.success) {
        showToast("SMTP connection verified successfully!", "success");
        if (provider === 'gmail') setGmailStep(4);
      } else {
        showToast("SMTP verification failed. Check errors below.", "error");
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: "✗ SMTP Connection Failed",
        error: err.message
      });
      showToast("SMTP connection check failed.", "error");
    } finally {
      setTesting(false);
    }
  };

  // Save SMTP Account
  const handleSave = async () => {
    const errorMsg = validateFields();
    if (errorMsg) {
      showToast(errorMsg, 'warning');
      return;
    }

    try {
      // Map verification status based on test result
      let verification_status = 'unverified';
      if (testResult) {
        verification_status = testResult.success ? 'Active' : 'Failed Verification';
      }

      await onAdd({
        account_name: accountName,
        email,
        host,
        port: parseInt(port, 10),
        username,
        password,
        secure: secure ? 1 : 0,
        enabled: enabled ? 1 : 0,
        verification_status
      });

      setStep(3); // success view
    } catch (err) {
      // toast shown by parent App
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-100 overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-800">SMTP Setup Assistant</h3>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              {step === 1 && "Step 1: Choose Provider"}
              {step === 2 && `Step 2: Configure ${provider.toUpperCase()}`}
              {step === 3 && "Complete!"}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-650 focus:outline-none">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* STEP 1: SELECT PROVIDER */}
          {step === 1 && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-700 text-center">
                What email provider are you using?
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleSelectProvider('gmail')}
                  className="p-4 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/20 text-center transition-all flex flex-col items-center gap-1.5 focus:outline-none"
                >
                  <span className="text-2xl">📧</span>
                  <span className="text-xs font-semibold text-slate-800">Gmail</span>
                </button>
                <button
                  onClick={() => handleSelectProvider('outlook')}
                  className="p-4 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/20 text-center transition-all flex flex-col items-center gap-1.5 focus:outline-none"
                >
                  <span className="text-2xl">💻</span>
                  <span className="text-xs font-semibold text-slate-800">Outlook / Live</span>
                </button>
                <button
                  onClick={() => handleSelectProvider('yahoo')}
                  className="p-4 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/20 text-center transition-all flex flex-col items-center gap-1.5 focus:outline-none"
                >
                  <span className="text-2xl">🟣</span>
                  <span className="text-xs font-semibold text-slate-800">Yahoo Mail</span>
                </button>
                <button
                  onClick={() => handleSelectProvider('zoho')}
                  className="p-4 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/20 text-center transition-all flex flex-col items-center gap-1.5 focus:outline-none"
                >
                  <span className="text-2xl">🌐</span>
                  <span className="text-xs font-semibold text-slate-800">Zoho Mail</span>
                </button>
                <button
                  onClick={() => handleSelectProvider('custom')}
                  className="col-span-2 p-4 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/20 text-center transition-all flex flex-col items-center gap-1.5 focus:outline-none"
                >
                  <span className="text-2xl">⚙️</span>
                  <span className="text-xs font-semibold text-slate-850">Custom SMTP</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: FILL DETAILS & WIZARD */}
          {step === 2 && (
            <div className="space-y-4">
              
              {/* GMAIL HELPER WIZARD GUIDE */}
              {provider === 'gmail' && (
                <div className="bg-indigo-50/65 rounded-lg border border-indigo-100 p-3 text-xs leading-relaxed space-y-2">
                  <span className="block text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                    Gmail App Password Setup
                  </span>
                  
                  {/* Step Markers */}
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mb-2 border-b border-indigo-100/50 pb-2">
                    <span className={gmailStep >= 1 ? "text-indigo-700" : ""}>1. 2-Step Auth</span>
                    <span className="text-slate-300">➜</span>
                    <span className={gmailStep >= 2 ? "text-indigo-700" : ""}>2. App Password</span>
                    <span className="text-slate-300">➜</span>
                    <span className={gmailStep >= 3 ? "text-indigo-700" : ""}>3. Paste Info</span>
                    <span className="text-slate-300">➜</span>
                    <span className={gmailStep >= 4 ? "text-indigo-700" : ""}>4. Verify</span>
                  </div>

                  {gmailStep === 1 && (
                    <div className="space-y-2">
                      <p>
                        <strong>Step 1: Enable Google 2-Step Verification</strong>
                        <br />
                        App Passwords require your Gmail account to have 2-Step Verification enabled. Turn this on in your Google Account Security settings first.
                      </p>
                      <button
                        onClick={() => setGmailStep(2)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1 px-2.5 rounded text-[10px]"
                      >
                        I have enabled 2-Step Verification
                      </button>
                    </div>
                  )}

                  {gmailStep === 2 && (
                    <div className="space-y-2">
                      <p>
                        <strong>Step 2: Generate Gmail App Password</strong>
                        <br />
                        Go to your Google Account Settings ➜ Security ➜ App Passwords. Select "Mail" and "Other (Custom Name)" to generate a 16-character password code.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setGmailStep(1)}
                          className="bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 font-semibold py-1 px-2.5 rounded text-[10px]"
                        >
                          Back
                        </button>
                        <button
                          onClick={() => setGmailStep(3)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1 px-2.5 rounded text-[10px]"
                        >
                          I have the 16-character code
                        </button>
                      </div>
                    </div>
                  )}

                  {gmailStep === 3 && (
                    <p className="text-indigo-850">
                      <strong>Step 3: Paste App Password Below</strong>
                      <br />
                      Fill in your Gmail address and paste the 16-character app password into the password field below.
                    </p>
                  )}

                  {gmailStep === 4 && (
                    <p className="text-emerald-800 font-semibold">
                      ✓ App Password Verified! Click Save below to add this Gmail Account.
                    </p>
                  )}
                </div>
              )}

              {/* FORM FIELDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                
                {/* Account Name */}
                <div>
                  <label className="block font-medium text-slate-650 mb-0.5">Account Name</label>
                  <input
                    type="text"
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Work Gmail"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block font-medium text-slate-650 mb-0.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="e.g. sender@gmail.com"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* Show SMTP host and port only for custom or allow view/edit for all */}
                <div>
                  <label className="block font-medium text-slate-650 mb-0.5">SMTP Host</label>
                  <input
                    type="text"
                    required
                    disabled={provider !== 'custom'}
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-slate-650 mb-0.5">SMTP Port</label>
                    <input
                      type="number"
                      required
                      disabled={provider !== 'custom'}
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="flex items-center mt-4">
                    <input
                      type="checkbox"
                      id="secureWizard"
                      disabled={provider !== 'custom'}
                      checked={secure}
                      onChange={(e) => setSecure(e.target.checked)}
                      className="h-3.5 w-3.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                    />
                    <label htmlFor="secureWizard" className="ml-1.5 select-none font-medium text-slate-650">
                      SSL/TLS
                    </label>
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label className="block font-medium text-slate-650 mb-0.5">Username (Auth User)</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Same as email address"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* Password / App Password */}
                <div>
                  <label className="block font-medium text-slate-650 mb-0.5">Password / App Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={provider === 'gmail' ? '16-character code' : 'Email password'}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Enabled Toggle */}
                <div className="sm:col-span-2 flex items-center justify-between bg-slate-50 p-2.5 rounded-md border border-slate-100">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-700">Account Enabled</span>
                    <span className="text-[10px] text-slate-400">Available to send emails immediately when verified</span>
                  </div>
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

              </div>

              {/* TEST CONNECTION BUTTON AND RESULTS */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="w-full py-2 px-4 border border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 rounded-md font-semibold transition-all disabled:opacity-50 text-xs flex items-center justify-center gap-1.5"
                >
                  {testing ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-indigo-750" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying Connection...
                    </>
                  ) : (
                    "Verify SMTP Connection"
                  )}
                </button>

                {/* Feedback Messages */}
                {testResult && (
                  <div className={`mt-3 p-3 rounded-lg border text-xs leading-normal ${
                    testResult.success 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    <div className="font-semibold">{testResult.message}</div>
                    {!testResult.success && testResult.error && (
                      <div className="mt-1 font-mono text-[10px] break-all leading-normal text-rose-600 bg-white/70 p-1.5 rounded border border-rose-100">
                        Reason: {testResult.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: SETUP SUCCESS */}
          {step === 3 && (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                ✓
              </div>
              <h4 className="text-sm font-semibold text-slate-800">SMTP Account Setup Successful!</h4>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                The account has been verified and marked as <strong>Active</strong>. It is now ready to dispatch emails immediately.
              </p>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-100 p-3 px-5 flex justify-between">
          <div>
            {step === 2 && (
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setTestResult(null);
                }}
                className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded text-xs font-semibold text-slate-650 transition-all focus:outline-none"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded text-xs font-semibold text-slate-650 transition-all focus:outline-none"
            >
              {step === 3 ? "Close Setup" : "Cancel"}
            </button>
            {step === 2 && (
              <button
                type="button"
                onClick={handleSave}
                className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded text-xs font-semibold shadow-sm transition-all focus:outline-none"
              >
                Save Account
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm transition-all focus:outline-none"
              >
                Done
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
