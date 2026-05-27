/**
 * HTML email builder — fully white-label, zero platform branding.
 *
 * Architecture:
 *  - `row`     — lead-specific CSV vars: {name}, {vehicle}, {pickup}, {delivery}, {price}, {route}
 *  - `branding`— user's company settings, applied automatically to header/signature
 *  - Templates NEVER contain company name or contact info as row variables
 *  - Signature is NEVER injected unless useSignatureBuilder === true
 *  - Zero hardcoded company names, taglines, or platform text anywhere
 *  - Table layout, inline CSS + media queries — Gmail mobile / Outlook / Apple Mail safe
 */

export type EmailStyle = "clean" | "modern" | "minimal" | "luxury";

/** User's company settings — drives header and optional signature automatically */
export interface BrandingSettings {
  agentName?:      string | null;
  companyName?:    string | null;
  companyTagline?: string | null;
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
      return `<span style="color:#ef4444;font-style:italic;">${match}</span>`;
    }
    const val = k === "price" ? formatPrice(raw) : raw;
    const esc = escapeHtml(val);
    if (k === "price")    return `<strong style="color:#059669;font-size:16px;">${esc}</strong>`;
    if (["vehicle", "pickup", "delivery", "route"].includes(k)) return `<strong>${esc}</strong>`;
    if (k === "name")     return `<strong>${esc}</strong>`;
    if (k === "quote_id") return `<strong style="color:#7c3aed;">${esc}</strong>`;
    return esc;
  });
}

function textToHtmlParagraphs(text: string, fontFamily: string, color: string): string {
  return text
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(para =>
      `<p class="em-p" style="margin:0 0 16px;font-family:${fontFamily};color:${color};font-size:15px;line-height:1.75;">${
        para.trim().replace(/\n/g, "<br>")
      }</p>`
    )
    .join("");
}

/**
 * Shared <head> block with reset CSS and responsive media queries.
 * The .em-* classes are overridden on small screens.
 */
function sharedHead(extraCss = ""): string {
  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title></title>
<style type="text/css">
/* Client reset */
body,table,td,p,a,li{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;}
img{-ms-interpolation-mode:bicubic;border:0;height:auto;outline:none;text-decoration:none;}
body{margin:0!important;padding:0!important;width:100%!important;}
/* Mobile overrides — supported by modern Gmail, Apple Mail, Samsung Mail */
@media only screen and (max-width:600px){
  .em-wrapper{padding:0!important;}
  .em-wrapper-td{padding:12px 0!important;}
  .em-card{width:100%!important;max-width:100%!important;}
  .em-hdr{padding:20px 20px!important;}
  .em-body{padding:28px 20px 28px!important;}
  .em-co{font-size:18px!important;line-height:1.3!important;}
  .em-tag{font-size:11px!important;}
  .em-p{font-size:14px!important;line-height:1.7!important;}
  .em-sig{padding:16px 20px!important;}
}
${extraCss}
</style>`;
}

/**
 * Builds the optional auto-signature from branding settings.
 * `agentNameOverride` comes from row.agent_name (per-lead CSV column).
 * Falls back to branding.agentName when CSV column is not present.
 * All company details come from BrandingSettings — not template variables.
 * Returns empty string if nothing meaningful to show.
 */
function buildSignatureHtml(
  agentNameOverride: string,
  branding: BrandingSettings,
  borderColor: string,
  fontFamily: string
): string {
  const rawName = agentNameOverride?.trim() || branding.agentName?.trim() || "";
  const name    = rawName                        ? escapeHtml(rawName)                        : "";
  const company = branding.companyName?.trim()   ? escapeHtml(branding.companyName.trim())   : "";
  const tagline = branding.companyTagline?.trim()? escapeHtml(branding.companyTagline.trim()): "";
  const phone   = branding.companyPhone?.trim()  ? escapeHtml(branding.companyPhone.trim())  : "";
  const website = branding.companyWebsite?.trim()? escapeHtml(branding.companyWebsite.trim()): "";
  const usdot   = branding.usdot?.trim()         ? escapeHtml(branding.usdot.trim())         : "";
  const mc      = branding.mcNumber?.trim()      ? escapeHtml(branding.mcNumber.trim())      : "";

  if (!name && !company && !phone && !website && !usdot && !mc) return "";

  const lines: string[] = [];
  if (name)    lines.push(`<strong style="color:#1e293b;font-size:14px;">${name}</strong>`);
  if (company) {
    const companyLine = tagline
      ? `<span style="color:#374151;">${company}</span> <span style="color:#94a3b8;font-size:12px;">${tagline}</span>`
      : `<span style="color:#374151;">${company}</span>`;
    lines.push(companyLine);
  }
  if (phone)   lines.push(phone);
  if (website) {
    const href = /^https?:\/\//.test(website) ? website : `https://${website}`;
    lines.push(`<a href="${href}" style="color:#2563eb;text-decoration:none;">${website}</a>`);
  }
  const creds: string[] = [];
  if (usdot) creds.push(`USDOT #${usdot}`);
  if (mc)    creds.push(`MC #${mc}`);
  if (creds.length) lines.push(creds.join(" &nbsp;&middot;&nbsp; "));

  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:24px;">
