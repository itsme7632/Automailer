import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useGetTemplates } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  UploadCloud, File as FileIcon, Loader2, CheckCircle2, XCircle,
  AlertCircle, FileText, RefreshCw, PenLine, Server,
  Mail, ArrowRight, Sparkles, Eye, ChevronLeft, ChevronRight,
  User, AtSign, Car, MapPin, Hash, Clock, Layers, Zap,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

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

type EmailStyle = "clean" | "modern" | "minimal" | "luxury";
type SendMode   = "gmail" | "smtp";

const EMAIL_STYLES: { value: EmailStyle; label: string; desc: string; bg: string }[] = [
  { value: "clean",   label: "Clean",   desc: "Blue header",        bg: "#1d4ed8" },
  { value: "modern",  label: "Modern",  desc: "Purple accent",      bg: "#4f46e5" },
  { value: "minimal", label: "Minimal", desc: "White, thin accent", bg: "#e2e8f0" },
  { value: "luxury",  label: "Luxury",  desc: "Dark navy, gold",    bg: "#0f172a" },
];

function rowToRecord(row: ParsedRow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "hasValidEmail" || k === "isDuplicate") continue;
    if (typeof v === "string" && v) out[k] = v;
  }
  return out;
}

// ─── Email Preview Modal ───────────────────────────────────────────────────────

