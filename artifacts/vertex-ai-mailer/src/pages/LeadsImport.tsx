import { useState, useRef, useMemo } from "react";
import { useGetTemplates, useGetGmailStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  UploadCloud, File as FileIcon, Loader2, CheckCircle2, XCircle,
  AlertCircle, ChevronRight, Mail, FileText, RefreshCw, AlertTriangle,
} from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  detectedColumns: string[];
  columnMappings: Record<string, string>;
  unmappedColumns: string[];
  headers: string[];
}

interface DraftRowResult {
  email: string;
  subject: string;
  status: "success" | "failed";
  gmailDraftId?: string;
  error?: string;
}

interface CreateResult {
  total: number;
  succeeded: number;
  failed: number;
  results: DraftRowResult[];
}

type EmailStyle = "clean" | "modern" | "minimal" | "luxury";

const EMAIL_STYLES: { value: EmailStyle; label: string; desc: string; preview: string }[] = [
  { value: "clean",   label: "Clean Professional", desc: "Blue header, crisp typography", preview: "bg-blue-600" },
  { value: "modern",  label: "Modern",              desc: "Purple gradient, card layout",  preview: "bg-gradient-to-r from-indigo-500 to-purple-600" },
  { value: "minimal", label: "Minimal",             desc: "Pure white, subtle accent",     preview: "bg-slate-200" },
  { value: "luxury",  label: "Luxury Transport",    desc: "Dark navy, gold accents",       preview: "bg-slate-900" },
];

