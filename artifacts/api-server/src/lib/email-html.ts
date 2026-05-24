/**
 * HTML email builder — fully white-label, zero platform branding.
 *
 * Design principles:
 *  - ZERO hardcoded company names, ZERO platform footers
 *  - Company info only appears when row.company_name is provided
 *  - Signature NEVER injected unless useSignatureBuilder === true
 *  - Table-based layout, inline CSS only, Arial/Helvetica fonts
 *  - Compatible with Gmail, Outlook, Apple Mail, Yahoo, mobile
 */

export type EmailStyle = "clean" | "modern" | "minimal" | "luxury";

export interface EmailBuildOptions {
  style?: EmailStyle;
  useSignatureBuilder?: boolean;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

export function formatPrice(val: string): string {
  const trimmed = (val ?? "").trim();
  if (!trimmed) return trimmed;
  if (/^\$/.test(trimmed)) return trimmed;
  const cleaned = trimmed.replace(/[,\s]/g, "");
  const num = parseFloat(cleaned);
  if (!isNaN(num) && cleaned !== "") {
    return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return trimmed;
}

export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain-text variable replacement — formats price, leaves others as-is. */
export function replaceVarsText(text: string, row: Record<string, string>): string {
  return text.replace(/\{([^}]+)\}/g, (match, key) => {
    const k = key.trim();
    const val = row[k];
    if (val == null) return match;
    return k === "price" ? formatPrice(val) : val;
  });
}

/** HTML variable replacement — applies visual emphasis on key transport fields. */
function replaceVarsHtml(text: string, row: Record<string, string>): string {
  return text.replace(/\{([^}]+)\}/g, (match, key) => {
    const k = key.trim();
    const raw = row[k];
    if (raw == null) return `<span style="color:#ef4444;font-style:italic;">${match}</span>`;
    const val = k === "price" ? formatPrice(raw) : raw;
    const esc = escapeHtml(val);
    if (k === "price") return `<strong style="color:#059669;font-size:16px;">${esc}</strong>`;
    if (["vehicle", "pickup", "delivery", "route"].includes(k)) return `<strong>${esc}</strong>`;
    if (k === "name") return `<strong>${esc}</strong>`;
    return esc;
  });
}

/**
 * Convert plain-text paragraphs to HTML.
 * Double line-breaks = new paragraph; single = <br>.
 * Email-safe: only inline styles, no class attributes.
 */
function textToHtmlParagraphs(text: string, fontFamily: string, color: string): string {
  return text
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(para =>
      `<p style="margin:0 0 16px;font-family:${fontFamily};color:${color};font-size:15px;line-height:1.75;">${
        para.trim().replace(/\n/g, "<br>")
      }</p>`
    )
    .join("");
}

/**
 * Optional signature block — only called when useSignatureBuilder === true.
 * Draws from row variables: agent_name, company_name, company_phone,
 * company_website, usdot, mc_number.
 */
function buildSignatureHtml(row: Record<string, string>, borderColor: string, fontFamily: string): string {
  const name    = escapeHtml(row.agent_name ?? "");
  const company = escapeHtml(row.company_name ?? "");
  const phone   = escapeHtml(row.company_phone ?? row.phone ?? "");
  const website = escapeHtml(row.company_website ?? "");
  const usdot   = escapeHtml(row.usdot ?? "");
  const mc      = escapeHtml(row.mc_number ?? "");

  if (!name && !company) return "";

  const lines: string[] = [];
  if (name)    lines.push(`<strong style="color:#1e293b;">${name}</strong>`);
  if (company) lines.push(company);
  if (phone)   lines.push(phone);
  if (website) lines.push(`<a href="https://${website}" style="color:#2563eb;text-decoration:none;">${website}</a>`);
  if (usdot)   lines.push(`USDOT #${usdot}`);
  if (mc)      lines.push(`MC #${mc}`);

  return `<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${borderColor};font-family:${fontFamily};color:#64748b;font-size:13px;line-height:2.0;">Best regards,<br>${lines.join("<br>")}</p>`;
}

// ─── Master builder ───────────────────────────────────────────────────────────

