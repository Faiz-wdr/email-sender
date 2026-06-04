import React from 'react';
import { formatTimeWithMs } from '../utils/time.js';

export default function LiveStatus({ activeTask }) {
  if (!activeTask || activeTask.status === 'idle') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center text-slate-500 text-xs">
        <svg className="w-10 h-10 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        No active transmission session. <br />
        <span className="text-slate-400">Trigger Send Now or Schedule a task to watch live statuses.</span>
      </div>
    );
  }

  const accountsArray = Object.values(activeTask.accounts || {});
  
  // Calculate progress details
  const total = accountsArray.length;
  const sent = accountsArray.filter(a => a.status === 'Sent').length;
  const failed = accountsArray.filter(a => a.status === 'Failed').length;
  const processed = sent + failed;
  const progressPercent = total > 0 ? Math.round((processed / total) * 100) : 0;

  // Status Classes Helper
  const getStatusClasses = (status) => {
    switch (status) {
      case 'Sent':
        return {
          card: 'border-emerald-200 bg-emerald-50/20',
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-500'
        };
      case 'Failed':
        return {
          card: 'border-rose-200 bg-rose-50/20',
          badge: 'bg-rose-100 text-rose-800 border-rose-200',
          dot: 'bg-rose-500'
        };
      case 'Sending':
        return {
          card: 'border-amber-200 bg-amber-50/20 animate-pulse',
          badge: 'bg-amber-100 text-amber-800 border-amber-200',
          dot: 'bg-amber-500 animate-ping'
        };
      case 'Connecting':
        return {
          card: 'border-blue-200 bg-blue-50/20 animate-pulse',
          badge: 'bg-blue-100 text-blue-800 border-blue-200',
          dot: 'bg-blue-500'
        };
      default: // Queued
        return {
          card: 'border-slate-200 bg-white',
          badge: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400'
        };
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            Live Sending Status
            <span className="capitalize text-xs font-medium px-2 py-0.5 rounded-md border bg-indigo-50 text-indigo-700 border-indigo-150">
              {activeTask.status}
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Sending to: <span className="font-mono text-slate-700 font-semibold">{activeTask.recipient}</span>
          </p>
        </div>

        {/* Progress Numbers */}
        <div className="text-right text-xs">
          <span className="font-semibold text-slate-700">{processed}</span> / <span className="text-slate-500">{total} Accounts</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 h-1.5">
        <div
          className="bg-indigo-600 h-1.5 transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        ></div>
      </div>

      {/* Grid of accounts */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[350px] overflow-y-auto">
        {accountsArray.map((acc) => {
          const classes = getStatusClasses(acc.status);
          return (
            <div
              key={acc.email}
              className={`p-3 border rounded-lg transition-colors flex flex-col justify-between space-y-2 text-xs ${classes.card}`}
            >
              {/* Email & Status Badge */}
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-slate-800 break-all leading-tight">
                  {acc.email}
                </span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${classes.badge}`}>
                  <span className={`w-1.5 h-1.5 mr-1 rounded-full ${classes.dot}`}></span>
                  {acc.status}
                </span>
              </div>

              {/* Start & End Times */}
              <div className="text-[10px] text-slate-500 space-y-0.5 font-mono">
                {acc.startTime && (
                  <div>Start: {formatTimeWithMs(acc.startTime)}</div>
                )}
                {acc.sentTime && (
                  <div>End: {formatTimeWithMs(acc.sentTime)}</div>
                )}
                {acc.duration !== null && acc.duration !== undefined && (
                  <div className="text-indigo-600 font-semibold">
                    Duration: {acc.duration} ms
                  </div>
                )}
              </div>

              {/* SMTP response or error */}
              {(acc.response || acc.error) && (
                <div className="border-t border-slate-100 pt-1.5 mt-1.5 text-[10px] break-all leading-relaxed">
                  {acc.status === 'Failed' ? (
                    <span className="text-rose-600 font-medium">
                      Error: {acc.error}
                    </span>
                  ) : (
                    <span className="text-slate-500 font-mono">
                      SMTP: {acc.response}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
