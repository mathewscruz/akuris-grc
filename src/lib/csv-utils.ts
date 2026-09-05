
import { formatarDiaParaDB } from '@/lib/date-utils';/**
 * Utility for CSV export with proper UTF-8 BOM for Excel compatibility
 */

/** Export user-controlled text as text, not a spreadsheet formula. */
export function spreadsheetText(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /^[\s]*[=+@-]/.test(text) || /^[\t\r]/.test(text) ? `'${text}` : text;
}

export function exportCSV(headers: string[], rows: (string | number | null | undefined)[][], filename: string) {
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(cell => {
      const val = cell == null ? '' : String(cell);
      // Escape values containing semicolons, quotes, or newlines
      if (val.includes(';') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(';'))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${formatarDiaParaDB(new Date())}.csv`;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