<tr><td class="em-sig" style="padding-top:20px;border-top:1px solid ${borderColor};">
<p style="margin:0;font-family:${fontFamily};color:#64748b;font-size:13px;line-height:2.0;">
Best regards,<br>${lines.join("<br>")}
</p>
</td></tr>
</table>`;
}

// ─── Master builder ───────────────────────────────────────────────────────────

/**
 * Builds a complete, mobile-responsive HTML email.
 *
 * @param body     - Raw template body text with {variable} placeholders
 * @param row      - Lead-specific values from CSV
 * @param branding - User's company settings — header/signature only, never hardcoded
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

function cleanTemplate(
  body: string, row: Record<string, string>, branding: BrandingSettings, useSig: boolean
): string {
  const FONT    = "Arial, Helvetica, sans-serif";
  const accent  = safeColor(branding.accentColor) || "#1d4ed8";
  const company = branding.companyName?.trim() ? escapeHtml(branding.companyName.trim()) : "";
  const tagline = branding.companyTagline?.trim() ? escapeHtml(branding.companyTagline.trim()) : "";

  const headerRow = company
    ? `<tr>
        <td class="em-hdr" bgcolor="${accent}" style="background-color:${accent};padding:24px 40px;">
          <p class="em-co" style="margin:0${tagline ? " 0 5px" : ""};font-family:${FONT};color:#ffffff;font-size:20px;font-weight:700;line-height:1.3;">${company}</p>
          ${tagline ? `<p class="em-tag" style="margin:0;font-family:${FONT};color:rgba(255,255,255,0.78);font-size:12px;font-weight:400;letter-spacing:0.3px;line-height:1.4;">${tagline}</p>` : ""}
        </td>
      </tr>`
    : "";

  const bodyHtml = textToHtmlParagraphs(replaceVarsHtml(body, row), FONT, "#374151");
  const sigHtml  = useSig ? buildSignatureHtml(row.agent_name ?? "", branding, "#e2e8f0", FONT) : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>${sharedHead()}</head>
<body style="margin:0;padding:0;background-color:#f8fafc;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;width:100%;">
<tr><td class="em-wrapper-td" align="center" style="padding:40px 16px;">
<!--[if (gte mso 9)|(IE)]><table width="600" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table class="em-card" role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #e2e8f0;">
${headerRow}
<tr><td class="em-body" style="padding:36px 40px 40px;font-family:${FONT};">${bodyHtml}${sigHtml}</td></tr>
</table>
<!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

// ─── Style: Modern ────────────────────────────────────────────────────────────

function modernTemplate(
  body: string, row: Record<string, string>, branding: BrandingSettings, useSig: boolean
): string {
  const FONT    = "Arial, Helvetica, sans-serif";
  const accent  = safeColor(branding.accentColor) || "#4f46e5";
  const company = branding.companyName?.trim() ? escapeHtml(branding.companyName.trim()) : "";
  const tagline = branding.companyTagline?.trim() ? escapeHtml(branding.companyTagline.trim()) : "";

  const headerRow = company
    ? `<tr>
        <td class="em-hdr" bgcolor="${accent}" style="background-color:${accent};padding:28px 40px;">
          <p class="em-co" style="margin:0${tagline ? " 0 5px" : ""};font-family:${FONT};color:#ffffff;font-size:20px;font-weight:700;line-height:1.3;">${company}</p>
          ${tagline ? `<p class="em-tag" style="margin:0;font-family:${FONT};color:rgba(255,255,255,0.78);font-size:12px;font-weight:400;letter-spacing:0.3px;line-height:1.4;">${tagline}</p>` : ""}
        </td>
      </tr>`
    : `<tr><td bgcolor="${accent}" style="background-color:${accent};padding:5px 40px;"></td></tr>`;

  const bodyHtml = textToHtmlParagraphs(replaceVarsHtml(body, row), FONT, "#374151");
  const sigHtml  = useSig ? buildSignatureHtml(row.agent_name ?? "", branding, "#e2e8f0", FONT) : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>${sharedHead()}</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f1f5f9" style="background-color:#f1f5f9;width:100%;">
<tr><td class="em-wrapper-td" align="center" style="padding:40px 16px;">
<!--[if (gte mso 9)|(IE)]><table width="600" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table class="em-card" role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #e2e8f0;">
${headerRow}
<tr><td class="em-body" style="padding:36px 40px 40px;font-family:${FONT};">${bodyHtml}${sigHtml}</td></tr>
</table>
<!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

// ─── Style: Minimal ───────────────────────────────────────────────────────────

function minimalTemplate(
  body: string, row: Record<string, string>, branding: BrandingSettings, useSig: boolean
): string {
  const FONT    = "Arial, Helvetica, sans-serif";
  const accent  = safeColor(branding.accentColor) || "#2563eb";
  const company = branding.companyName?.trim() ? escapeHtml(branding.companyName.trim()) : "";
  const tagline = branding.companyTagline?.trim() ? escapeHtml(branding.companyTagline.trim()) : "";

  const companyRow = company
    ? `<tr>
        <td class="em-hdr" style="padding:28px 0 18px;border-bottom:1px solid #e2e8f0;">
          <p class="em-co" style="margin:0${tagline ? " 0 4px" : ""};font-family:${FONT};color:${accent};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${company}</p>
          ${tagline ? `<p class="em-tag" style="margin:0;font-family:${FONT};color:#64748b;font-size:11px;font-weight:400;letter-spacing:0.5px;text-transform:uppercase;">${tagline}</p>` : ""}
        </td>
      </tr>
      <tr><td style="padding:4px 0;"></td></tr>`
    : `<tr><td style="padding:24px 0 0;"></td></tr>`;

  const bodyHtml = textToHtmlParagraphs(replaceVarsHtml(body, row), FONT, "#374151");
  const sigHtml  = useSig ? buildSignatureHtml(row.agent_name ?? "", branding, "#f1f5f9", FONT) : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>${sharedHead(`@media only screen and (max-width:600px){.em-minimal-card{width:100%!important;padding:0 16px!important;}}`)}</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;width:100%;">
<tr><td class="em-wrapper-td" align="center" style="padding:40px 24px;">
<!--[if (gte mso 9)|(IE)]><table width="560" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table class="em-card" role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="width:560px;max-width:560px;border-top:3px solid ${accent};">
${companyRow}
<tr><td class="em-body" style="padding:12px 0 40px;font-family:${FONT};">${bodyHtml}${sigHtml}</td></tr>
</table>
<!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

// ─── Style: Luxury ────────────────────────────────────────────────────────────

function luxuryTemplate(
  body: string, row: Record<string, string>, branding: BrandingSettings, useSig: boolean
): string {
  const HEADING_FONT = "Arial, Helvetica, sans-serif";
  const BODY_FONT    = "Georgia, 'Times New Roman', serif";
  const company      = branding.companyName?.trim() ? escapeHtml(branding.companyName.trim()) : "";
  const tagline      = branding.companyTagline?.trim() ? escapeHtml(branding.companyTagline.trim()) : "";

  const headerPad    = company ? "30px 40px" : "14px 40px";
  const headerInner  = company
    ? `<p class="em-co" style="margin:0${tagline ? " 0 6px" : ""};font-family:${HEADING_FONT};color:#f8fafc;font-size:22px;font-weight:700;letter-spacing:0.5px;line-height:1.3;">${company}</p>
       ${tagline ? `<p class="em-tag" style="margin:0;font-family:${HEADING_FONT};color:rgba(212,175,55,0.85);font-size:11px;font-weight:400;letter-spacing:1.5px;text-transform:uppercase;">${tagline}</p>` : ""}`
    : "";

  const bodyHtml = textToHtmlParagraphs(replaceVarsHtml(body, row), BODY_FONT, "#1e293b");
  const sigHtml  = useSig ? buildSignatureHtml(row.agent_name ?? "", branding, "#d97706", HEADING_FONT) : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>${sharedHead(`
