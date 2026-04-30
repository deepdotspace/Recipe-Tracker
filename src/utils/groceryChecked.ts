/**
 * Grocery `checked` is stored as text; `false` serializes to "false", which is truthy in JS.
 * Normalize any persisted shape to a real boolean for UI and toggles.
 */
export function isGroceryChecked(raw: unknown): boolean {
  if (raw === true || raw === 1) return true
  if (raw === false || raw === 0 || raw == null) return false
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase()
    if (s === 'true' || s === '1' || s === 'yes') return true
    if (s === 'false' || s === '0' || s === 'no' || s === '') return false
  }
  return false
}
