import React from 'react';
import { formatTimeWithMs, formatDateTime } from '../utils/time.js';

export default function LogsTable({ logs, stats: liveStats }) {
  
  // Calculate stats from the database log history if no live stats are passed
  const getCalculatedStats = () => {
    if (liveStats) return liveStats;

    const successfulLogs = logs.filter(l => l.status === 'SUCCESS');
    const totalSent = successfulLogs.length;
    const totalFailed = logs.filter(l => l.status === 'FAILED').length;
    
    if (successfulLogs.length === 0) {
      return { totalSent, totalFailed, averageSendTime: 0, fastestSendTime: 0, slowestSendTime: 0 };
    }

    const durations = successfulLogs.map(l => l.duration).filter(d => d !== null && d !== undefined);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const averageSendTime = durations.length > 0 ? Math.round(totalDuration / durations.length) : 0;
    const fastestSendTime = durations.length > 0 ? Math.min(...durations) : 0;
    const slowestSendTime = durations.length > 0 ? Math.max(...durations) : 0;

    return {
      totalSent,
      totalFailed,
      averageSendTime,
      fastestSendTime,
      slowestSendTime
    };
  };

  const stats = getCalculatedStats();

  const handleExportCsv = () => {
    if (logs.length === 0) return;
    const headers = 'Sender Email,Recipient,Status,Scheduled Time,Actual Send Start Time,Actual Send Completion Time,Total Duration (ms),SMTP Response,Error Message\n';
    const rows = logs.map(l => {
      const escape = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
      return [
        escape(l.sender_email),
        escape(l.recipient),
        escape(l.status),
        escape(l.scheduled_time),
        escape(l.start_time),
        escape(l.end_time),
        l.duration || 0,
        escape(l.smtp_response),
        escape(l.error_message)
      ].join(',');
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `smtp_sender_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJson = () => {
    if (logs.length === 0) return;
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `smtp_sender_logs_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Stats Summary Cards */}
      <div className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3 rounded-lg border border-slate-150 shadow-sm text-center">
          <span className="block text-[10px] uppercase font-bold text-emerald-500 tracking-wider">Total Sent</span>
          <span className="text-lg font-bold text-slate-800 font-mono">{stats.totalSent}</span>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-150 shadow-sm text-center">
          <span className="block text-[10px] uppercase font-bold text-rose-500 tracking-wider">Total Failed</span>
          <span className="text-lg font-bold text-slate-800 font-mono">{stats.totalFailed}</span>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-150 shadow-sm text-center col-span-2 sm:col-span-1">
          <span className="block text-[10px] uppercase font-bold text-indigo-500 tracking-wider">Avg Send Time</span>
          <span className="text-lg font-bold text-slate-800 font-mono">{stats.averageSendTime} <span className="text-xs font-normal">ms</span></span>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-150 shadow-sm text-center">
          <span className="block text-[10px] uppercase font-bold text-teal-500 tracking-wider">Fastest</span>
          <span className="text-lg font-bold text-slate-800 font-mono">{stats.fastestSendTime} <span className="text-xs font-normal">ms</span></span>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-150 shadow-sm text-center">
          <span className="block text-[10px] uppercase font-bold text-amber-500 tracking-wider">Slowest</span>
          <span className="text-lg font-bold text-slate-800 font-mono">{stats.slowestSendTime} <span className="text-xs font-normal">ms</span></span>
        </div>
      </div>

      {/* Header and Actions */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Transmission Log History</h2>
          <p className="text-xs text-slate-500">Historical performance metrics of all attempts</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
            disabled={logs.length === 0}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded transition-colors disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            onClick={handleExportJson}
            disabled={logs.length === 0}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded transition-colors disabled:opacity-50"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No transmission logs recorded yet.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-150">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Sender</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Recipient</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Scheduled</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Start Time</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">End Time</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider max-w-[200px] truncate">Response/Error</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 text-xs">
                  <td className="px-4 py-1.5 font-medium text-slate-800 break-all">{log.sender_email}</td>
                  <td className="px-4 py-1.5 text-slate-600 break-all">{log.recipient}</td>
                  <td className="px-4 py-1.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      log.status === 'SUCCESS' ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' : 'bg-rose-50 border border-rose-100 text-rose-800'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-1.5 text-slate-500 font-mono hidden md:table-cell">
                    {log.scheduled_time ? formatDateTime(log.scheduled_time) + '.' + String(new Date(log.scheduled_time).getMilliseconds()).padStart(3, '0') : 'N/A'}
                  </td>
                  <td className="px-4 py-1.5 text-slate-500 font-mono hidden lg:table-cell">
                    {formatTimeWithMs(log.start_time)}
                  </td>
                  <td className="px-4 py-1.5 text-slate-500 font-mono hidden lg:table-cell">
                    {formatTimeWithMs(log.end_time)}
                  </td>
                  <td className="px-4 py-1.5 text-slate-700 font-mono font-semibold">
                    {log.duration} ms
                  </td>
                  <td className="px-4 py-1.5 text-slate-500 max-w-[200px] break-all leading-normal">
                    {log.status === 'SUCCESS' ? (
                      <span className="font-mono text-[10px]">{log.smtp_response}</span>
                    ) : (
                      <span className="text-rose-600 font-medium">{log.error_message}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