export function buildHtmlEmail(
  body: string,
  row: Record<string, string>,
  options: EmailBuildOptions = {}
): string {
  const style  = options.style ?? "clean";
  const useSig = options.useSignatureBuilder ?? false;

  switch (style) {
    case "luxury":  return luxuryTemplate(body, row, useSig);
    case "modern":  return modernTemplate(body, row, useSig);
    case "minimal": return minimalTemplate(body, row, useSig);
    default:        return cleanTemplate(body, row, useSig);
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

/**
 * Clean — blue accent header, crisp white body.
 * Outlook-safe: table layout, solid colors, Arial font.
 */
function cleanTemplate(body: string, row: Record<string, string>, useSig: boolean): string {
  const FONT = "Arial, Helvetica, sans-serif";
  const company = row.company_name ? escapeHtml(row.company_name) : "";

  const headerRow = company
    ? `<tr>
        <td bgcolor="#1d4ed8" style="background-color:#1d4ed8;padding:24px 40px;">
          <p style="margin:0;font-family:${FONT};color:#ffffff;font-size:20px;font-weight:700;">${company}</p>
        </td>
      </tr>`
    : "";

  const bodyHtml = textToHtmlParagraphs(replaceVarsHtml(body, row), FONT, "#374151");
  const sigHtml  = useSig ? buildSignatureHtml(row, "#e2e8f0", FONT) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;border:1px solid #e2e8f0;">
${headerRow}
<tr><td style="padding:40px 40px 40px;font-family:${FONT};">
${bodyHtml}${sigHtml}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Modern — solid purple header, light background.
 * (No linear-gradient — Outlook doesn't support it.)
 */
function modernTemplate(body: string, row: Record<string, string>, useSig: boolean): string {
  const FONT = "Arial, Helvetica, sans-serif";
  const company = row.company_name ? escapeHtml(row.company_name) : "";

  const headerRow = company
    ? `<tr>
        <td bgcolor="#4f46e5" style="background-color:#4f46e5;padding:28px 40px;">
          <p style="margin:0;font-family:${FONT};color:#ffffff;font-size:20px;font-weight:700;">${company}</p>
        </td>
      </tr>`
    : `<tr>
        <td bgcolor="#4f46e5" style="background-color:#4f46e5;padding:12px 40px;">
          <p style="margin:0;font-family:${FONT};color:#c4b5fd;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Auto Transport</p>
        </td>
      </tr>`;

  const bodyHtml = textToHtmlParagraphs(replaceVarsHtml(body, row), FONT, "#374151");
  const sigHtml  = useSig ? buildSignatureHtml(row, "#e2e8f0", FONT) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f1f5f9" style="background-color:#f1f5f9;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;border:1px solid #e2e8f0;">
${headerRow}
<tr><td style="padding:40px 40px 40px;font-family:${FONT};">
${bodyHtml}${sigHtml}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Minimal — white background, thin blue top-border accent, no header block.
 */
function minimalTemplate(body: string, row: Record<string, string>, useSig: boolean): string {
  const FONT = "Arial, Helvetica, sans-serif";
  const company = row.company_name ? escapeHtml(row.company_name) : "";

  const companyRow = company
    ? `<tr>
        <td style="padding:0 0 20px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0;font-family:${FONT};color:#2563eb;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${company}</p>
        </td>
      </tr>
      <tr><td style="padding:8px 0 0;"></td></tr>`
    : "";

  const bodyHtml = textToHtmlParagraphs(replaceVarsHtml(body, row), FONT, "#374151");
  const sigHtml  = useSig ? buildSignatureHtml(row, "#f1f5f9", FONT) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;">
<tr><td align="center" style="padding:48px 24px;">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:560px;max-width:100%;border-top:3px solid #2563eb;">
<tr><td style="padding:32px 0 0;"></td></tr>
${companyRow}
<tr><td style="padding:24px 0 40px;font-family:${FONT};">
${bodyHtml}${sigHtml}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Luxury — dark navy with gold accent borders.
 * Uses Georgia for body text (supported by all email clients).
 */
function luxuryTemplate(body: string, row: Record<string, string>, useSig: boolean): string {
  const HEADING_FONT = "Arial, Helvetica, sans-serif";
  const BODY_FONT    = "Georgia, 'Times New Roman', serif";
  const company      = row.company_name ? escapeHtml(row.company_name) : "";

  const headerContent = company
    ? `<p style="margin:0 0 6px;font-family:${HEADING_FONT};color:#fbbf24;font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;">Vehicle Transport</p>
       <p style="margin:0;font-family:${HEADING_FONT};color:#f8fafc;font-size:22px;font-weight:700;">${company}</p>`
    : `<p style="margin:0;font-family:${HEADING_FONT};color:#fbbf24;font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;">Vehicle Transport</p>`;

  const bodyHtml = textToHtmlParagraphs(replaceVarsHtml(body, row), BODY_FONT, "#1e293b");
  const sigHtml  = useSig ? buildSignatureHtml(row, "#d97706", HEADING_FONT) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background-color:#0f172a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0f172a" style="background-color:#0f172a;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;">
<tr>
  <td bgcolor="#0f172a" style="background-color:#0f172a;padding:32px 48px;border-top:2px solid #d97706;border-left:1px solid #1e293b;border-right:1px solid #1e293b;">
    ${headerContent}
  </td>
</tr>
<tr>
  <td bgcolor="#ffffff" style="background-color:#ffffff;padding:48px 48px 40px;border-left:1px solid #1e293b;border-right:1px solid #1e293b;font-family:${BODY_FONT};">
    ${bodyHtml}${sigHtml}
  </td>
</tr>
<tr>
  <td bgcolor="#0f172a" style="background-color:#0f172a;padding:20px 48px;border-bottom:2px solid #d97706;border-left:1px solid #1e293b;border-right:1px solid #1e293b;">
    <p style="margin:0;font-family:${HEADING_FONT};color:#475569;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;">&#160;</p>
  </td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
