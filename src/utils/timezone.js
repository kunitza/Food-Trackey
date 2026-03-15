const STORAGE_KEY = 'food-trackey-timezone'

/**
 * Get the browser's auto-detected timezone
 */
export function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'America/Chicago' // fallback
  }
}

/**
 * Get the user's effective timezone (override or auto-detected)
 */
export function getEffectiveTimezone() {
  try {
    const override = localStorage.getItem(STORAGE_KEY)
    if (override) return override
  } catch {
    // localStorage unavailable
  }
  return detectTimezone()
}

/**
 * Set a timezone override
 */
export function setTimezoneOverride(tz) {
  try {
    if (tz) {
      localStorage.setItem(STORAGE_KEY, tz)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // localStorage unavailable
  }
}

/**
 * Get YYYY-MM-DD string for a Date in the effective timezone
 */
export function getLocalDateStr(date, tz) {
  const timezone = tz || getEffectiveTimezone()
  // en-CA locale gives YYYY-MM-DD format
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Common timezone list for the settings dropdown
 */
export const TIMEZONE_OPTIONS = [
  { value: '', label: 'Auto-detect' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HST)' },
  { value: 'America/Anchorage', label: 'Alaska (AKST)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PST/PDT)' },
  { value: 'America/Denver', label: 'Mountain (MST/MDT)' },
  { value: 'America/Chicago', label: 'Central (CST/CDT)' },
  { value: 'America/New_York', label: 'Eastern (EST/EDT)' },
  { value: 'America/Puerto_Rico', label: 'Atlantic (AST)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central Europe (CET/CEST)' },
  { value: 'Europe/Helsinki', label: 'Eastern Europe (EET/EEST)' },
  { value: 'Asia/Dubai', label: 'Gulf (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Australia/Sydney', label: 'Australia Eastern (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'New Zealand (NZST/NZDT)' },
]
