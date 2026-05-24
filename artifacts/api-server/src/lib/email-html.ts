/**
 * HTML email builder — fully white-label, zero platform branding.
 *
 * Architecture:
 *  - `row`     — lead-specific CSV vars: {name}, {vehicle}, {pickup}, {delivery}, {price}, {route}
 *  - `branding`— user's company settings, applied automatically to header/signature
 *  - Templates NEVER contain company name or contact info as row variables
 *  - Signature is NEVER injected unless useSignatureBuilder === true
 *  - Zero hardcoded company names, taglines, or platform text anywhere
 *  - Table layout, inline CSS only, Arial/Helvetica — Gmail + Outlook + mobile safe
 */

export type EmailStyle = "clean" | "modern" | "minimal" | "luxury";

/** User's company settings — drives header and optional signature automatically */
export interface BrandingSettings {
  companyName?:    string | null;
  companyPhone?:   string | null;
  companyWebsite?: string | null;
  usdot?:          string | null;
  mcNumber?:       string | null;
  accentColor?:    string | null;
}

export interface EmailBuildOptions {
  style?:               EmailStyle;
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

/** Validate hex color to prevent CSS injection */
function safeColor(color?: string | null): string {
  if (!color) return "";
  const c = color.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : "";
}

/** Plain-text variable replacement — lead vars only ({name}, {vehicle}, {price}, etc.) */
export function replaceVarsText(text: string, row: Record<string, string>): string {
  return text.replace(/\{([^}]+)\}/g, (match, key) => {
    const k = key.trim();
    const val = row[k];
    if (val == null) return match;
    return k === "price" ? formatPrice(val) : val;
  });
}

/** HTML variable replacement — applies visual emphasis on transport-specific fields */
function replaceVarsHtml(text: string, row: Record<string, string>): string {
  return text.replace(/\{([^}]+)\}/g, (match, key) => {
    const k = key.trim();
    const raw = row[k];
    if (raw == null) {
      // Leave unresolved vars invisible rather than showing a red error in real emails
      return `<span style="color:#ef4444;font-style:italic;">${match}</span>`;
    }
    const val = k === "price" ? formatPrice(raw) : raw;
    const esc = escapeHtml(val);
    if (k === "price")    return `<strong style="color:#059669;font-size:16px;">${esc}</strong>`;
    if (["vehicle", "pickup", "delivery", "route"].includes(k)) return `<strong>${esc}</strong>`;
    if (k === "name")     return `<strong>${esc}</strong>`;
    return esc;
  });
}

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
 * Builds the optional auto-signature from branding settings.
 * `agentName` comes from row.agent_name (per-lead, optional CSV column).
 * All company details come from BrandingSettings — not template variables.
 * Returns empty string if nothing meaningful to show.
 */
