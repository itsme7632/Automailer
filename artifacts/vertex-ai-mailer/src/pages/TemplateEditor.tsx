import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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

// Lead variables only — branding is applied automatically from Settings
const CHIPS = [
  "{name}", "{email}", "{vehicle}", "{pickup}", "{delivery}",
  "{price}", "{route}", "{quote_id}", "{agent_name}", "{notes}",
];

// Generic sample data — NO hardcoded company names
const SAMPLE_ROW: Record<string, string> = {
  name:       "Alex Johnson",
  email:      "alex@example.com",
  vehicle:    "2023 Tesla Model Y",
  pickup:     "Miami, FL",
  delivery:   "Seattle, WA",
  price:      "$1,250",
  route:      "FL → WA",
  quote_id:   "QT-10042",
  agent_name: "Your Name",
  notes:      "Enclosed transport preferred",
};

function replaceVariables(text: string, data: Record<string, string>): string {
  return text.replace(/\{([^}]+)\}/g, (match, key) => data[key.trim()] ?? match);
}

export default function TemplateEditor() {
  const [, params] = useRoute("/templates/:id");
  const templateId = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: template, isLoading } = useGetTemplate(templateId, {
    query: { enabled: !!templateId, queryKey: getGetTemplateQueryKey(templateId) },
  });

  const [name, setName]       = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody]       = useState("");
  const [previewMode, setPreviewMode] = useState<"text" | "html">("text");

  // HTML preview fetched from server — same pipeline as actual Gmail draft
  const [previewHtml, setPreviewHtml]       = useState<string | null>(null);
  const [previewSubjectLine, setPreviewSubjectLine] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

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

  const previewSubject = useMemo(() => replaceVariables(subject, SAMPLE_ROW), [subject]);
  const previewBody    = useMemo(() => replaceVariables(body, SAMPLE_ROW),    [body]);

  // Fetch HTML preview from the server — uses the EXACT same renderer as actual drafts
  const fetchHtmlPreview = useCallback(async (bodyText: string, subjectText: string) => {
    if (!bodyText.trim()) { setPreviewHtml(null); setPreviewSubjectLine(null); return; }
    setIsLoadingPreview(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/drafts/preview", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          body:    bodyText,
          subject: subjectText,
          row:     SAMPLE_ROW,
          style:   "clean",
        }),
      });
      if (!res.ok) throw new Error("Preview failed");
      const data = await res.json();
      setPreviewHtml(data.html ?? null);
      setPreviewSubjectLine(data.subject ?? null);
    } catch {
      setPreviewHtml(null);
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);

  // Debounce preview fetching when body/subject changes
  useEffect(() => {
    if (previewMode !== "html") return;
    const timer = setTimeout(() => fetchHtmlPreview(body, subject), 600);
    return () => clearTimeout(timer);
  }, [body, subject, previewMode, fetchHtmlPreview]);

  // Fetch preview immediately when switching to HTML tab
  const handleSetPreviewMode = (mode: "text" | "html") => {
    setPreviewMode(mode);
    if (mode === "html") fetchHtmlPreview(body, subject);
  };

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
              Company name, phone, and logo are applied automatically from your{" "}
              <Link href="/settings" className="text-blue-500 hover:underline">branding settings</Link>.
            </p>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              className="min-h-[360px] font-mono text-sm rounded-xl resize-none"
              placeholder={"Hi {name},\n\nI can get your {vehicle} shipped from {pickup} to {delivery} for {price}.\n\nLet me know if you'd like to move forward.\n\nBest regards,\n{agent_name}"}
            />
          </div>
        </div>

        {/* ── Right: live preview ── */}
        <div className="bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
          <div className="h-12 border-b border-slate-100 bg-slate-50/60 px-5 flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-400" />
            <h3 className="font-semibold text-slate-700 text-sm">Live Preview</h3>
            {isLoadingPreview && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400 ml-1" />}
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => handleSetPreviewMode("text")}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors ${
                  previewMode === "text"
                    ? "bg-slate-200 text-slate-900 font-medium"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Code2 className="h-3 w-3" /> Plain
              </button>
              <button
                onClick={() => handleSetPreviewMode("html")}
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
            <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: "420px" }}>
              {previewSubjectLine && (
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
                  <span className="text-xs text-slate-400 font-medium">Subject: </span>
                  <span className="text-xs text-slate-800 font-semibold">{previewSubjectLine}</span>
                </div>
              )}
              {previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  title="HTML Email Preview"
                  className="w-full flex-1 border-0"
                  style={{ minHeight: "380px" }}
                  sandbox="allow-same-origin"
                />
              ) : isLoadingPreview ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-slate-400">Start typing to see a preview</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 flex-1 space-y-6 bg-white min-h-[300px]">
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                <span className="font-medium">Sample data:</span>
                <span className="text-blue-600">Alex Johnson · Tesla Model Y · Miami → Seattle · $1,250 · #QT-10042</span>
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
