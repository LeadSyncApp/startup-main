/**
 * Formatting utilities - Industry-agnostic
 * Currency: ₹ (default). Placeholder for other currencies via formatCurrency(amount, 'USD').
 * Dates: DD/MM/YYYY (Indian format)
 */

/** Format number as Indian Rupees (₹). Default; use formatCurrency for other currencies */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format amount in any currency. Replace with company settings: currency from supabase companies table */
export function formatCurrency(amount: number, currencyCode: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format large amounts in lakhs/crores for readability (₹ default) */
export function formatINRCompact(amount: number): string {
  if (amount >= 1_00_00_000) {
    return `₹${(amount / 1_00_00_000).toFixed(1)} Cr`;
  }
  if (amount >= 1_00_000) {
    return `₹${(amount / 1_00_000).toFixed(1)} L`;
  }
  return formatINR(amount);
}

/** Format date as DD/MM/YYYY (Indian format) */
export function formatDateIN(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
