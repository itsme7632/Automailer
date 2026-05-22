import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface EmailGenerationOptions {
  name: string;
  email: string;
  vehicle?: string | null;
  route?: string | null;
  pickup?: string | null;
  delivery?: string | null;
  price?: string | null;
  notes?: string | null;
  templateSubject: string;
  templateBody: string;
  tone: string;
  customPrompt?: string | null;
}

function applyTemplateVars(text: string, data: EmailGenerationOptions): string {
  return text
    .replace(/\{name\}/g, data.name ?? "")
    .replace(/\{vehicle\}/g, data.vehicle ?? "")
    .replace(/\{route\}/g, data.route ?? "")
    .replace(/\{pickup\}/g, data.pickup ?? "")
    .replace(/\{delivery\}/g, data.delivery ?? "")
    .replace(/\{price\}/g, data.price ?? "");
}

const TONE_DESCRIPTIONS: Record<string, string> = {
  professional: "formal, professional, and courteous",
  friendly: "warm, friendly, and conversational",
  sales: "persuasive, benefit-focused, and sales-oriented",
  followup: "gentle follow-up tone, referencing a prior conversation",
  urgent: "creates urgency while remaining professional",
};

export async function generatePersonalizedEmail(opts: EmailGenerationOptions): Promise<{ subject: string; body: string; tone: string }> {
  const baseSubject = applyTemplateVars(opts.templateSubject, opts);
  const baseBody = applyTemplateVars(opts.templateBody, opts);
  const toneDesc = TONE_DESCRIPTIONS[opts.tone] ?? "professional";

  const systemPrompt = `You are an expert email writer for vehicle shipping brokers. Your job is to personalize and improve outreach emails that create Gmail drafts (NOT send emails automatically). The email should be ${toneDesc}. Avoid spam-trigger words. Write naturally and concisely. Focus on vehicle transport value.`;

  const userPrompt = `Personalize this email for a vehicle shipping lead:

Lead info:
- Name: ${opts.name}
- Vehicle: ${opts.vehicle ?? "not specified"}
- Route: ${opts.route ?? "not specified"}
- Pickup: ${opts.pickup ?? "not specified"}
- Delivery: ${opts.delivery ?? "not specified"}
- Price: ${opts.price ?? "not specified"}
- Notes: ${opts.notes ?? "none"}

Base subject: ${baseSubject}
Base body:
${baseBody}

${opts.customPrompt ? `Additional instructions: ${opts.customPrompt}` : ""}

Return JSON only with this exact shape:
{"subject": "...", "body": "..."}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as { subject?: string; body?: string };

  return {
    subject: parsed.subject ?? baseSubject,
    body: parsed.body ?? baseBody,
    tone: opts.tone,
  };
}
