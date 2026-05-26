import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useGetTemplates, useGetGmailStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  UploadCloud, File as FileIcon, Loader2, CheckCircle2, XCircle,
  AlertCircle, Mail, FileText, RefreshCw, Zap, PenLine, Server,
  SendHorizonal, Clock, Gauge, Shield, ChevronDown, ChevronUp,
} from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { SendProgressPanel } from "@/components/SendProgressPanel";
import type { JobStatus } from "@/components/SendProgressPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedRow {
  email?: string | null;
  name?: string | null;
  vehicle?: string | null;
  pickup?: string | null;
  delivery?: string | null;
  price?: string | null;
  route?: string | null;
  company?: string | null;
  phone?: string | null;
  notes?: string | null;
  hasValidEmail: boolean;
  isDuplicate: boolean;
  [key: string]: string | boolean | null | undefined;
}

interface ParseResult {
  rows: ParsedRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  detectedFields: string[];
  headers: string[];
}

interface DraftRowResult {
  email: string; subject: string; status: "success" | "failed";
  gmailDraftId?: string; error?: string;
}

interface CreateResult {
  total: number; succeeded: number; failed: number; results: DraftRowResult[];
}

interface MailboxRateSettings {
  batchSize: number;
  delaySeconds: number;
  maxPerHour: number;
}

type EmailStyle = "clean" | "modern" | "minimal" | "luxury";

const EMAIL_STYLES: { value: EmailStyle; label: string; desc: string; bg: string }[] = [
  { value: "clean",   label: "Clean",   desc: "Blue header",         bg: "#1d4ed8" },
  { value: "modern",  label: "Modern",  desc: "Purple accent",       bg: "#4f46e5" },
  { value: "minimal", label: "Minimal", desc: "White, thin accent",  bg: "#e2e8f0" },
  { value: "luxury",  label: "Luxury",  desc: "Dark navy, gold",     bg: "#0f172a" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toStringRow(row: ParsedRow): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "hasValidEmail" || k === "isDuplicate") continue;
    if (typeof v === "string" && v.trim()) result[k] = v;
  }
  return result;
}

