import React, { useState } from 'react';

export default function EmailConfig({
  recipient,
  setRecipient,
  subject,
  setSubject,
  body,
  setBody,
  isHtml,
  setIsHtml,
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  onSendNow,
  activeAccountsCount,
  sending
}) {
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplateForm, setShowSaveTemplateForm] = useState(false);

  // Handle template selection
  const handleSelectTemplate = (e) => {
    const templateId = e.target.value;
    if (!templateId) return;

    const selected = templates.find(t => t.id === parseInt(templateId, 10));
    if (selected) {
      setSubject(selected.subject);
      setBody(selected.body);
      setIsHtml(selected.is_html === 1 || selected.is_html === true);
    }
    // Reset dropdown
    e.target.value = '';
  };

  // Submit template creation
  const handleSaveTemplateSubmit = async (e) => {
    e.preventDefault();
    if (!templateName.trim() || !subject || !body) return;

    try {
      await onSaveTemplate(templateName.trim(), subject, body, isHtml);
      setTemplateName('');
      setShowSaveTemplateForm(false);
    } catch (err) {}
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Email Configuration</h2>
          <p className="text-xs text-slate-500">Configure recipient and message payload</p>
        </div>
        
        {/* Templates Selector */}
        <div className="flex items-center gap-2">
          {templates.length > 0 && (
            <select
              onChange={handleSelectTemplate}
              defaultValue=""
              className="px-2 py-1 text-xs border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[150px]"
            >
              <option value="" disabled>Load Template...</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowSaveTemplateForm(!showSaveTemplateForm)}
            disabled={!subject || !body}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded transition-colors disabled:opacity-50"
          >
            Save Template
          </button>
        </div>
      </div>

      {/* Save Template Panel */}
      {showSaveTemplateForm && (
        <form onSubmit={handleSaveTemplateSubmit} className="p-3 bg-slate-50 border-b border-slate-100 flex gap-2 items-center">
          <input
            type="text"
            required
            placeholder="Template Name (e.g. Exam Registration)"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setShowSaveTemplateForm(false)}
            className="px-2 py-1 text-xs text-slate-600 bg-white border border-slate-200 rounded"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Manage/Delete Existing Templates List (Small inline block if requested) */}
      {templates.length > 0 && (
        <div className="px-4 py-1.5 bg-indigo-50/50 border-b border-slate-100 flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] uppercase font-semibold text-indigo-700 tracking-wider mr-1">Templates:</span>
          {templates.map(t => (
            <div key={t.id} className="inline-flex items-center gap-1 bg-white border border-indigo-100 rounded pl-1.5 pr-0.5 py-0.5 text-[10px] text-indigo-800">
              <span className="font-medium">{t.name}</span>
              <button
                onClick={() => onDeleteTemplate(t.id)}
                className="text-slate-400 hover:text-rose-600 transition-colors"
                title="Delete template"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Fields */}
      <div className="p-4 space-y-3 flex-1 flex flex-col justify-start">
        {/* Recipient Email */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-0.5">Recipient Email</label>
          <input
            type="email"
            required
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="e.g. registrar@university.edu"
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
          />
        </div>

        {/* Subject */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-0.5">Subject</label>
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Exam Seat Registration - Fall 2026"
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
          />
        </div>

        {/* Body Textarea */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-0.5">
            <label className="block text-xs font-medium text-slate-600">Email Body</label>
            <div className="flex items-center space-x-3">
              {/* HTML Mode Toggle */}
              <label className="inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isHtml}
                  onChange={(e) => setIsHtml(e.target.checked)}
                  className="h-3 w-3 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <span className="ml-1.5 text-xs text-slate-600">HTML Mode</span>
              </label>
              
              {/* Character Counter */}
              <span className="text-xs text-slate-400 font-mono">
                {body.length} chars
              </span>
            </div>
          </div>
          <textarea
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={isHtml ? "<p>Dear Registrar,</p><p>Please register me for...</p>" : "Dear Registrar,\n\nPlease register me for..."}
            className="w-full flex-1 min-h-[140px] p-2.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono resize-none leading-relaxed"
          />
        </div>
      </div>

      {/* Send Actions Footer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-2">
        <button
          type="button"
          onClick={onSendNow}
          disabled={activeAccountsCount === 0 || sending}
          className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
        >
          {sending ? 'Sending...' : `Send Now (from ${activeAccountsCount} Account${activeAccountsCount !== 1 ? 's' : ''})`}
        </button>
        {activeAccountsCount === 0 && (
          <p className="text-[10px] text-rose-500 font-medium text-center">
            ⚠️ You need at least 1 verified (Active) SMTP account to enable sending.
          </p>
        )}
      </div>
    </div>
  );
}