@media only screen and (max-width:600px){
  .em-lux-hdr{padding:22px 24px!important;}
  .em-lux-body{padding:32px 24px 28px!important;}
  .em-lux-foot{padding:14px 24px!important;}
  .em-co{font-size:19px!important;}
}`)}</head>
<body style="margin:0;padding:0;background-color:#0f172a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0f172a" style="background-color:#0f172a;width:100%;">
<tr><td class="em-wrapper-td" align="center" style="padding:40px 16px;">
<!--[if (gte mso 9)|(IE)]><table width="600" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table class="em-card" role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="width:600px;max-width:600px;">
<tr>
  <td class="em-lux-hdr em-hdr" bgcolor="#0f172a" style="background-color:#0f172a;padding:${headerPad};border-top:2px solid #d97706;border-left:1px solid #1e293b;border-right:1px solid #1e293b;">
    ${headerInner}
  </td>
</tr>
<tr>
  <td class="em-lux-body em-body" bgcolor="#ffffff" style="background-color:#ffffff;padding:44px 48px 40px;border-left:1px solid #1e293b;border-right:1px solid #1e293b;font-family:${BODY_FONT};">
    ${bodyHtml}${sigHtml}
  </td>
</tr>
<tr>
  <td class="em-lux-foot" bgcolor="#0f172a" style="background-color:#0f172a;padding:14px 48px;border-bottom:2px solid #d97706;border-left:1px solid #1e293b;border-right:1px solid #1e293b;">
    <p style="margin:0;font-size:1px;line-height:1px;">&#160;</p>
  </td>
</tr>
</table>
<!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}
