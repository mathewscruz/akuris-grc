import jsPDF from 'jspdf';
import { formatStatus } from '@/lib/text-utils';
import { intlLocale } from '@/lib/date-utils';

// Akuris brand colors
export const AKURIS_COLORS = {
  primary: '#7552ff',
  primaryDark: '#5a3fd6',
  dark: '#0a1628',
  darkNav: '#111827',
  text: '#1e293b',
  textLight: '#64748b',
  border: '#e2e8f0',
  background: '#f8fafc',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  white: '#ffffff',
};

/**
 * Format any raw database label (e.g. seguranca_informacao) to human-readable text
 */
export function formatLabel(text: string): string {
  if (!text) return '';
  return formatStatus(text);
}

/**
 * Load Akuris logo as base64 data URL for embedding in PDFs
 */
export async function loadAkurisLogo(): Promise<string | null> {
  try {
    const response = await fetch('/akuris-logo.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Add Akuris branded header with logo + gradient line to PDF
 * Returns new Y position after header
 */
export function addAkurisHeader(doc: jsPDF, logoBase64: string | null, y: number = 10): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Dark navy header background
  doc.setFillColor(AKURIS_COLORS.dark);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Logo
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 14, 8, 36, 12);
    } catch {
      // fallback: text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(AKURIS_COLORS.white);
      doc.text('Akuris', 14, 18);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(AKURIS_COLORS.white);
    doc.text('Akuris', 14, 18);
  }

  // Subtitle on header
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 220);
  doc.text('Plataforma GRC', pageWidth - 14, 18, { align: 'right' });

  // Gradient line (simulated with two-color segments)
  doc.setFillColor(AKURIS_COLORS.primary);
  doc.rect(0, 28, pageWidth * 0.6, 2, 'F');
  doc.setFillColor(AKURIS_COLORS.primaryDark);
  doc.rect(pageWidth * 0.6, 28, pageWidth * 0.4, 2, 'F');

  return 38;
}

/**
 * Add Akuris branded footer to all pages
 */
export function addAkurisFooter(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer line
    doc.setDrawColor(AKURIS_COLORS.border);
    doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(AKURIS_COLORS.textLight);
    doc.text('Akuris - Plataforma GRC', 14, pageHeight - 10);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text(
      new Date().toLocaleDateString(intlLocale()) + ' às ' + new Date().toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit' }),
      pageWidth - 14, pageHeight - 10, { align: 'right' }
    );
  }
}

/**
 * Add a cover page with Akuris branding
 */
export function addAkurisCover(doc: jsPDF, logoBase64: string | null, title: string, subtitle: string, meta?: { empresa?: string; data?: string }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Full dark background
  doc.setFillColor(AKURIS_COLORS.dark);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Accent stripe
  doc.setFillColor(AKURIS_COLORS.primary);
  doc.rect(0, 0, 6, pageHeight, 'F');

  // Logo
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 30, 40, 60, 20);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.setTextColor(AKURIS_COLORS.white);
      doc.text('Akuris', 30, 60);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(AKURIS_COLORS.white);
    doc.text('Akuris', 30, 60);
  }

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(AKURIS_COLORS.white);
  const titleLines = doc.splitTextToSize(title, pageWidth - 60);
  doc.text(titleLines, 30, 110);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(180, 180, 220);
  if (subtitle) {
    const subLines = doc.splitTextToSize(subtitle, pageWidth - 60);
    doc.text(subLines, 30, 110 + titleLines.length * 12 + 10);
  }

  // Meta info
  const metaY = pageHeight - 60;
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 180);

  if (meta?.empresa) {
    doc.text(`Empresa: ${meta.empresa}`, 30, metaY);
  }
  doc.text(`Gerado em: ${meta?.data || new Date().toLocaleDateString(intlLocale())}`, 30, metaY + 8);

  // Bottom gradient line
  doc.setFillColor(AKURIS_COLORS.primary);
  doc.rect(0, pageHeight - 4, pageWidth * 0.6, 4, 'F');
  doc.setFillColor(AKURIS_COLORS.primaryDark);
  doc.rect(pageWidth * 0.6, pageHeight - 4, pageWidth * 0.4, 4, 'F');
}

/**
 * Draw a section title with Akuris brand accent bar
 */
export function addSectionTitle(doc: jsPDF, title: string, y: number, margin: number = 20): number {
  doc.setFillColor(AKURIS_COLORS.primary);
  doc.rect(margin, y, 4, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(AKURIS_COLORS.text);
  doc.text(title, margin + 8, y + 6);
  return y + 15;
}

/**
 * Draw a horizontal progress bar
 */
export function drawProgressBar(doc: jsPDF, x: number, y: number, width: number, height: number, percent: number, color: string = AKURIS_COLORS.primary) {
  // Background
  doc.setFillColor(AKURIS_COLORS.border);
  doc.roundedRect(x, y, width, height, 1, 1, 'F');
  // Fill
  if (percent > 0) {
    doc.setFillColor(color);
    doc.roundedRect(x, y, Math.max(width * (percent / 100), 2), height, 1, 1, 'F');
  }
}

/**
 * Draw a table header row with Akuris styling
 */
export function drawTableHeader(doc: jsPDF, headers: { text: string; x: number }[], y: number, margin: number = 20, contentWidth: number = 170) {
  doc.setFillColor(AKURIS_COLORS.primary);
  doc.rect(margin, y - 5, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(AKURIS_COLORS.white);
  headers.forEach(h => {
    doc.text(h.text, h.x, y);
  });
}
