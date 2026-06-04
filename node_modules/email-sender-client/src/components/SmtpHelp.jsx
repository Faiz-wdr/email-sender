import React, { useState } from 'react';

export default function SmtpHelp() {
  const [openSection, setOpenSection] = useState(null);

  const toggleSection = (section) => {
    setOpenSection(openSection === section ? null : section);
  };

  const sections = [
    {
      id: 'smtp',
      title: "What is SMTP?",
      content: (
        <p>
          <strong>SMTP</strong> stands for <em>Simple Mail Transfer Protocol</em>. Think of it as the digital postal service for the internet. 
          When you click "Send," SMTP takes your email from this application, routes it through your email provider's server (like Google or Microsoft), 
          and delivers it securely to the recipient's inbox.
        </p>
      )
    },
    {
      id: 'app_password',
      title: "What is an App Password?",
      content: (
        <p>
          An <strong>App Password</strong> is a unique, randomly generated 16-character passcode provided by your email host (like Gmail). 
          It allows this application to log into your SMTP server and send emails on your behalf. It functions as a security key that authorizes 
          this specific application without sharing your master password.
        </p>
      )
    },
    {
      id: 'why_not_normal',
      title: "Why is my normal Gmail password not recommended?",
      content: (
        <div className="space-y-2">
          <p>
            Using your primary login password is not recommended—and is actually blocked by providers like Google—for two critical reasons:
          </p>
          <ul className="list-disc pl-4 space-y-1.5">
            <li>
              <strong>Account Security:</strong> If you input your primary password, you expose the master key to your entire Google account (which controls your Google Drive, Photos, Contacts, and Chrome data). Using a unique App Password restricts access solely to sending emails.
            </li>
            <li>
              <strong>Security Blockage:</strong> Major providers automatically block third-party tools that attempt to connect using standard account passwords to prevent unauthorized account hacking.
            </li>
          </ul>
        </div>
      )
    }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-xs font-bold text-slate-905 uppercase tracking-wider">
          SMTP & Security Handbook
        </h3>
        <p className="text-[10px] text-slate-400 font-medium">
          Understand how email sending and app passwords work
        </p>
      </div>
      
      <div className="divide-y divide-slate-100">
        {sections.map((sec) => {
          const isOpen = openSection === sec.id;
          return (
            <div key={sec.id} className="text-xs">
              <button
                onClick={() => toggleSection(sec.id)}
                className="w-full px-4 py-3 flex items-center justify-between text-left font-medium text-slate-700 hover:bg-slate-50 transition-colors focus:outline-none"
              >
                <span>{sec.title}</span>
                <svg
                  className={`w-4 h-4 text-slate-450 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {isOpen && (
                <div className="px-4 pb-3 text-slate-500 leading-relaxed bg-slate-50/30">
                  {sec.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
