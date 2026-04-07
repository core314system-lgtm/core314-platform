import jsPDF from 'jspdf';

interface PdfSignalEntity {
  name: string;
  last_activity_type?: string;
  last_activity_date?: string;
  metric_value?: number;
}

interface PdfSignalEvidence {
  signal_type: string;
  source: string;
  severity: string;
  category: string;
  description: string;
  confidence: number;
  affected_entities: PdfSignalEntity[];
  summary_metrics: Record<string, unknown>;
}

interface PdfCrossSystemPattern {
  pattern_name: string;
  category: string;
  integrations: string[];
  combined_severity: string;
  signal_count: number;
}

interface PdfInterCategoryPattern {
  pattern_name: string;
  categories: string[];
  description: string;
  severity: string;
}

interface PdfFinancialImpact {
  overdue_total: number | null;
  revenue_at_risk: number | null;
  estimated_shortfall: number | null;
  open_pipeline_value: number | null;
  stalled_pipeline_value: number | null;
  expense_total: number | null;
  details: string[];
  gpt_analysis?: {
    summary?: string;
  } | null;
}

interface PdfForecast {
  horizon_7d: { risk_level: string; description: string };
  horizon_14d: { risk_level: string; description: string };
  horizon_30d: { risk_level: string; description: string };
  projected_health_score: number | null;
  trend_direction: string;
  key_risks: string[];
  gpt_analysis?: {
    seven_day?: string;
    fourteen_day?: string;
    thirty_day?: string;
    key_risks?: string[];
  } | null;
}

interface PdfRootCauseItem {
  cause: string;
  evidence: string[];
  affected_systems: string[];
  severity?: string;
}

interface PdfPrescriptiveAction {
  who: string;
  what: string;
  when: string;
  priority: string;
}

interface BriefPdfData {
  title: string;
  created_at: string;
  health_score: number | null;
  confidence: number;
  detected_signals: string[];
  business_impact: string;
  recommended_actions: string[] | PdfPrescriptiveAction[];
  risk_assessment: string;
  momentum?: {
    classification: string;
    delta: number;
    label: string;
  } | null;
  userName?: string;
  signal_evidence?: PdfSignalEvidence[];
  cross_system_patterns?: PdfCrossSystemPattern[];
  inter_category_patterns?: PdfInterCategoryPattern[];
  financial_impact?: PdfFinancialImpact;
  forecast?: PdfForecast;
  root_cause_analysis?: {
    programmatic?: PdfRootCauseItem[];
    gpt_analysis?: PdfRootCauseItem[];
  };
  prescriptive_actions?: string[] | PdfPrescriptiveAction[];
}

// Brand colors
const COLORS = {
  primary: [14, 165, 233] as [number, number, number],    // sky-500 #0ea5e9
  dark: [15, 23, 42] as [number, number, number],         // slate-900
  darkAlt: [30, 41, 59] as [number, number, number],      // slate-800
  text: [51, 65, 85] as [number, number, number],         // slate-700
  textLight: [100, 116, 139] as [number, number, number], // slate-500
  white: [255, 255, 255] as [number, number, number],
  green: [34, 197, 94] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  orange: [249, 115, 22] as [number, number, number],
  red: [239, 68, 68] as [number, number, number],
  divider: [226, 232, 240] as [number, number, number],   // slate-200
  bgLight: [248, 250, 252] as [number, number, number],   // slate-50
};

function getHealthColor(score: number | null): [number, number, number] {
  if (score === null) return COLORS.textLight;
  if (score >= 80) return COLORS.green;
  if (score >= 60) return COLORS.amber;
  if (score >= 40) return COLORS.orange;
  return COLORS.red;
}

function getHealthLabel(score: number | null): string {
  if (score === null) return 'Unknown';
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'At Risk';
  return 'Critical';
}

function getSignalSeverity(signal: string): 'high' | 'medium' | 'low' {
  const lower = signal.toLowerCase();
  if (lower.includes('critical') || lower.includes('no ') || lower.includes('inactivity') || lower.includes('stagnation') || lower.includes('overdue') || lower.includes('past due')) return 'high';
  if (lower.includes('drop') || lower.includes('decrease') || lower.includes('issue') || lower.includes('delay') || lower.includes('limited')) return 'medium';
  return 'low';
}