function EmailPreviewModal({
  open, onClose,
  templateId, rows, emailStyle, useSignatureBuilder,
}: {
  open: boolean;
  onClose: () => void;
  templateId: number;
  rows: ParsedRow[];
  emailStyle: EmailStyle;
  useSignatureBuilder: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [html, setHtml]   = useState<string | null>(null);
  const [subject, setSubject] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const current = rows[index];
  const total   = rows.length;

  const fetchPreview = useCallback(async (idx: number) => {
    if (!rows[idx]) return;
    setLoading(true); setError(null); setHtml(null);
    try {
      const token = localStorage.getItem("auth_token") ?? "";
      const res = await fetch("/api/drafts/preview", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          row: rowToRecord(rows[idx]),
          style: emailStyle,
          useSignatureBuilder,
        }),
      });
      if (!res.ok) throw new Error(`Preview failed (${res.status})`);
      const data = await res.json();
      setHtml(data.html ?? "");
      setSubject(data.subject ?? "");
    } catch (err: any) {
      setError(err.message ?? "Failed to load preview");
    } finally {
      setLoading(false);
    }
  }, [rows, templateId, emailStyle, useSignatureBuilder]);

  useEffect(() => {
    if (open) { setIndex(0); fetchPreview(0); }
  }, [open]);

  useEffect(() => {
    if (open) fetchPreview(index);
  }, [index]);

  function prev() { if (index > 0) setIndex(i => i - 1); }
  function next() { if (index < total - 1) setIndex(i => i + 1); }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold text-slate-900 truncate">
                {loading ? <Skeleton className="h-4 w-48 inline-block" /> : subject || "Email Preview"}
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Preview {index + 1} of {total} leads
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Button
                variant="outline" size="sm"
                onClick={prev} disabled={index === 0}
                className="h-8 w-8 p-0 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-mono text-slate-500 w-14 text-center">
                {index + 1} / {total}
              </span>
              <Button
                variant="outline" size="sm"
                onClick={next} disabled={index >= total - 1}
                className="h-8 w-8 p-0 rounded-lg"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Email preview */}
          <div className="flex-1 overflow-auto bg-slate-50 min-w-0">
            {loading && (
              <div className="p-6 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            )}
            {error && !loading && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                <AlertCircle className="h-8 w-8 text-slate-300" />
                <p className="text-sm">{error}</p>
                <Button variant="outline" size="sm" onClick={() => fetchPreview(index)} className="rounded-lg mt-1">
                  Retry
                </Button>
              </div>
            )}
            {html && !loading && (
              <iframe
                srcDoc={html}
                className="w-full h-full border-0 min-h-[500px]"
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            )}
          </div>

          {/* Customer details panel */}
          <div className="w-64 flex-shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
            <div className="p-4 space-y-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Customer Details
              </h3>

              {current && (
                <div className="space-y-3">
                  {current.name && (
                    <div className="flex items-start gap-2">
                      <User className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400">Name</p>
                        <p className="text-sm font-medium text-slate-800 break-words">{current.name}</p>
                      </div>
                    </div>
                  )}
                  {current.email && (
                    <div className="flex items-start gap-2">
                      <AtSign className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400">Email</p>
                        <p className="text-xs font-mono text-slate-700 break-all">{current.email}</p>
                      </div>
                    </div>
                  )}
                  {current.vehicle && (
                    <div className="flex items-start gap-2">
                      <Car className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400">Vehicle</p>
                        <p className="text-sm text-slate-800 break-words">{current.vehicle}</p>
                      </div>
                    </div>
                  )}
                  {(current.pickup || current.delivery) && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400">Route</p>
                        {current.pickup && <p className="text-xs text-slate-700">{current.pickup}</p>}
                        {current.delivery && (
                          <p className="text-xs text-slate-700">→ {current.delivery}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {(current as any).quote_id && (
                    <div className="flex items-start gap-2">
                      <Hash className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400">Quote ID</p>
                        <p className="text-xs font-mono text-violet-700 break-words">{(current as any).quote_id}</p>
                      </div>
                    </div>
                  )}
                  {current.price && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-slate-400 font-medium flex-shrink-0 mt-0.5">$</span>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400">Price</p>
                        <p className="text-sm font-semibold text-emerald-700">{current.price}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  Keyboard: ← → to navigate
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function LeadsImport() {
  const { toast }     = useToast();
  const [, navigate]  = useLocation();
  const fileInputRef  = useRef<HTMLInputElement>(null);

  const [file, setFile]                               = useState<File | null>(null);
  const [isUploading, setIsUploading]                 = useState(false);
  const [parseResult, setParseResult]                 = useState<ParseResult | null>(null);
  const [selectedTemplateId, setSelectedTemplateId]   = useState<string>("");
  const [emailStyle, setEmailStyle]                   = useState<EmailStyle>("clean");
  const [useSignatureBuilder, setUseSignatureBuilder] = useState(false);
  const [sendMode, setSendMode]                       = useState<SendMode>("gmail");
  const [campaignName, setCampaignName]               = useState<string>("");
  const [isCreating, setIsCreating]                   = useState(false);
  const [mailboxConnected, setMailboxConnected]       = useState(false);
  const [showPreview, setShowPreview]                 = useState(false);

  const { data: templates, isLoading: templatesLoading } = useGetTemplates();

  const selectedTemplate = useMemo(
    () => templates?.find(t => t.id.toString() === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const readyRows = useMemo<ParsedRow[]>(
    () => parseResult?.rows.filter(r => r.hasValidEmail === true && r.isDuplicate === false) ?? [],
    [parseResult]
  );

  useEffect(() => {
    if (file && !campaignName) {
      const base = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      setCampaignName(base.charAt(0).toUpperCase() + base.slice(1));
    }
  }, [file, campaignName]);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch("/api/users/branding", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (typeof d.useSignature === "boolean") setUseSignatureBuilder(d.useSignature); })
      .catch(() => {});
    fetch("/api/mailbox", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d?.smtpHost) setMailboxConnected(true); })
      .catch(() => {});
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    await parseFile(f);
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setFile(f);
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

  async function handleCreateCampaign() {
    if (!selectedTemplate || readyRows.length === 0 || !campaignName.trim()) return;
    setIsCreating(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/campaigns/from-upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name:        campaignName.trim(),
          templateId:  selectedTemplate.id,
          sendMode,
          emailStyle,
          useSignature: useSignatureBuilder,
          fileName:    file?.name ?? "",
          rows:        readyRows,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create campaign");

      toast({
        title: `Campaign created — ${data.valid} leads imported`,
        description: "Go to your campaign to start sending.",
      });
      navigate(`/campaigns/${data.campaignId}`);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally { setIsCreating(false); }
  }

  function handleReset() {
    setFile(null); setParseResult(null); setCampaignName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const readyCount = readyRows.length;
  const canCreate  = !!selectedTemplate && readyCount > 0 && !!campaignName.trim();
  const canPreview = !!selectedTemplate && readyCount > 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Campaign</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Upload your lead list and create a persistent campaign — then send in batches from the campaign page.
        </p>
      </div>

      {/* Step 1 + 2: Template + Upload */}
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
            <>
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
              {selectedTemplate && (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-xs text-slate-500 font-mono line-clamp-2">{selectedTemplate.subject}</p>
                </div>
              )}
            </>
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
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              <UploadCloud className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">Click or drag to upload</p>
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
                  <p className="text-xs text-slate-400">{parseResult.totalRows} rows · {parseResult.detectedFields.length} fields</p>
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
              {parseResult.detectedFields.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {parseResult.detectedFields.map(f => (
                    <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-xs text-blue-700">
                      <CheckCircle2 className="h-2.5 w-2.5" />{f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Step 3: Configure Campaign */}
      <AnimatePresence>
        {selectedTemplate && parseResult && readyCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</div>
                <h3 className="font-semibold text-slate-800 text-sm">Configure Campaign</h3>
              </div>

              {/* Campaign Name */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Campaign Name</label>
                <Input
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder="e.g. May Leads Batch 1"
                  className="rounded-xl border-slate-200"
                  maxLength={80}
                />
              </div>

              {/* Send Mode */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Send Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSendMode("gmail")}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                      sendMode === "gmail" ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <Mail className={`h-4 w-4 flex-shrink-0 ${sendMode === "gmail" ? "text-blue-600" : "text-slate-400"}`} />
                    <div>
                      <p className={`text-xs font-semibold ${sendMode === "gmail" ? "text-blue-800" : "text-slate-700"}`}>Gmail Drafts</p>
                      <p className="text-xs text-slate-400">Create drafts with AI</p>
                    </div>
                    {sendMode === "gmail" && <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 ml-auto flex-shrink-0" />}
                  </button>
                  <button
                    onClick={() => setSendMode("smtp")}
                    disabled={!mailboxConnected}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                      !mailboxConnected ? "opacity-50 cursor-not-allowed border-slate-200" :
                      sendMode === "smtp" ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <Server className={`h-4 w-4 flex-shrink-0 ${sendMode === "smtp" ? "text-blue-600" : "text-slate-400"}`} />
                    <div>
                      <p className={`text-xs font-semibold ${sendMode === "smtp" ? "text-blue-800" : "text-slate-700"}`}>SMTP Direct</p>
                      <p className="text-xs text-slate-400">{mailboxConnected ? "Rate-limited send" : "No mailbox configured"}</p>
                    </div>
                    {sendMode === "smtp" && <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 ml-auto flex-shrink-0" />}
                  </button>
                </div>
                {!mailboxConnected && (
                  <p className="text-xs text-slate-400 mt-1.5">
                    <Link href="/mailbox" className="text-blue-500 hover:underline">Configure SMTP mailbox</Link> to enable direct sending.
                  </p>
                )}
              </div>

              {/* Email Style */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Email Style</label>
                <div className="grid grid-cols-4 gap-2">
                  {EMAIL_STYLES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setEmailStyle(s.value)}
                      className={`relative flex flex-col items-start p-2.5 rounded-xl border-2 text-left transition-all ${
                        emailStyle === s.value ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="h-3 w-full rounded mb-1.5" style={{ backgroundColor: s.bg }} />
                      <p className={`text-xs font-semibold leading-tight ${emailStyle === s.value ? "text-blue-800" : "text-slate-800"}`}>{s.label}</p>
                      {emailStyle === s.value && <CheckCircle2 className="absolute top-1.5 right-1.5 h-3 w-3 text-blue-600" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Signature toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <PenLine className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Signature Builder</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {useSignatureBuilder ? "Auto-appends branding signature" : "Off — template sent as written"}
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

            {/* Campaign Summary + Actions */}
            <div className="px-5 py-4 bg-slate-50 space-y-4">
              {/* Summary grid */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Campaign Summary</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-white rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Layers className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-xs text-slate-500">Total Leads</span>
                    </div>
                    <p className="text-xl font-bold text-slate-900">{readyCount}</p>
                    {parseResult && (parseResult.invalidRows > 0 || parseResult.duplicateRows > 0) && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        +{parseResult.invalidRows + parseResult.duplicateRows} skipped
                      </p>
                    )}
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      {sendMode === "gmail"
                        ? <Mail className="h-3.5 w-3.5 text-blue-500" />
                        : <Server className="h-3.5 w-3.5 text-blue-500" />}
                      <span className="text-xs text-slate-500">Method</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">
                      {sendMode === "gmail" ? "Gmail Drafts" : "SMTP Direct"}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs text-slate-500">Style</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 capitalize">{emailStyle}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {useSignatureBuilder ? "Signature on" : "No signature"}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <FileText className="h-3.5 w-3.5 text-violet-500" />
                      <span className="text-xs text-slate-500">Template</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 truncate">{selectedTemplate?.name}</p>
                  </div>
                </div>

                {parseResult && (parseResult.duplicateRows > 0 || parseResult.invalidRows > 0) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {parseResult.duplicateRows > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-xs text-slate-600">
                        <XCircle className="h-3 w-3 text-slate-400" />
                        {parseResult.duplicateRows} duplicate{parseResult.duplicateRows !== 1 ? "s" : ""} removed
                      </span>
                    )}
                    {parseResult.invalidRows > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-xs text-amber-700">
                        <AlertCircle className="h-3 w-3" />
                        {parseResult.invalidRows} missing email{parseResult.invalidRows !== 1 ? "s" : ""} skipped
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {canPreview && (
                  <Button
                    variant="outline"
                    onClick={() => setShowPreview(true)}
                    className="rounded-xl gap-2 border-slate-300"
                  >
                    <Eye className="h-4 w-4" /> Preview Emails
                  </Button>
                )}
                <Button
                  onClick={handleCreateCampaign}
                  disabled={!canCreate || isCreating}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2 px-5 ml-auto"
                >
                  {isCreating
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                    : <><Sparkles className="h-4 w-4" /> Create Campaign <ArrowRight className="h-3.5 w-3.5" /></>}
                </Button>
              </div>

              {!campaignName.trim() && (
                <p className="text-xs text-amber-600 flex items-center gap-1 -mt-2">
                  <AlertCircle className="h-3 w-3" /> Enter a campaign name above to continue.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state if no template */}
      {!templatesLoading && templates?.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">No email templates found</p>
            <p className="text-xs text-amber-700 mt-0.5">Create a template before importing leads.</p>
            <Button asChild size="sm" variant="outline" className="mt-3 rounded-xl gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-100">
              <Link href="/templates"><FileText className="h-3.5 w-3.5" /> Create Template</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {canPreview && selectedTemplate && (
        <EmailPreviewModal
          open={showPreview}
          onClose={() => setShowPreview(false)}
          templateId={selectedTemplate.id}
          rows={readyRows}
          emailStyle={emailStyle}
          useSignatureBuilder={useSignatureBuilder}
        />
      )}
    </div>
  );
}
