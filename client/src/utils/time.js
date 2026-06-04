/**
 * Formats a date or timestamp to HH:MM:SS.mmm format.
 */
export function formatTimeWithMs(time) {
  if (!time) return '--:--:--.---';
  const date = new Date(time);
  if (isNaN(date.getTime())) return '--:--:--.---';
  
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  
  return `${h}:${m}:${s}.${ms}`;
}

/**
 * Formats a date or timestamp to YYYY-MM-DD HH:MM:SS format.
 */
export function formatDateTime(time) {
  if (!time) return 'N/A';
  const date = new Date(time);
  if (isNaN(date.getTime())) return 'N/A';
  
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  
  return `${y}-${mo}-${d} ${h}:${m}:${s}`;
}

/**
 * Formats milliseconds remaining into HH:MM:SS.mmm countdown string.
 */
export function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00.000';
  
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor(ms % 1000);
  
  const hStr = String(hours).padStart(2, '0');
  const mStr = String(minutes).padStart(2, '0');
  const sStr = String(seconds).padStart(2, '0');
  const msStr = String(milliseconds).padStart(3, '0');
  
  return `${hStr}:${mStr}:${sStr}.${msStr}`;
}