function replaceVarsText(text: string, row: Record<string, string>): string {
  return text.replace(/\{([^}]+)\}/g, (match, key) => row[key.trim()] ?? match);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeadsImport() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile]                           = useState<File | null>(null);
  const [isUploading, setIsUploading]             = useState(false);
  const [parseResult, setParseResult]             = useState<ParseResult | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [emailStyle, setEmailStyle]               = useState<EmailStyle>("clean");
  const [useSignatureBuilder, setUseSignatureBuilder] = useState(false);
  const [isCreating, setIsCreating]               = useState(false);
  const [createResult, setCreateResult]           = useState<CreateResult | null>(null);

  const [mailboxConnected, setMailboxConnected]   = useState(false);
  const [mailboxRates, setMailboxRates]           = useState<MailboxRateSettings>({ batchSize: 10, delaySeconds: 15, maxPerHour: 100 });
  const [sendMode, setSendMode]                   = useState<"gmail" | "smtp">("gmail");

  // SMTP send state — job-based
  const [smtpSending, setSmtpSending]             = useState(false);
  const [currentJobId, setCurrentJobId]           = useState<string | null>(null);
  const [smtpJobDelay, setSmtpJobDelay]           = useState(15);
  const [smtpBatchOverride, setSmtpBatchOverride] = useState<number | null>(null);
  const [showBatchOptions, setShowBatchOptions]   = useState(false);

  const [previewHtml, setPreviewHtml]             = useState<string | null>(null);
  const [previewSubject, setPreviewSubject]       = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview]   = useState(false);

  const { data: templates, isLoading: templatesLoading } = useGetTemplates();
  const { data: gmailStatus } = useGetGmailStatus();

  const selectedTemplate = useMemo(
    () => templates?.find(t => t.id.toString() === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const readyRows = useMemo<ParsedRow[]>(
    () => parseResult?.rows.filter(r => r.hasValidEmail === true && r.isDuplicate === false) ?? [],
    [parseResult]
  );

  const previewRow = useMemo(() => readyRows[0] ? toStringRow(readyRows[0]) : null, [readyRows]);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch("/api/users/branding", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (typeof d.useSignature === "boolean") setUseSignatureBuilder(d.useSignature); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch("/api/mailbox", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d?.smtpHost) {
          setMailboxConnected(true);
          setMailboxRates({
            batchSize:    d.batchSize    ?? 10,
            delaySeconds: d.delaySeconds ?? 15,
            maxPerHour:   d.maxPerHour   ?? 100,
          });
        }
      })
      .catch(() => {});
  }, []);

  const fetchPreview = useCallback(async (
    templateId: number,
    row: Record<string, string>,
    style: EmailStyle,
    sigBuilder: boolean
  ) => {
    setIsLoadingPreview(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/drafts/preview", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, row, style, useSignatureBuilder: sigBuilder }),
      });
      if (!res.ok) throw new Error("Preview failed");
      const data = await res.json();
      setPreviewHtml(data.html ?? null);
      setPreviewSubject(data.subject ?? null);
    } catch {
      setPreviewHtml(null);
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedTemplate || !previewRow) { setPreviewHtml(null); setPreviewSubject(null); return; }
    const timer = setTimeout(() => {
      fetchPreview(selectedTemplate.id, previewRow, emailStyle, useSignatureBuilder);
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedTemplate, previewRow, emailStyle, useSignatureBuilder, fetchPreview]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setCreateResult(null); setCurrentJobId(null);
    await parseFile(f);
  }

  async function parseFile(f: File) {
    setIsUploading(true); setParseResult(null);
    try {
      const formData = new FormData();
      formData.append("file", f);
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/uploads/parse", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to parse file");
      }
      setParseResult(await res.json());
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload Failed", description: err.message });
      setFile(null);
    } finally { setIsUploading(false); }
  }

  async function handleCreateDrafts() {
    if (!selectedTemplate || readyRows.length === 0) return;
    setIsCreating(true); setCreateResult(null);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/drafts/from-template", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          rows: readyRows.map(toStringRow),
          style: emailStyle,
          useSignatureBuilder,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create drafts");
      setCreateResult(data);
      toast({
        title: `${data.succeeded} draft${data.succeeded !== 1 ? "s" : ""} created in Gmail`,
        description: data.failed > 0 ? `${data.failed} failed — see details below.` : "Open Gmail Drafts to review and send.",
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally { setIsCreating(false); }
  }

  async function handleSmtpSend() {
    if (!selectedTemplate || readyRows.length === 0) return;
    const batchSize = smtpBatchOverride ?? mailboxRates.batchSize;
    setSmtpSending(true); setCurrentJobId(null);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/mailbox/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          rows: readyRows.map(toStringRow),
          style: emailStyle,
          useSignatureBuilder,
          batchSize,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setCurrentJobId(data.jobId);
      setSmtpJobDelay(data.delaySeconds ?? mailboxRates.delaySeconds);
      toast({
        title: `${data.total} email${data.total !== 1 ? "s" : ""} queued`,
        description: `Sending with ${data.delaySeconds}s delay. Track progress below.`,
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Send Error", description: err.message });
    } finally { setSmtpSending(false); }
  }

  async function handleRetryFailed() {
    if (!selectedTemplate || !createResult) return;
    const failedEmails = new Set(createResult.results.filter(r => r.status === "failed").map(r => r.email));
    const failedRows = readyRows.filter(r => failedEmails.has(r.email ?? ""));
    if (failedRows.length === 0) return;
    setIsCreating(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/drafts/from-template", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          rows: failedRows.map(toStringRow),
          style: emailStyle,
          useSignatureBuilder,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Retry failed");
      toast({ title: `Retry: ${data.succeeded} more drafts created.` });
      setCreateResult(prev => prev ? {
        ...prev, succeeded: prev.succeeded + data.succeeded, failed: data.failed,
        results: [...prev.results.filter(r => r.status === "success"), ...data.results],
      } : data);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Retry Error", description: err.message });
    } finally { setIsCreating(false); }
  }

  function handleReset() {
    setFile(null); setParseResult(null); setCreateResult(null);
    setPreviewHtml(null); setPreviewSubject(null);
    setCurrentJobId(null); setSendMode("gmail");
    setSmtpBatchOverride(null); setShowBatchOptions(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const gmailConnected = gmailStatus?.connected;
  const readyCount = readyRows.length;
  const activeBatch = smtpBatchOverride ?? mailboxRates.batchSize;
  const emailsToSend = Math.min(activeBatch > 0 ? activeBatch : readyCount, readyCount);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upload & Send</h1>
        <p className="text-slate-500 mt-1 text-sm">Upload your spreadsheet, pick a template, and deliver personalized emails at scale.</p>
      </div>

      {/* Gmail not connected */}
      {!gmailConnected && (
        <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Gmail not connected</p>
            <p className="text-xs text-amber-700 mt-0.5">Connect Gmail in Settings before creating drafts.</p>
          </div>
          <Button size="sm" asChild className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex-shrink-0">
            <Link href="/settings">Connect Gmail</Link>
          </Button>
        </div>
      )}

      {/* Steps 1+2: Template + Upload */}
      <div className="grid sm:grid-cols-2 gap-5">
        {/* Step 1: Template */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</div>
            <h3 className="font-semibold text-slate-800 text-sm">Select Template</h3>
          </div>
          {templates?.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-slate-500 mb-3">No templates yet.</p>
              <Button asChild variant="outline" size="sm" className="rounded-xl gap-1.5">
                <Link href="/templates"><FileText className="h-3.5 w-3.5" /> Create template</Link>
              </Button>
            </div>
          ) : (
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="rounded-xl border-slate-200">
                <SelectValue placeholder={templatesLoading ? "Loading…" : "Choose a template"} />
              </SelectTrigger>
              <SelectContent>
                {templates?.map(t => (
                  <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedTemplate && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-xs text-slate-500 font-mono line-clamp-2">{selectedTemplate.subject}</p>
            </div>
          )}
        </div>

        {/* Step 2: Upload */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</div>
            <h3 className="font-semibold text-slate-800 text-sm">Upload Spreadsheet</h3>
          </div>

          {!file && !isUploading && (
            <div
              className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">Click to upload</p>
              <p className="text-xs text-slate-400 mt-0.5">CSV or XLSX · max 10MB</p>
              <input ref={fileInputRef} type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} />
            </div>
          )}

          {isUploading && (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-500 mb-2" />
              <p className="text-sm text-slate-500">Auto-detecting columns…</p>
            </div>
          )}

          {file && parseResult && !isUploading && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <FileIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                  <p className="text-xs text-slate-400">{parseResult.totalRows} rows · {parseResult.detectedFields.length} fields detected</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleReset} className="text-slate-400 hover:text-slate-600 h-7 px-2">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="text-lg font-bold text-emerald-700">{readyCount}</div>
                  <div className="text-xs text-emerald-600">Ready</div>
                </div>
                <div className="text-center p-2 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="text-lg font-bold text-amber-700">{parseResult.invalidRows}</div>
                  <div className="text-xs text-amber-600">No Email</div>
                </div>
                <div className="text-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-lg font-bold text-slate-600">{parseResult.duplicateRows}</div>
                  <div className="text-xs text-slate-500">Duplicate</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step 3: Style + Preview + Delivery */}
      <AnimatePresence>
        {selectedTemplate && parseResult && readyCount > 0 && !currentJobId && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            {/* Email Style */}
            <div className="px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</div>
                <h3 className="font-semibold text-slate-800 text-sm">Email Style</h3>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-5">
                {EMAIL_STYLES.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setEmailStyle(s.value)}
                    className={`relative flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all ${
                      emailStyle === s.value ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="h-4 w-full rounded mb-2" style={{ backgroundColor: s.bg }} />
                    <p className={`text-xs font-semibold leading-tight ${emailStyle === s.value ? "text-blue-800" : "text-slate-800"}`}>{s.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-tight">{s.desc}</p>
                    {emailStyle === s.value && <CheckCircle2 className="absolute top-2 right-2 h-3.5 w-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>

              {/* Signature builder toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <PenLine className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Signature Builder</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {useSignatureBuilder
                        ? "Auto-appends a signature using your branding variables"
                        : "Off — your template content is sent exactly as written"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setUseSignatureBuilder(s => !s)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                    useSignatureBuilder ? "bg-blue-600" : "bg-slate-200"
                  }`}
                  role="switch"
                  aria-checked={useSignatureBuilder}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                    useSignatureBuilder ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>
            </div>

            {/* Live HTML Preview */}
            <div className="px-6 py-5 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-slate-700 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">↓</div>
                  <h3 className="font-semibold text-slate-800 text-sm">Preview — first row</h3>
                  {previewRow?.email && <span className="text-xs text-slate-400">{previewRow.email}</span>}
                </div>
                {isLoadingPreview && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
              </div>

              {previewSubject && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-400 font-medium">Subject</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{previewSubject}</p>
                </div>
              )}

              {parseResult.detectedFields.length > 0 && previewRow && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {parseResult.detectedFields.map(f =>
                    previewRow[f] ? (
                      <span key={f} className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-mono">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        {`{${f}}`} = {String(previewRow[f]).substring(0, 22)}{String(previewRow[f]).length > 22 ? "…" : ""}
                      </span>
                    ) : null
                  )}
                </div>
              )}

              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                {previewHtml ? (
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full"
                    style={{ height: "420px", border: "none" }}
                    sandbox="allow-same-origin"
                    title="Email Preview"
                  />
                ) : isLoadingPreview ? (
                  <div className="h-48 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center">
                    <p className="text-sm text-slate-400">Select a template and upload a file to see preview</p>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Method */}
            <div className="px-6 py-5 border-b border-slate-100 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">4</div>
                <h3 className="font-semibold text-slate-800 text-sm">Delivery Method</h3>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {/* Gmail Drafts */}
                <button
                  type="button"
                  onClick={() => setSendMode("gmail")}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                    sendMode === "gmail" ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Mail className={`h-5 w-5 mt-0.5 flex-shrink-0 ${sendMode === "gmail" ? "text-blue-600" : "text-slate-400"}`} />
                  <div>
                    <p className={`text-sm font-semibold ${sendMode === "gmail" ? "text-blue-900" : "text-slate-700"}`}>Gmail Drafts</p>
                    <p className="text-xs text-slate-500 mt-0.5">Saved to your Gmail. You review and send manually.</p>
                    {!gmailConnected && <p className="text-xs text-amber-600 mt-1">⚠ Gmail not connected</p>}
                  </div>
                  {sendMode === "gmail" && <CheckCircle2 className="h-4 w-4 text-blue-600 ml-auto flex-shrink-0" />}
                </button>

                {/* SMTP Direct Send */}
                <button
                  type="button"
                  onClick={() => setSendMode("smtp")}
                  disabled={!mailboxConnected}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                    !mailboxConnected ? "border-slate-100 bg-slate-50 cursor-not-allowed opacity-60" :
                    sendMode === "smtp" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Server className={`h-5 w-5 mt-0.5 flex-shrink-0 ${sendMode === "smtp" ? "text-emerald-600" : "text-slate-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${sendMode === "smtp" ? "text-emerald-900" : "text-slate-700"}`}>
                      Send via SMTP
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {mailboxConnected
                        ? "Sent directly from your mailbox with rate-limited delivery."
                        : "Connect a mailbox in Mailbox Settings first."}
                    </p>
                  </div>
                  {sendMode === "smtp" && <CheckCircle2 className="h-4 w-4 text-emerald-600 ml-auto flex-shrink-0" />}
                </button>
              </div>

              {/* SMTP rate-limiter summary + batch override */}
              {sendMode === "smtp" && mailboxConnected && (
                <div className="space-y-3">
                  {/* Rate settings summary from mailbox */}
                  <div className="flex flex-wrap gap-3 p-3 rounded-xl bg-violet-50 border border-violet-100">
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-violet-500" />
                      <span className="text-xs font-semibold text-violet-800">Sending Protection Active</span>
                    </div>
                    <div className="h-3 w-px bg-violet-200" />
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-violet-500" />
                      <span className="text-xs text-violet-700">{mailboxRates.delaySeconds}s delay</span>
                    </div>
                    <div className="h-3 w-px bg-violet-200" />
                    <div className="flex items-center gap-1.5">
                      <Gauge className="h-3.5 w-3.5 text-violet-500" />
                      <span className="text-xs text-violet-700">{mailboxRates.maxPerHour}/hr limit</span>
                    </div>
                    <Link href="/mailbox">
                      <span className="text-xs text-violet-600 underline cursor-pointer ml-auto">Edit</span>
                    </Link>
                  </div>

                  {/* Batch size override */}
                  <button
                    type="button"
                    onClick={() => setShowBatchOptions(b => !b)}
                    className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 font-medium"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Batch size: <span className="text-slate-800">{activeBatch} emails</span>
                    {showBatchOptions
                      ? <ChevronUp className="h-3.5 w-3.5 ml-0.5" />
                      : <ChevronDown className="h-3.5 w-3.5 ml-0.5" />}
                  </button>

                  {showBatchOptions && (
                    <div className="flex flex-wrap gap-2 pl-1">
                      {[10, 25, 50, 100, 0].map(n => (
                        <button
                          key={n} type="button"
                          onClick={() => setSmtpBatchOverride(n === 0 ? null : n)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-colors ${
                            (n === 0 ? smtpBatchOverride === null : smtpBatchOverride === n)
                              ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {n === 0 ? `Default (${mailboxRates.batchSize})` : `${n}`}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSmtpBatchOverride(readyCount)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-colors ${
                          smtpBatchOverride === readyCount
                            ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        All ({readyCount})
                      </button>
                    </div>
                  )}

                  <p className="text-xs text-slate-400">
                    Will queue <span className="font-semibold text-slate-600">{emailsToSend}</span> of {readyCount} emails.
                    ETA ≈ {Math.round((emailsToSend * mailboxRates.delaySeconds) / 60)} min at {mailboxRates.delaySeconds}s/email.
                  </p>
                </div>
              )}
            </div>

            {/* Action button */}
            <div className="px-6 py-5 flex items-center justify-between gap-4">
              <div>
                {sendMode === "gmail" ? (
                  <>
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">{readyCount} draft{readyCount !== 1 ? "s" : ""}</span> will be saved to Gmail.
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">Never auto-sent — review before sending.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">{emailsToSend} email{emailsToSend !== 1 ? "s" : ""}</span> will be queued and sent via SMTP.
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{mailboxRates.delaySeconds}s between each email · auto-retry on failure.</p>
                  </>
                )}
              </div>

              {sendMode === "gmail" ? (
                <Button
                  onClick={handleCreateDrafts}
                  disabled={isCreating || !gmailConnected}
                  className="gap-2 rounded-xl px-6 flex-shrink-0 bg-blue-600 hover:bg-blue-700"
                >
                  {isCreating
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                    : <><Zap className="h-4 w-4" /> Create {readyCount} Gmail Draft{readyCount !== 1 ? "s" : ""}</>}
                </Button>
              ) : (
                <Button
                  onClick={handleSmtpSend}
                  disabled={smtpSending || !mailboxConnected}
                  className="gap-2 rounded-xl px-6 flex-shrink-0 bg-emerald-600 hover:bg-emerald-700"
                >
                  {smtpSending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Queuing…</>
                    : <><SendHorizonal className="h-4 w-4" /> Send {emailsToSend} Email{emailsToSend !== 1 ? "s" : ""}</>}
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SMTP Send Progress Panel */}
      <AnimatePresence>
        {currentJobId && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <SendProgressPanel
              jobId={currentJobId}
              delaySeconds={smtpJobDelay}
              onComplete={(status: JobStatus) => {
                if (status.failed === 0) {
                  toast({ title: `${status.sent} email${status.sent !== 1 ? "s" : ""} delivered`, description: "All emails sent successfully." });
                } else {
                  toast({ variant: "destructive", title: `${status.sent} sent · ${status.failed} failed`, description: "Use Retry Failed to resend failed emails." });
                }
              }}
              onReset={handleReset}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gmail Drafts Results */}
      <AnimatePresence>
        {createResult && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${createResult.failed === 0 ? "bg-emerald-50" : "bg-amber-50"}`}>
                  {createResult.failed === 0
                    ? <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    : <AlertCircle className="h-6 w-6 text-amber-600" />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">
                    {createResult.succeeded} draft{createResult.succeeded !== 1 ? "s" : ""} created in Gmail
                    {createResult.failed > 0 && ` · ${createResult.failed} failed`}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Open Gmail Drafts to review and send.</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {createResult.failed > 0 && (
                    <Button variant="outline" size="sm" onClick={handleRetryFailed} disabled={isCreating} className="rounded-xl gap-1.5">
                      {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Retry failed
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleReset} className="rounded-xl gap-1.5">
                    <UploadCloud className="h-3.5 w-3.5" /> New upload
                  </Button>
                </div>
              </div>
            </div>
            {createResult.failed > 0 && (
              <div className="p-5 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Failed rows</p>
                {createResult.results.filter(r => r.status === "failed").map((r, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{r.email || "(no email)"}</p>
                      <p className="text-xs text-red-600 mt-0.5">{r.error ?? "Unknown error"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/40">
              <Button asChild variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 gap-1.5">
                <Link href="/drafts"><Mail className="h-3.5 w-3.5" /> View all Gmail drafts →</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
