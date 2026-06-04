import React, { useState, useEffect } from 'react';
import { formatTimeWithMs, formatDateTime, formatCountdown } from '../utils/time.js';

export default function ScheduleConfig({
  serverTime, // current synchronized server epoch
  localTime,  // current local epoch
  activeTask, // active task details from backend
  onSchedule,
  onCancel,
  hasAccounts
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [second, setSecond] = useState('00');
  const [millisecond, setMillisecond] = useState('000');
  
  const [targetPreview, setTargetPreview] = useState(null);
  const [countdownMs, setCountdownMs] = useState(0);

  // Initialize input dates to today/tomorrow
  useEffect(() => {
    const today = new Date(serverTime || Date.now());
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    setDate(`${y}-${m}-${d}`);

    // Set time to next hour rounded
    const nextHour = new Date(today.getTime() + 60 * 60 * 1000);
    const hh = String(nextHour.getHours()).padStart(2, '0');
    setTime(`${hh}:00`);
  }, []);

  // Recalculate target preview when inputs change
  useEffect(() => {
    if (!date || !time) {
      setTargetPreview(null);
      return;
    }

    const secVal = parseInt(second, 10) || 0;
    const msVal = parseInt(millisecond, 10) || 0;
    
    // Parse Date and Time (HH:MM)
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);

    const targetDate = new Date(year, month - 1, day, hour, minute, secVal, msVal);
    setTargetPreview(targetDate.getTime());
  }, [date, time, second, millisecond]);

  // Update countdown live based on synchronized server time
  useEffect(() => {
    if (!activeTask || activeTask.status !== 'scheduled' || !activeTask.scheduledTime) {
      setCountdownMs(0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = activeTask.scheduledTime - (serverTime || Date.now());
      if (remaining <= 0) {
        setCountdownMs(0);
        clearInterval(interval);
      } else {
        setCountdownMs(remaining);
      }
    }, 33); // ~30 fps update rate for smooth millisecond countdowns

    return () => clearInterval(interval);
  }, [activeTask, serverTime]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!targetPreview) return;

    if (targetPreview <= (serverTime || Date.now())) {
      alert("Scheduled time must be in the future.");
      return;
    }

    onSchedule(new Date(targetPreview).toISOString());
  };

  const isTaskScheduled = activeTask && (activeTask.status === 'scheduled' || activeTask.status === 'pre-warming');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-base font-semibold text-slate-900">Schedule Configuration</h2>
        <p className="text-xs text-slate-500">Configure exact millisecond trigger times</p>
      </div>

      <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
        
        {/* Time Clocks Display */}
        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Local Time</span>
            <span className="text-sm font-mono font-semibold text-slate-700">
              {formatTimeWithMs(localTime)}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
              Server Time
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            </span>
            <span className="text-sm font-mono font-semibold text-indigo-700">
              {formatTimeWithMs(serverTime)}
            </span>
          </div>
        </div>

        {/* Countdown Area */}
        {isTaskScheduled && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-center">
            <span className="block text-[10px] uppercase font-bold text-indigo-500 tracking-wider">Countdown to Scheduled Send</span>
            <span className="text-xl font-mono font-bold text-indigo-700 select-none">
              {formatCountdown(countdownMs)}
            </span>
            <div className="mt-2 text-xs text-indigo-600">
              Target: <span className="font-mono font-semibold">{formatDateTime(activeTask.scheduledTime)}.{String(new Date(activeTask.scheduledTime).getMilliseconds()).padStart(3, '0')}</span>
            </div>
            <button
              onClick={onCancel}
              className="mt-2.5 px-3 py-1 text-xs font-semibold text-rose-600 border border-rose-200 bg-white rounded-md hover:bg-rose-50 transition-colors shadow-sm"
            >
              Cancel Scheduled Task
            </button>
          </div>
        )}

        {/* Scheduler Form */}
        {!isTaskScheduled && (
          <form onSubmit={handleSubmit} className="space-y-3 flex-1 flex flex-col justify-start">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-0.5">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-0.5">Time (HH:MM)</label>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-0.5">Seconds (0-59)</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={second}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') setSecond('');
                    else setSecond(String(Math.min(59, Math.max(0, parseInt(val, 10)))).padStart(2, '0'));
                  }}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-0.5">Milliseconds (0-999)</label>
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={millisecond}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') setMillisecond('');
                    else setMillisecond(String(Math.min(999, Math.max(0, parseInt(val, 10)))).padStart(3, '0'));
                  }}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Target Preview */}
            <div className="pt-2 border-t border-slate-100 flex-1 flex flex-col justify-end">
              <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Scheduled Target Time Preview</span>
              <div className="text-xs font-mono font-semibold text-slate-700 bg-slate-50 p-2 rounded border border-slate-100 break-all">
                {targetPreview ? (
                  <>
                    {formatDateTime(targetPreview)}.{String(new Date(targetPreview).getMilliseconds()).padStart(3, '0')}
                    {targetPreview <= (serverTime || Date.now()) && (
                      <span className="block text-rose-500 text-[10px] font-normal mt-0.5">⚠️ Time must be in the future</span>
                    )}
                  </>
                ) : (
                  'Fill in Date and Time inputs'
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={!hasAccounts || !targetPreview || targetPreview <= (serverTime || Date.now())}
              className="w-full py-2 px-4 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Schedule Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