function buildSignatureHtml(
  agentName: string,
  branding: BrandingSettings,
  borderColor: string,
  fontFamily: string
): string {
  const name    = agentName?.trim()                   ? escapeHtml(agentName.trim())                   : "";
  const company = branding.companyName?.trim()         ? escapeHtml(branding.companyName.trim())         : "";
  const phone   = branding.companyPhone?.trim()        ? escapeHtml(branding.companyPhone.trim())        : "";
  const website = branding.companyWebsite?.trim()      ? escapeHtml(branding.companyWebsite.trim())      : "";
  const usdot   = branding.usdot?.trim()               ? escapeHtml(branding.usdot.trim())               : "";
  const mc      = branding.mcNumber?.trim()            ? escapeHtml(branding.mcNumber.trim())            : "";

  if (!name && !company && !phone && !website && !usdot && !mc) return "";

  const lines: string[] = [];
  if (name)    lines.push(`<strong style="color:#1e293b;font-size:14px;">${name}</strong>`);
  if (company) lines.push(`<span style="color:#374151;">${company}</span>`);
  if (phone)   lines.push(phone);
  if (website) {
    const href = /^https?:\/\//.test(website) ? website : `https://${website}`;
    lines.push(`<a href="${href}" style="color:#2563eb;text-decoration:none;">${website}</a>`);
  }
  const creds: string[] = [];
  if (usdot) creds.push(`USDOT #${usdot}`);
  if (mc)    creds.push(`MC #${mc}`);
  if (creds.length) lines.push(creds.join(" &nbsp;&middot;&nbsp; "));

  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:28px;">
<tr><td style="padding-top:20px;border-top:1px solid ${borderColor};">
<p style="margin:0;font-family:${fontFamily};color:#64748b;font-size:13px;line-height:2.0;">
Best regards,<br>${lines.join("<br>")}
</p>
</td></tr>
</table>`;
}

// ─── Master builder ───────────────────────────────────────────────────────────

/**
 * Builds a complete HTML email.
 *
 * @param body     - Raw template body text with {variable} placeholders
 * @param row      - Lead-specific values from CSV: {name}, {vehicle}, {pickup}, {delivery}, {price}, {route}
 * @param branding - User's company settings — applied to header/signature automatically
 * @param options  - style + useSignatureBuilder toggle
 */
export function buildHtmlEmail(
  body: string,
  row: Record<string, string>,
  branding: BrandingSettings = {},
  options: EmailBuildOptions = {}
): string {
  const style  = options.style ?? "clean";
  const useSig = options.useSignatureBuilder ?? false;

  switch (style) {
    case "luxury":  return luxuryTemplate(body, row, branding, useSig);
    case "modern":  return modernTemplate(body, row, branding, useSig);
    case "minimal": return minimalTemplate(body, row, branding, useSig);
    default:        return cleanTemplate(body, row, branding, useSig);
  }
}

// ─── Style: Clean ─────────────────────────────────────────────────────────────
// Blue/accent colored header bar; crisp white body.

function cleanTemplate(
  body: string, row: Record<string, string>, branding: BrandingSettings, useSig: boolean
): string {
  const FONT    = "Arial, Helvetica, sans-serif";
  const accent  = safeColor(branding.accentColor) || "#1d4ed8";
  const company = branding.companyName?.trim() ? escapeHtml(branding.companyName.trim()) : "";

  // Header: only render if company name is set in branding — no fallback text
  const headerRow = company
    ? `<tr>
        <td bgcolor="${accent}" style="background-color:${accent};padding:24px 40px;">
          <p style="margin:0;font-family:${FONT};color:#ffffff;font-size:20px;font-weight:700;line-height:1.3;">${company}</p>
        </td>
      </tr>`
    : "";

  const bodyHtml = textToHtmlParagraphs(replaceVarsHtml(body, row), FONT, "#374151");
  const sigHtml  = useSig ? buildSignatureHtml(row.agent_name ?? "", branding, "#e2e8f0", FONT) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;border:1px solid #e2e8f0;">
${headerRow}
<tr><td style="padding:40px 40px 40px;font-family:${FONT};">${bodyHtml}${sigHtml}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Style: Modern ────────────────────────────────────────────────────────────
// Solid purple/accent header; light gray outer background.

function modernTemplate(
  body: string, row: Record<string, string>, branding: BrandingSettings, useSig: boolean
): string {
  const FONT    = "Arial, Helvetica, sans-serif";
  const accent  = safeColor(branding.accentColor) || "#4f46e5";
  const company = branding.companyName?.trim() ? escapeHtml(branding.companyName.trim()) : "";

  // No company = thin accent bar with no text (no hardcoded fallback label)
  const headerRow = company
    ? `<tr>
        <td bgcolor="${accent}" style="background-color:${accent};padding:28px 40px;">
          <p style="margin:0;font-family:${FONT};color:#ffffff;font-size:20px;font-weight:700;line-height:1.3;">${company}</p>
        </td>
      </tr>`
    : `<tr><td bgcolor="${accent}" style="background-color:${accent};padding:6px 40px;"></td></tr>`;

  const bodyHtml = textToHtmlParagraphs(replaceVarsHtml(body, row), FONT, "#374151");
  const sigHtml  = useSig ? buildSignatureHtml(row.agent_name ?? "", branding, "#e2e8f0", FONT) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f1f5f9" style="background-color:#f1f5f9;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;border:1px solid #e2e8f0;">
${headerRow}
<tr><td style="padding:40px 40px 40px;font-family:${FONT};">${bodyHtml}${sigHtml}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Style: Minimal ───────────────────────────────────────────────────────────
// White background; thin colored top border; company name above body (if set).

function minimalTemplate(
  body: string, row: Record<string, string>, branding: BrandingSettings, useSig: boolean
): string {
  const FONT    = "Arial, Helvetica, sans-serif";
  const accent  = safeColor(branding.accentColor) || "#2563eb";
  const company = branding.companyName?.trim() ? escapeHtml(branding.companyName.trim()) : "";

  const companyRow = company
    ? `<tr>
        <td style="padding:24px 0 20px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0;font-family:${FONT};color:${accent};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${company}</p>
        </td>
      </tr>
      <tr><td style="padding:4px 0;"></td></tr>`
    : `<tr><td style="padding:24px 0 0;"></td></tr>`;

  const bodyHtml = textToHtmlParagraphs(replaceVarsHtml(body, row), FONT, "#374151");
  const sigHtml  = useSig ? buildSignatureHtml(row.agent_name ?? "", branding, "#f1f5f9", FONT) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head>
<body style="margin:0;padding:0;background-color:#ffffff;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;">
<tr><td align="center" style="padding:48px 24px;">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:560px;max-width:100%;border-top:3px solid ${accent};">
${companyRow}
<tr><td style="padding:8px 0 40px;font-family:${FONT};">${bodyHtml}${sigHtml}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Style: Luxury ────────────────────────────────────────────────────────────
// Dark navy outer; gold border accent; white inner body.

function luxuryTemplate(
  body: string, row: Record<string, string>, branding: BrandingSettings, useSig: boolean
): string {
  const HEADING_FONT = "Arial, Helvetica, sans-serif";
  const BODY_FONT    = "Georgia, 'Times New Roman', serif";
  const company      = branding.companyName?.trim() ? escapeHtml(branding.companyName.trim()) : "";

  // Only show header content if company name is set — no fallback taglines
  const headerInner = company
    ? `<p style="margin:0;font-family:${HEADING_FONT};color:#f8fafc;font-size:22px;font-weight:700;line-height:1.3;">${company}</p>`
    : "";

  const bodyHtml = textToHtmlParagraphs(replaceVarsHtml(body, row), BODY_FONT, "#1e293b");
  const sigHtml  = useSig ? buildSignatureHtml(row.agent_name ?? "", branding, "#d97706", HEADING_FONT) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head>
<body style="margin:0;padding:0;background-color:#0f172a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0f172a" style="background-color:#0f172a;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;">
<tr>
  <td bgcolor="#0f172a" style="background-color:#0f172a;padding:${company ? "32px" : "16px"} 48px;border-top:2px solid #d97706;border-left:1px solid #1e293b;border-right:1px solid #1e293b;">
    ${headerInner}
  </td>
</tr>
<tr>
  <td bgcolor="#ffffff" style="background-color:#ffffff;padding:48px 48px 40px;border-left:1px solid #1e293b;border-right:1px solid #1e293b;font-family:${BODY_FONT};">
    ${bodyHtml}${sigHtml}
  </td>
</tr>
<tr>
  <td bgcolor="#0f172a" style="background-color:#0f172a;padding:16px 48px;border-bottom:2px solid #d97706;border-left:1px solid #1e293b;border-right:1px solid #1e293b;">
    <p style="margin:0;font-size:1px;line-height:1px;">&#160;</p>
  </td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