function getSeverityLabel(severity: 'high' | 'medium' | 'low'): string {
  switch (severity) {
    case 'high': return 'HIGH';
    case 'medium': return 'MEDIUM';
    case 'low': return 'LOW';
  }
}

function getSeverityColor(severity: 'high' | 'medium' | 'low'): [number, number, number] {
  switch (severity) {
    case 'high': return COLORS.red;
    case 'medium': return COLORS.amber;
    case 'low': return COLORS.green;
  }
}

function getMomentumLabel(classification: string): string {
  const labels: Record<string, string> = {
    'strong_improvement': 'Strong Improvement',
    'improving': 'Improving',
    'stable': 'Stable',
    'declining': 'Declining',
    'critical_decline': 'Critical Decline',
  };
  return labels[classification] || classification;
}

/**
 * Draw the Core314 logo mark (simplified hub icon) using PDF drawing primitives.
 */
function drawLogo(doc: jsPDF, x: number, y: number, size: number) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const outerR = size * 0.42;
  const nodeR = size * 0.065;
  const hubR = size * 0.16;
  const innerR = size * 0.08;

  // Draw 6 connection lines from center to outer nodes
  doc.setDrawColor(...COLORS.dark);
  doc.setLineWidth(0.4);
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 2) + (i * Math.PI / 3);
    const nx = cx + outerR * Math.cos(angle);
    const ny = cy - outerR * Math.sin(angle);
    doc.line(cx, cy, nx, ny);
  }

  // Draw 6 outer nodes
  doc.setFillColor(...COLORS.dark);
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 2) + (i * Math.PI / 3);
    const nx = cx + outerR * Math.cos(angle);
    const ny = cy - outerR * Math.sin(angle);
    doc.circle(nx, ny, nodeR, 'F');
  }

  // Central hub - sky blue ring
  doc.setFillColor(...COLORS.primary);
  doc.circle(cx, cy, hubR, 'F');

  // Inner dark circle
  doc.setFillColor(...COLORS.dark);
  doc.circle(cx, cy, innerR, 'F');
}

/**
 * Helper to wrap text and return lines array.
 */
function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth);
}

/**
 * Ensure we have enough space on the page, or add a new page.
 * Returns the current Y position (may be reset if new page added).
 */
function ensureSpace(doc: jsPDF, currentY: number, needed: number, marginBottom: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + needed > pageHeight - marginBottom) {
    doc.addPage();
    // Add subtle footer on new page
    addFooter(doc);
    return 32; // top margin on new pages
  }
  return currentY;
}

function addFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Divider line
  doc.setDrawColor(...COLORS.divider);
  doc.setLineWidth(0.3);
  doc.line(20, pageHeight - 16, pageWidth - 20, pageHeight - 16);

  // Footer text
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textLight);
  doc.setFont('helvetica', 'normal');
  doc.text('Generated by Core314  |  Operational Intelligence Platform', 20, pageHeight - 11);
  doc.text('CONFIDENTIAL', pageWidth - 20, pageHeight - 11, { align: 'right' });
}

/**
 * Draw a section header with a colored left accent bar.
 */
function drawSectionHeader(doc: jsPDF, title: string, y: number, marginLeft: number): number {
  // Accent bar
  doc.setFillColor(...COLORS.primary);
  doc.rect(marginLeft, y, 3, 6, 'F');

  // Title
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(title, marginLeft + 7, y + 5);

  return y + 14;
}