const TEMPLATE_VARIABLES = [
  "name", "email", "vehicle", "pickup", "delivery",
  "price", "route", "company", "agent_name", "phone", "notes",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeKey(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function replaceVariables(text: string, row: Record<string, string>): string {
  return text.replace(/\{([^}]+)\}/g, (match, key) => {
    const val = row[key.trim()];
    return val != null ? String(val) : match;
  });
}

function looksLikePrice(val: string): boolean {
  return /^\$?[\d,]+\.?\d*$/.test(val.trim());
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LeadsImport() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [emailStyle, setEmailStyle] = useState<EmailStyle>("clean");
  const [isCreating, setIsCreating] = useState(false);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);

  // Custom column mappings: csvHeader → variableName (user can override)
  const [customMappings, setCustomMappings] = useState<Record<string, string>>({});

  const { data: templates, isLoading: templatesLoading } = useGetTemplates();
  const { data: gmailStatus } = useGetGmailStatus();

  const selectedTemplate = useMemo(
    () => templates?.find(t => t.id.toString() === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  // Effective mappings = auto-detected + user overrides
  const effectiveMappings = useMemo(() => {
    if (!parseResult) return {};
    return { ...parseResult.columnMappings, ...customMappings };
  }, [parseResult, customMappings]);

  // Rebuild rows with effective mappings applied
  const mappedRows = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.rows.map(row => {
      const newRow: Record<string, string> = {};
      // First, copy all raw snake_case values
      for (const header of parseResult.headers) {
        const key = normalizeKey(header);
        if (key && row[header] != null && row[header] !== false && row[header] !== true) {
          newRow[key] = String(row[header] ?? "");
        }
      }
      // Apply effective mappings (may override snake_case keys)
      for (const [header, variable] of Object.entries(effectiveMappings)) {
        const rawVal = row[header];
        if (rawVal != null && rawVal !== false && rawVal !== true && String(rawVal).trim()) {
          newRow[variable] = String(rawVal).trim();
        }
      }
      // Carry over bool flags
      newRow.hasValidEmail = String(row.hasValidEmail);
      newRow.isDuplicate = String(row.isDuplicate);
      return newRow;
    });
  }, [parseResult, effectiveMappings]);

  // First valid row for preview
  const previewRow = useMemo(
    () => mappedRows.find(r => r.hasValidEmail === "true" && r.isDuplicate === "false") ?? null,
    [mappedRows]
  );

  const previewSubject = useMemo(() => {
    if (!selectedTemplate || !previewRow) return null;
    return replaceVariables(selectedTemplate.subject, previewRow);
  }, [selectedTemplate, previewRow]);

  const previewBody = useMemo(() => {
    if (!selectedTemplate || !previewRow) return null;
    return replaceVariables(selectedTemplate.body, previewRow);
  }, [selectedTemplate, previewRow]);

  const readyCount = useMemo(
    () => mappedRows.filter(r => r.hasValidEmail === "true" && r.isDuplicate === "false").length,
    [mappedRows]
  );

  // Warnings about suspicious mappings
  const mappingWarnings = useMemo(() => {
    if (!parseResult || !previewRow) return [];
    const warns: string[] = [];
    if (previewRow.vehicle && looksLikePrice(previewRow.vehicle)) {
      warns.push(`"${previewRow.vehicle}" looks like a price, not a vehicle name.`);
    }
    return warns;
  }, [parseResult, previewRow]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setCreateResult(null);
    setCustomMappings({});
    await parseFile(f);
  }

  async function parseFile(f: File) {
    setIsUploading(true);
    setParseResult(null);
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
      const data: ParseResult = await res.json();
      setParseResult(data);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload Failed", description: err.message });
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCreateDrafts() {
    if (!selectedTemplate || readyCount === 0) return;

    setIsCreating(true);
    setCreateResult(null);

    const rows = mappedRows
      .filter(r => r.hasValidEmail === "true" && r.isDuplicate === "false")
      .map(r => {
        const row: Record<string, string> = {};
        for (const [k, v] of Object.entries(r)) {
          if (typeof v === "string" && v && k !== "hasValidEmail" && k !== "isDuplicate") {
            row[k] = v;
          }
        }
        return row;
      });

    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/drafts/from-template", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ templateId: selectedTemplate.id, rows, style: emailStyle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create drafts");
      setCreateResult(data);
      toast({
        title: `${data.succeeded} draft${data.succeeded !== 1 ? "s" : ""} created`,
        description: data.failed > 0 ? `${data.failed} failed — see details below.` : "All drafts created successfully.",
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsCreating(false);
    }
  }

  function handleReset() {
    setFile(null);
    setParseResult(null);
    setCreateResult(null);
    setCustomMappings({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const gmailConnected = gmailStatus?.connected;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upload & Send</h1>
        <p className="text-slate-500 mt-1 text-sm">Pick a template, upload your spreadsheet, and create Gmail drafts in seconds.</p>
      </div>

      {/* Gmail not connected warning */}
      {!gmailConnected && (
        <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Gmail not connected</p>
            <p className="text-xs text-amber-700 mt-0.5">You need to connect Gmail before creating drafts.</p>
          </div>
          <Button size="sm" asChild className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex-shrink-0">
            <Link href="/settings">Connect Gmail</Link>
          </Button>
        </div>
      )}

      {/* Step 1 + 2: Template + Upload side by side */}
      <div className="grid sm:grid-cols-2 gap-5">
        {/* Select Template */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</div>
            <h3 className="font-semibold text-slate-800 text-sm">Select Template</h3>
          </div>
          {templates?.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-slate-500 mb-3">No templates yet.</p>
              <Button asChild variant="outline" size="sm" className="rounded-xl gap-1.5">
                <Link href="/templates">
                  <FileText className="h-3.5 w-3.5" /> Create a template
                </Link>
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
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mt-1">
              <p className="text-xs text-slate-500 font-mono leading-relaxed line-clamp-3">
                {selectedTemplate.subject}
              </p>
            </div>
          )}
        </div>

        {/* Upload File */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
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
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {isUploading && (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-500 mb-2" />
              <p className="text-sm text-slate-500">Parsing columns…</p>
            </div>
          )}

          {file && parseResult && !isUploading && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <FileIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                  <p className="text-xs text-slate-400">{parseResult.totalRows} rows</p>
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
                <div className="text-center p-2 rounded-xl bg-red-50 border border-red-100">
                  <div className="text-lg font-bold text-red-600">{parseResult.duplicateRows}</div>
                  <div className="text-xs text-red-500">Duplicate</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step 3: Column Mapping Review + Email Style */}
      <AnimatePresence>
        {parseResult && !createResult && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</div>
              <h3 className="font-semibold text-slate-800 text-sm">Column Mapping</h3>
              <span className="text-xs text-slate-400 ml-1">— verify and correct variable assignments</span>
            </div>

            <div className="p-6 space-y-5">
              {/* Mapping warnings */}
              {mappingWarnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                  {w}
                </div>
              ))}

              {/* Column mapping table */}
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wider">CSV Column</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wider">Maps To Variable</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wider">Sample Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {parseResult.headers.map(header => {
                      const effectiveVar = effectiveMappings[header] ?? normalizeKey(header);
                      const isAutoMapped = !!parseResult.columnMappings[header];
                      const sampleVal = parseResult.rows[0]?.[header];
                      const isOverridden = !!customMappings[header];
                      const varIsAuto = isAutoMapped && !isOverridden;

                      return (
                        <tr key={header} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-slate-700 font-medium">{header}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <Select
                                value={effectiveVar}
                                onValueChange={(val) => {
                                  if (val === "__none__") {
                                    setCustomMappings(prev => {
                                      const next = { ...prev };
                                      delete next[header];
                                      return next;
                                    });
                                  } else {
                                    setCustomMappings(prev => ({ ...prev, [header]: val }));
                                  }
                                }}
                              >
                                <SelectTrigger className={`h-7 text-xs rounded-lg w-36 ${varIsAuto ? "border-emerald-200 bg-emerald-50 text-emerald-800" : isOverridden ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200"}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={normalizeKey(header)} className="text-xs">
                                    {normalizeKey(header)} (raw)
                                  </SelectItem>
                                  {TEMPLATE_VARIABLES.map(v => (
                                    <SelectItem key={v} value={v} className="text-xs">{`{${v}}`}</SelectItem>
                                  ))}
                                  <SelectItem value="__none__" className="text-xs text-slate-400">— skip —</SelectItem>
                                </SelectContent>
                              </Select>
                              {varIsAuto && (
                                <span className="text-emerald-600 text-xs font-medium">auto</span>
                              )}
                              {isOverridden && (
                                <span className="text-blue-600 text-xs font-medium">edited</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 font-mono truncate max-w-[160px]">
                            {sampleVal != null && sampleVal !== false ? String(sampleVal) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Email Style Selector */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Email Style</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {EMAIL_STYLES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setEmailStyle(s.value)}
                      className={`relative flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all ${
                        emailStyle === s.value
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      {/* Color swatch */}
                      <div className={`h-6 w-full rounded-md mb-2 ${s.preview}`} />
                      <p className={`text-xs font-semibold ${emailStyle === s.value ? "text-blue-800" : "text-slate-800"}`}>
                        {s.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-tight">{s.desc}</p>
                      {emailStyle === s.value && (
                        <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-blue-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 4: Preview + Create */}
      <AnimatePresence>
        {selectedTemplate && parseResult && readyCount > 0 && !createResult && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">4</div>
              <h3 className="font-semibold text-slate-800 text-sm">Preview — first row</h3>
              <ChevronRight className="h-4 w-4 text-slate-300" />
              <span className="text-xs text-slate-500 truncate">{previewRow?.email}</span>
            </div>

            <div className="p-6 grid sm:grid-cols-2 gap-6">
              {/* Column variables list */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Available Variables</h4>
                <div className="space-y-1.5">
                  {Object.entries(effectiveMappings).map(([col, variable]) => {
                    const sample = parseResult.rows[0]?.[col];
                    return (
                      <div key={col} className="flex items-center gap-2 text-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{`{${variable}}`}</code>
                        <span className="text-slate-400 truncate">= {sample != null ? String(sample) : "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rendered preview */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rendered Email (first row)</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Subject</p>
                    <p className="text-sm font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">{previewSubject}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Body (excerpt)</p>
                    <p className="text-xs text-slate-600 font-mono bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 whitespace-pre-wrap line-clamp-6">
                      {previewBody}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Create button */}
            <div className="px-6 py-5 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-900">{readyCount} draft{readyCount !== 1 ? "s" : ""}</span> will be created in Gmail Drafts.
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Style: <span className="font-medium text-slate-600">{EMAIL_STYLES.find(s => s.value === emailStyle)?.label}</span></p>
              </div>
              <Button
                onClick={handleCreateDrafts}
                disabled={isCreating || !gmailConnected}
                className="gap-2 rounded-xl px-6 flex-shrink-0"
              >
                {isCreating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                ) : (
                  <><Mail className="h-4 w-4" /> Create {readyCount} Gmail Draft{readyCount !== 1 ? "s" : ""}</>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 5: Results */}
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
                    : <AlertCircle className="h-6 w-6 text-amber-600" />
                  }
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    {createResult.succeeded} draft{createResult.succeeded !== 1 ? "s" : ""} created successfully
                    {createResult.failed > 0 && `, ${createResult.failed} failed`}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Check your Gmail Drafts folder to review and send.</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset} className="ml-auto rounded-xl gap-1.5 flex-shrink-0">
                  <RefreshCw className="h-3.5 w-3.5" /> Start over
                </Button>
              </div>
            </div>

            {createResult.failed > 0 && (
              <div className="p-6 space-y-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Failed rows</h4>
                {createResult.results
                  .filter(r => r.status === "failed")
                  .map((r, i) => (
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
