import { useState, useEffect, useMemo, useRef } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetTemplate,
  useUpdateTemplate,
  getGetTemplateQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2, Eye, Code2 } from "lucide-react";

const CHIPS = [
  "{name}", "{email}", "{vehicle}", "{pickup}", "{delivery}",
  "{price}", "{route}", "{company}", "{agent_name}", "{phone}", "{notes}",
];

const SAMPLE_DATA: Record<string, string> = {
  name: "Alex Johnson",
  email: "alex@example.com",
  vehicle: "2023 Tesla Model Y",
  pickup: "Miami, FL",
  delivery: "Seattle, WA",
  price: "$1,250",
  route: "FL → WA",
  company: "Vertex Carship",
  agent_name: "Frank Miller",
  phone: "(832) 304-8468",
  notes: "Enclosed transport preferred",
};

function replaceVariables(text: string, data: Record<string, string>): string {
  return text.replace(/\{([^}]+)\}/g, (match, key) => data[key.trim()] ?? match);
}

function buildSimpleHtmlPreview(body: string, subject: string, data: Record<string, string>): string {
  const company = data.company ?? "";
  const agentName = data.agent_name ?? "";
  const phone = data.phone ?? "";

  const replacedBody = body.replace(/\{([^}]+)\}/g, (match, key) => {
    const k = key.trim();
    const val = data[k];
    if (!val) return `<span style="color:#ef4444;font-style:italic;">${match}</span>`;
    if (k === "price") return `<strong style="color:#059669;font-size:15px;">${val}</strong>`;
    if (["vehicle", "pickup", "delivery", "route"].includes(k)) return `<strong>${val}</strong>`;
    if (k === "name") return `<strong>${val}</strong>`;
    return val;
  });

  const paragraphs = replacedBody
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => `<p style="margin:0 0 14px;color:#374151;font-size:14px;line-height:1.7;">${p.trim().replace(/\n/g, "<br>")}</p>`)
    .join("");

  const footer = agentName
    ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.8;">Best regards,<br>
        <strong style="color:#1e293b;">${agentName}</strong><br>
        ${company ? `${company}<br>` : ""}${phone || ""}</p>
       </div>`
    : "";

  const subjectReplaced = subject
    ? subject.replace(/\{([^}]+)\}/g, (match, key) => data[key.trim()] ?? match)
    : "";

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<div style="max-width:580px;margin:20px auto;">
  <div style="background:#1d4ed8;padding:20px 28px;border-radius:8px 8px 0 0;">
    <p style="color:#fff;font-size:17px;font-weight:700;margin:0 0 4px;">${company || "Vertex Carship"}</p>
    <p style="color:#93c5fd;font-size:11px;margin:0;">Vehicle Transportation Services</p>
  </div>
  ${subjectReplaced ? `<div style="background:#eff6ff;padding:12px 28px;border-left:3px solid #3b82f6;"><p style="margin:0;font-size:13px;font-weight:600;color:#1e40af;">Subject: ${subjectReplaced}</p></div>` : ""}
  <div style="background:#fff;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    ${paragraphs}${footer}
  </div>
</div></body></html>`;
}

export default function TemplateEditor() {
  const [, params] = useRoute("/templates/:id");
  const templateId = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: template, isLoading } = useGetTemplate(templateId, {
    query: { enabled: !!templateId, queryKey: getGetTemplateQueryKey(templateId) },
  });

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [previewMode, setPreviewMode] = useState<"text" | "html">("text");

  const initializedForId = useRef<number | null>(null);
  useEffect(() => {
    if (template && initializedForId.current !== templateId) {
      initializedForId.current = templateId;
      setName(template.name);
      setSubject(template.subject);
      setBody(template.body);
    }
  }, [template, templateId]);

  const updateTemplate = useUpdateTemplate();

  const previewSubject = useMemo(() => replaceVariables(subject, SAMPLE_DATA), [subject]);
  const previewBody    = useMemo(() => replaceVariables(body, SAMPLE_DATA),    [body]);
  const htmlPreview    = useMemo(() => buildSimpleHtmlPreview(body, subject, SAMPLE_DATA), [body, subject]);

  const handleSave = () => {
    updateTemplate.mutate(
      { id: templateId, data: { name, subject, body } },
      {
        onSuccess: (data) => {
          toast({ title: "Template saved" });
          queryClient.setQueryData(getGetTemplateQueryKey(templateId), data);
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Save failed", description: err.message });
        },
      }
    );
  };

  const insertChip = (chip: string) => setBody(prev => prev + chip);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/templates" className="hover:text-primary flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Templates
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Edit Template</h2>
        <Button onClick={handleSave} disabled={updateTemplate.isPending} className="rounded-xl gap-2">
          {updateTemplate.isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Save className="h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* ── Left: editor ── */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Template Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="rounded-xl" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Subject Line</label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} className="rounded-xl" placeholder="e.g. Shipping quote for your {vehicle}" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Body</label>
            {/* Variable chips */}
            <div className="flex gap-1.5 flex-wrap">
              {CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => insertChip(chip)}
                  className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors font-mono"
                >
                  {chip}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              Any CSV column header also works — e.g. <code className="font-mono bg-slate-100 px-1 rounded">{"{transport_type}"}</code>
            </p>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              className="min-h-[360px] font-mono text-sm rounded-xl resize-none"
              placeholder={"Hi {name},\n\nI can get your {vehicle} shipped from {pickup} to {delivery} for {price}.\n\nLet me know if you'd like to move forward.\n\nBest regards,\n{agent_name}\n{company}\n{phone}"}
            />
          </div>
        </div>

        {/* ── Right: live preview ── */}
        <div className="bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
          {/* Header with toggle */}
          <div className="h-12 border-b border-slate-100 bg-slate-50/60 px-5 flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-400" />
            <h3 className="font-semibold text-slate-700 text-sm">Live Preview</h3>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setPreviewMode("text")}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors ${
                  previewMode === "text"
                    ? "bg-slate-200 text-slate-900 font-medium"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Code2 className="h-3 w-3" /> Plain
              </button>
              <button
                onClick={() => setPreviewMode("html")}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors ${
                  previewMode === "html"
                    ? "bg-blue-100 text-blue-800 font-medium"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Eye className="h-3 w-3" /> HTML
              </button>
            </div>
          </div>

          {previewMode === "html" ? (
            <div className="flex-1 overflow-hidden" style={{ minHeight: "420px" }}>
              <iframe
                srcDoc={htmlPreview}
                title="HTML Email Preview"
                className="w-full h-full border-0"
                style={{ minHeight: "420px" }}
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <div className="p-6 flex-1 space-y-6 bg-white min-h-[300px]">
              {/* Sample data notice */}
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                <span className="font-medium">Sample data:</span>
                <span className="text-blue-600">Alex Johnson · Tesla Model Y · Miami → Seattle · $1,250</span>
              </div>

              {subject ? (
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1.5">Subject</div>
                  <div className="font-semibold text-slate-900 text-sm">{previewSubject}</div>
                </div>
              ) : (
                <div className="text-xs text-slate-300 italic">Add a subject line…</div>
              )}

              {body ? (
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1.5">Body</div>
                  <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 rounded-xl p-4 border border-slate-100">
                    {previewBody}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-300 italic">Add body text…</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
