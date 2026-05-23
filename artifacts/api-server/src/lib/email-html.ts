/**
 * HTML email builder for Gmail drafts.
 * Provides variable replacement with rich formatting, price formatting,
 * and 4 professional email styles for vehicle shipping brokers.
 */

export function formatPrice(val: string): string {
  const trimmed = (val ?? "").trim();
  if (!trimmed) return trimmed;
  if (/^\$/.test(trimmed)) return trimmed; // already formatted
  const cleaned = trimmed.replace(/[,\s]/g, "");
  const num = parseFloat(cleaned);
  if (!isNaN(num) && cleaned !== "") {
    return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return trimmed;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain text replacement — formats price, leaves others as-is. */
export function replaceVarsText(text: string, row: Record<string, string>): string {
  return text.replace(/\{([^}]+)\}/g, (match, key) => {
    const k = key.trim();
    const val = row[k];
    if (val == null) return match;
    return k === "price" ? formatPrice(val) : val;
  });
}

/** HTML replacement — applies visual emphasis on key fields. */
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

function textToHtmlParagraphs(text: string): string {
  return text
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(para => `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.75;">${
      para.trim().replace(/\n/g, "<br>")
    }</p>`)
    .join("");
}

function buildSignature(agentName: string, company: string, phone: string, borderColor = "#e2e8f0"): string {
  if (!agentName) return "";
  return `<div style="margin-top:32px;padding-top:20px;border-top:1px solid ${borderColor};">
<p style="margin:0;color:#64748b;font-size:13px;line-height:1.9;">
Best regards,<br>
<strong style="color:#1e293b;">${escapeHtml(agentName)}</strong><br>
${company ? `${escapeHtml(company)}<br>` : ""}
${phone ? escapeHtml(phone) : ""}
</p></div>`;
}

export function buildHtmlEmail(
  body: string,
  row: Record<string, string>,
  style: string = "clean"
): string {
  const bodyHtml = textToHtmlParagraphs(replaceVarsHtml(body, row));
  const company = row.company ?? "";
  const agentName = row.agent_name ?? "";
  const phone = row.phone ?? "";

  switch (style) {
    case "luxury":  return luxuryTemplate(bodyHtml, buildSignature(agentName, company, phone, "#d97706"), company);
    case "modern":  return modernTemplate(bodyHtml, buildSignature(agentName, company, phone), company);
    case "minimal": return minimalTemplate(bodyHtml, buildSignature(agentName, company, phone, "#f1f5f9"), company);
    default:        return cleanTemplate(bodyHtml, buildSignature(agentName, company, phone), company);
  }
}

function cleanTemplate(bodyHtml: string, footer: string, company: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
<tr><td style="background:#1d4ed8;padding:28px 40px;">
<p style="color:#fff;font-size:20px;font-weight:700;margin:0 0 4px;">${escapeHtml(company || "Vertex Carship")}</p>
<p style="color:#93c5fd;font-size:12px;margin:0;letter-spacing:0.5px;">Vehicle Transportation Services</p>
</td></tr>
<tr><td style="padding:40px 40px 32px;">${bodyHtml}${footer}</td></tr>
<tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
<p style="color:#94a3b8;font-size:12px;margin:0;">Sent via Vertex Mailer · Review in Gmail Drafts before sending.</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function modernTemplate(bodyHtml: string, footer: string, company: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.10);">
<tr><td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:36px 40px;">
<p style="color:#fff;font-size:22px;font-weight:700;margin:0 0 6px;">${escapeHtml(company || "Vertex Carship")}</p>
<p style="color:#c4b5fd;font-size:12px;margin:0;">Auto Transport · Nationwide Coverage</p>
</td></tr>
<tr><td style="padding:40px 40px 32px;">${bodyHtml}${footer}</td></tr>
<tr><td style="background:#f8fafc;padding:16px 40px;border-top:1px solid #e2e8f0;">
<p style="color:#94a3b8;font-size:11px;margin:0;text-align:center;">Auto Transport USA · Sent via Vertex Mailer</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function minimalTemplate(bodyHtml: string, footer: string, company: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 24px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0">
<tr><td style="padding-bottom:20px;border-bottom:3px solid #2563eb;">
<p style="color:#2563eb;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0;">${escapeHtml(company || "Vehicle Transport")}</p>
</td></tr>
<tr><td style="padding:32px 0;">${bodyHtml}${footer}</td></tr>
<tr><td style="padding-top:16px;border-top:1px solid #f1f5f9;">
<p style="color:#cbd5e1;font-size:11px;margin:0;">Sent via Vertex Mailer</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function luxuryTemplate(bodyHtml: string, footer: string, company: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Georgia',Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;background:#0f172a;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0">
<tr><td style="background:#0f172a;padding:36px 48px;border-bottom:2px solid #d97706;">
<p style="color:#fbbf24;font-size:10px;font-weight:700;letter-spacing:4px;margin:0 0 8px;text-transform:uppercase;">Vehicle Transport</p>
<p style="color:#f8fafc;font-size:24px;font-weight:700;margin:0;">${escapeHtml(company || "Vertex Carship")}</p>
</td></tr>
<tr><td style="background:#fff;padding:48px 48px 40px;">${bodyHtml}${footer}</td></tr>
<tr><td style="background:#0f172a;padding:20px 48px;border-top:2px solid #d97706;">
<p style="color:#475569;font-size:11px;margin:0;text-align:center;letter-spacing:1.5px;text-transform:uppercase;">Premium Vehicle Transport · Vertex Mailer</p>
</td></tr>
</table></td></tr></table></body></html>`;
}