export function generateBriefPdf(data: BriefPdfData): void {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const marginLeft = 20;
    const marginRight = 20;
    const contentWidth = pageWidth - marginLeft - marginRight;
    let y = 0;

    // =============================================
    // HEADER BAR - Dark background with branding
    // =============================================
    doc.setFillColor(...COLORS.dark);
    doc.rect(0, 0, pageWidth, 38, 'F');

    // Logo
    drawLogo(doc, marginLeft - 2, 5, 28);

    // Title text
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.white);
    doc.text('Operational Intelligence Brief', marginLeft + 30, 17);

    // Subtitle
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.primary);
    doc.text('Core314', marginLeft + 30, 24);

    // Date & user info on right side
    const dateStr = new Date(data.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = new Date(data.created_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    doc.setFontSize(8);
    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'normal');
    doc.text(dateStr, pageWidth - marginRight, 14, { align: 'right' });
    doc.text(timeStr, pageWidth - marginRight, 19, { align: 'right' });
    if (data.userName) {
      doc.setTextColor(180, 190, 210);
      doc.text(`Prepared for: ${data.userName}`, pageWidth - marginRight, 26, { align: 'right' });
    }

    // Primary accent line below header
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 38, pageWidth, 1.2, 'F');

    y = 48;

    // =============================================
    // BRIEF TITLE
    // =============================================
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    const titleLines = wrapText(doc, data.title, contentWidth);
    doc.text(titleLines, marginLeft, y);
    y += titleLines.length * 7 + 4;

    // Confidence badge inline
    const confidenceLabel = data.confidence >= 80 ? 'High Confidence' : data.confidence >= 60 ? 'Moderate Confidence' : 'Low Confidence';
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textLight);
    doc.text(`Confidence: ${data.confidence}% (${confidenceLabel})`, marginLeft, y);
    y += 10;

    // Divider
    doc.setDrawColor(...COLORS.divider);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, y, pageWidth - marginRight, y);
    y += 8;

    // =============================================
    // SECTION 1: HEALTH OVERVIEW
    // =============================================
    y = ensureSpace(doc, y, 40, 25);
    y = drawSectionHeader(doc, 'HEALTH OVERVIEW', y, marginLeft);

    // Health score box
    const boxX = marginLeft;
    const boxW = 50;
    const boxH = 28;
    doc.setFillColor(...COLORS.bgLight);
    doc.roundedRect(boxX, y, boxW, boxH, 3, 3, 'F');

    // Score number - large and prominent
    const scoreColor = getHealthColor(data.health_score);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...scoreColor);
    doc.text(
      data.health_score !== null ? String(data.health_score) : '--',
      boxX + boxW / 2,
      y + 15,
      { align: 'center' }
    );

    // Score label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textLight);
    doc.text('/ 100', boxX + boxW / 2 + (data.health_score !== null ? 12 : 6), y + 15);

    // Health status label below score
    const healthLabel = getHealthLabel(data.health_score);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...scoreColor);
    doc.text(healthLabel, boxX + boxW / 2, y + 23, { align: 'center' });

    // Momentum indicator (right of health box)
    if (data.momentum) {
      const momX = boxX + boxW + 12;
      doc.setFillColor(...COLORS.bgLight);
      doc.roundedRect(momX, y, 60, boxH, 3, 3, 'F');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.textLight);
      doc.text('MOMENTUM', momX + 30, y + 8, { align: 'center' });

      const momLabel = getMomentumLabel(data.momentum.classification);
      const deltaStr = `${data.momentum.delta >= 0 ? '+' : ''}${data.momentum.delta}`;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      const momColor = data.momentum.delta >= 0 ? COLORS.green : data.momentum.delta < -5 ? COLORS.red : COLORS.amber;
      doc.setTextColor(...momColor);
      doc.text(momLabel, momX + 30, y + 17, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.textLight);
      doc.text(deltaStr, momX + 30, y + 23, { align: 'center' });
    }

    y += boxH + 10;

    // =============================================
    // SECTION 2: KEY SIGNALS
    // =============================================
    y = ensureSpace(doc, y, 30, 25);
    y = drawSectionHeader(doc, 'KEY SIGNALS', y, marginLeft);

    if (data.signal_evidence && data.signal_evidence.length > 0) {
      // Rich signal evidence rendering
      for (let si = 0; si < data.signal_evidence.length; si++) {
        const ev = data.signal_evidence[si];
        const sevLabel = getSeverityLabel(ev.severity === 'critical' || ev.severity === 'high' ? 'high' : ev.severity === 'medium' ? 'medium' : 'low');
        const sevColor = getSeverityColor(ev.severity === 'critical' || ev.severity === 'high' ? 'high' : ev.severity === 'medium' ? 'medium' : 'low');

        y = ensureSpace(doc, y, 20, 25);

        // Severity badge
        const badgeW = 16;
        doc.setFillColor(...sevColor);
        doc.roundedRect(marginLeft, y - 3, badgeW, 5, 1, 1, 'F');
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.white);
        doc.text(sevLabel, marginLeft + badgeW / 2, y + 0.5, { align: 'center' });

        // Source + category label
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.textLight);
        doc.text(`${ev.source.replace(/_/g, ' ').toUpperCase()} · ${ev.category.replace(/_/g, ' ')}`, marginLeft + badgeW + 4, y - 1);

        // Signal description text (prefer GPT narrative if available)
        const signalText = data.detected_signals[si] || ev.description;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);
        const signalLines = wrapText(doc, signalText, contentWidth - badgeW - 6);
        doc.text(signalLines, marginLeft + badgeW + 4, y + 4);
        y += signalLines.length * 4.5 + 5;

        // Affected entities (bullet list)
        if (ev.affected_entities.length > 0) {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COLORS.textLight);
          y = ensureSpace(doc, y, 6, 25);
          doc.text('Affected Items:', marginLeft + badgeW + 4, y);
          y += 4;

          for (const ent of ev.affected_entities.slice(0, 10)) {
            y = ensureSpace(doc, y, 5, 25);
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...COLORS.text);
            let entLine = `\u2022  ${ent.name}`;
            if (ent.last_activity_type) entLine += ` \u2014 ${ent.last_activity_type}`;
            if (ent.last_activity_date) {
              const d = new Date(ent.last_activity_date);
              entLine += ` (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
            }
            const entLines = wrapText(doc, entLine, contentWidth - badgeW - 10);
            doc.text(entLines, marginLeft + badgeW + 8, y);
            y += entLines.length * 3.5 + 1;
          }
          y += 2;
        }

        // Summary metrics as inline tags
        const metricKeys = Object.keys(ev.summary_metrics);
        if (metricKeys.length > 0) {
          y = ensureSpace(doc, y, 6, 25);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.textLight);
          const metricsStr = metricKeys.slice(0, 5).map(k => {
            const v = ev.summary_metrics[k];
            return `${k.replace(/_/g, ' ')}: ${typeof v === 'number' ? v.toLocaleString() : String(v)}`;
          }).join('  |  ');
          const metricLines = wrapText(doc, metricsStr, contentWidth - badgeW - 6);
          doc.text(metricLines, marginLeft + badgeW + 4, y);
          y += metricLines.length * 3.5 + 2;
        }

        y += 3;
      }
    } else if (data.detected_signals && data.detected_signals.length > 0) {
      // Fallback: plain text signals for older briefs
      for (const signal of data.detected_signals) {
        y = ensureSpace(doc, y, 14, 25);

        const severity = getSignalSeverity(signal);
        const sevLabel = getSeverityLabel(severity);
        const sevColor = getSeverityColor(severity);

        const badgeW = 16;
        doc.setFillColor(...sevColor);
        doc.roundedRect(marginLeft, y - 3, badgeW, 5, 1, 1, 'F');
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.white);
        doc.text(sevLabel, marginLeft + badgeW / 2, y + 0.5, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);
        const signalLines = wrapText(doc, signal, contentWidth - badgeW - 6);
        doc.text(signalLines, marginLeft + badgeW + 4, y);
        y += signalLines.length * 4.5 + 4;
      }
    } else {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...COLORS.textLight);
      doc.text('No signals detected.', marginLeft, y);
      y += 8;
    }

    y += 4;

    // =============================================
    // SECTION 2B: CROSS-SYSTEM PATTERNS
    // =============================================
    const hasPatterns = (data.cross_system_patterns && data.cross_system_patterns.length > 0) ||
      (data.inter_category_patterns && data.inter_category_patterns.length > 0);
    if (hasPatterns) {
      y = ensureSpace(doc, y, 30, 25);
      y = drawSectionHeader(doc, 'CROSS-SYSTEM PATTERNS', y, marginLeft);

      if (data.cross_system_patterns) {
        for (const p of data.cross_system_patterns) {
          y = ensureSpace(doc, y, 14, 25);
          const sevColor = p.combined_severity === 'critical' ? COLORS.red : p.combined_severity === 'high' ? COLORS.orange : COLORS.amber;
          doc.setFillColor(...sevColor);
          doc.roundedRect(marginLeft, y - 3, 16, 5, 1, 1, 'F');
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COLORS.white);
          doc.text(p.combined_severity.toUpperCase(), marginLeft + 8, y + 0.5, { align: 'center' });

          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.text);
          const patternText = `${p.category.replace(/_/g, ' ')} — Detected across ${p.integrations.join(', ').replace(/_/g, ' ')} (${p.signal_count} signals)`;
          const pLines = wrapText(doc, patternText, contentWidth - 22);
          doc.text(pLines, marginLeft + 20, y);
          y += pLines.length * 4.5 + 4;
        }
      }

      if (data.inter_category_patterns) {
        for (const p of data.inter_category_patterns) {
          y = ensureSpace(doc, y, 14, 25);
          const sevColor = p.severity === 'critical' ? COLORS.red : p.severity === 'high' ? COLORS.orange : COLORS.amber;
          doc.setFillColor(...sevColor);
          doc.roundedRect(marginLeft, y - 3, 16, 5, 1, 1, 'F');
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COLORS.white);
          doc.text(p.severity.toUpperCase(), marginLeft + 8, y + 0.5, { align: 'center' });

          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COLORS.dark);
          doc.text(p.pattern_name, marginLeft + 20, y);
          y += 5;

          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.text);
          const descLines = wrapText(doc, p.description, contentWidth - 22);
          doc.text(descLines, marginLeft + 20, y);
          y += descLines.length * 4 + 4;
        }
      }
      y += 4;
    }

    // =============================================
    // SECTION 2C: FINANCIAL IMPACT
    // =============================================
    if (data.financial_impact && data.financial_impact.details && data.financial_impact.details.length > 0) {
      y = ensureSpace(doc, y, 30, 25);
      y = drawSectionHeader(doc, 'FINANCIAL IMPACT', y, marginLeft);

      if (data.financial_impact.gpt_analysis?.summary) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);
        const summaryLines = wrapText(doc, data.financial_impact.gpt_analysis.summary, contentWidth);
        doc.text(summaryLines, marginLeft, y);
        y += summaryLines.length * 4.5 + 4;
      }

      // Financial metrics row
      const metrics: Array<{ label: string; value: string; color: [number, number, number] }> = [];
      if (data.financial_impact.revenue_at_risk != null) metrics.push({ label: 'Revenue at Risk', value: `$${data.financial_impact.revenue_at_risk.toLocaleString()}`, color: COLORS.red });
      if (data.financial_impact.overdue_total != null) metrics.push({ label: 'Overdue Total', value: `$${data.financial_impact.overdue_total.toLocaleString()}`, color: COLORS.orange });
      if (data.financial_impact.estimated_shortfall != null) metrics.push({ label: 'Collection Shortfall', value: `$${data.financial_impact.estimated_shortfall.toLocaleString()}`, color: COLORS.amber });
      if (data.financial_impact.open_pipeline_value != null) metrics.push({ label: 'Open Pipeline', value: `$${data.financial_impact.open_pipeline_value.toLocaleString()}`, color: COLORS.primary });

      if (metrics.length > 0) {
        const metricW = Math.min(40, (contentWidth - (metrics.length - 1) * 4) / metrics.length);
        for (let mi = 0; mi < metrics.length; mi++) {
          const mx = marginLeft + mi * (metricW + 4);
          y = ensureSpace(doc, y, 18, 25);
          doc.setFillColor(...COLORS.bgLight);
          doc.roundedRect(mx, y, metricW, 16, 2, 2, 'F');
          doc.setFontSize(6);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.textLight);
          doc.text(metrics[mi].label, mx + metricW / 2, y + 5, { align: 'center' });
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...metrics[mi].color);
          doc.text(metrics[mi].value, mx + metricW / 2, y + 12, { align: 'center' });
        }
        y += 20;
      }

      // Detail lines
      for (const detail of data.financial_impact.details) {
        y = ensureSpace(doc, y, 6, 25);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);
        const dLines = wrapText(doc, `\u2022  ${detail}`, contentWidth - 4);
        doc.text(dLines, marginLeft + 4, y);
        y += dLines.length * 3.5 + 2;
      }
      y += 4;
    }

    // =============================================
    // SECTION 2D: RISK FORECAST
    // =============================================
    if (data.forecast) {
      y = ensureSpace(doc, y, 30, 25);
      y = drawSectionHeader(doc, 'RISK FORECAST', y, marginLeft);

      const horizons = [
        { label: '7-Day', data: data.forecast.horizon_7d, gpt: data.forecast.gpt_analysis?.seven_day },
        { label: '14-Day', data: data.forecast.horizon_14d, gpt: data.forecast.gpt_analysis?.fourteen_day },
        { label: '30-Day', data: data.forecast.horizon_30d, gpt: data.forecast.gpt_analysis?.thirty_day },
      ];

      const colW = (contentWidth - 8) / 3;
      for (let hi = 0; hi < horizons.length; hi++) {
        const hx = marginLeft + hi * (colW + 4);
        const riskColor = horizons[hi].data.risk_level === 'critical' ? COLORS.red
          : horizons[hi].data.risk_level === 'high' ? COLORS.orange
          : horizons[hi].data.risk_level === 'medium' ? COLORS.amber
          : COLORS.green;

        y = ensureSpace(doc, y, 22, 25);
        doc.setFillColor(...COLORS.bgLight);
        doc.roundedRect(hx, y, colW, 20, 2, 2, 'F');

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.textLight);
        doc.text(horizons[hi].label, hx + colW / 2, y + 5, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...riskColor);
        doc.text(horizons[hi].data.risk_level.toUpperCase(), hx + colW / 2, y + 13, { align: 'center' });
      }
      y += 24;

      // Forecast description text
      const forecastDesc = horizons.map(h => `${h.label}: ${h.gpt || h.data.description}`).filter(s => s.length > 8);
      for (const fd of forecastDesc) {
        y = ensureSpace(doc, y, 6, 25);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);
        const fdLines = wrapText(doc, fd, contentWidth);
        doc.text(fdLines, marginLeft, y);
        y += fdLines.length * 3.5 + 2;
      }

      if (data.forecast.key_risks && data.forecast.key_risks.length > 0) {
        y += 2;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.textLight);
        y = ensureSpace(doc, y, 6, 25);
        doc.text('Key Projected Risks:', marginLeft, y);
        y += 4;
        for (const risk of data.forecast.key_risks) {
          y = ensureSpace(doc, y, 5, 25);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.text);
          const rLines = wrapText(doc, `\u2022  ${risk}`, contentWidth - 4);
          doc.text(rLines, marginLeft + 4, y);
          y += rLines.length * 3.5 + 2;
        }
      }
      y += 4;
    }

    // =============================================
    // SECTION 2E: ROOT CAUSE ANALYSIS
    // =============================================
    const rootCauses = data.root_cause_analysis?.gpt_analysis?.length
      ? data.root_cause_analysis.gpt_analysis
      : data.root_cause_analysis?.programmatic || [];
    if (rootCauses.length > 0) {
      y = ensureSpace(doc, y, 30, 25);
      y = drawSectionHeader(doc, 'ROOT CAUSE ANALYSIS', y, marginLeft);

      for (const rc of rootCauses) {
        y = ensureSpace(doc, y, 16, 25);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.dark);
        doc.text(rc.cause, marginLeft, y);
        if (rc.severity) {
          const sevColor = rc.severity === 'critical' ? COLORS.red : rc.severity === 'high' ? COLORS.orange : COLORS.amber;
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...sevColor);
          doc.text(` [${rc.severity.toUpperCase()}]`, marginLeft + doc.getTextWidth(rc.cause) + 2, y);
        }
        y += 5;

        for (const ev of rc.evidence) {
          y = ensureSpace(doc, y, 5, 25);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.text);
          const evLines = wrapText(doc, `- ${ev}`, contentWidth - 6);
          doc.text(evLines, marginLeft + 4, y);
          y += evLines.length * 3.5 + 1;
        }

        if (rc.affected_systems.length > 0) {
          y = ensureSpace(doc, y, 5, 25);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.primary);
          doc.text(`Systems: ${rc.affected_systems.join(', ')}`, marginLeft + 4, y);
          y += 5;
        }
        y += 2;
      }
      y += 4;
    }

    // =============================================
    // SECTION 3: OPERATIONAL ANALYSIS
    // =============================================
    y = ensureSpace(doc, y, 30, 25);
    y = drawSectionHeader(doc, 'OPERATIONAL ANALYSIS', y, marginLeft);

    if (data.business_impact) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.text);

      // Split by paragraphs first, then wrap each
      const paragraphs = data.business_impact.split(/\n+/);
      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        y = ensureSpace(doc, y, 12, 25);
        const lines = wrapText(doc, trimmed, contentWidth);
        doc.text(lines, marginLeft, y);
        y += lines.length * 4.5 + 3;
      }
    }

    y += 4;

    // =============================================
    // SECTION 4: PRESCRIPTIVE ACTIONS
    // =============================================
    const pActions = data.prescriptive_actions || data.recommended_actions || [];
    if (pActions && pActions.length > 0) {
      y = ensureSpace(doc, y, 30, 25);
      y = drawSectionHeader(doc, 'PRESCRIPTIVE ACTIONS', y, marginLeft);

      const isStructured = pActions.length > 0 && typeof pActions[0] === 'object' && pActions[0] !== null && 'what' in pActions[0];

      if (isStructured) {
        const structuredActions = pActions as PdfPrescriptiveAction[];
        for (let i = 0; i < structuredActions.length; i++) {
          const action = structuredActions[i];
          y = ensureSpace(doc, y, 20, 25);

          // Number circle
          const circleR = 3;
          doc.setFillColor(...COLORS.primary);
          doc.circle(marginLeft + circleR, y - 0.5, circleR, 'F');
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COLORS.white);
          doc.text(String(i + 1), marginLeft + circleR, y + 0.8, { align: 'center' });

          // WHAT
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COLORS.dark);
          const whatLines = wrapText(doc, action.what, contentWidth - 12);
          doc.text(whatLines, marginLeft + 10, y);
          y += whatLines.length * 4.5 + 2;

          // WHO / WHEN / PRIORITY line
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.textLight);
          const metaLine = `WHO: ${action.who}  |  WHEN: ${action.when}  |  PRIORITY: ${action.priority.toUpperCase()}`;
          doc.text(metaLine, marginLeft + 10, y);
          y += 6;
        }
      } else {
        const stringActions = pActions as string[];
        for (let i = 0; i < stringActions.length; i++) {
          const action = stringActions[i];
          y = ensureSpace(doc, y, 14, 25);

          const circleR = 3;
          doc.setFillColor(...COLORS.primary);
          doc.circle(marginLeft + circleR, y - 0.5, circleR, 'F');
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COLORS.white);
          doc.text(String(i + 1), marginLeft + circleR, y + 0.8, { align: 'center' });

          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.text);
          const actionText = typeof action === 'string' ? action : JSON.stringify(action);
          const actionLines = wrapText(doc, actionText, contentWidth - 12);
          doc.text(actionLines, marginLeft + 10, y);
          y += actionLines.length * 4.5 + 4;
        }
      }

      y += 4;
    }

    // =============================================
    // SECTION 5: RISK ASSESSMENT
    // =============================================
    if (data.risk_assessment) {
      y = ensureSpace(doc, y, 30, 25);
      y = drawSectionHeader(doc, 'RISK ASSESSMENT', y, marginLeft);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.text);

      const paragraphs = data.risk_assessment.split(/\n+/);
      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        y = ensureSpace(doc, y, 12, 25);
        const lines = wrapText(doc, trimmed, contentWidth);
        doc.text(lines, marginLeft, y);
        y += lines.length * 4.5 + 3;
      }
    }

    // =============================================
    // FOOTER on all pages
    // =============================================
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter(doc);

      // Page number
      const ph = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.textLight);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, ph - 11, { align: 'center' });
    }

    // =============================================
    // SAVE
    // =============================================
    const dateForFile = new Date(data.created_at).toISOString().split('T')[0];
    doc.save(`Core314_Brief_${dateForFile}.pdf`);
  } catch (err) {
    console.error('Failed to generate PDF:', err);
    throw new Error('Failed to generate PDF. Please try again.');
  }
}
