import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Palette, Server, Bot, Users, CreditCard, Shield, FileText,
  BarChart3, Save, RefreshCw, CheckCircle2, AlertTriangle, Loader2,
  Globe, Mail, Activity, Database,
  AlertCircle, ChevronDown, ChevronUp,
  Eye, EyeOff,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SettingsMap = Record<string, string>;

interface QueueStatus {
  pending: number;
  sending: number;
  success: number;
  failed: number;
  totalJobs: number;
  last24h: number;
}

interface AnalyticsSummary {
  totalEmailsSent: number;
  totalFailed: number;
  successRate: string;
  activeUsers: number;
  totalUsers: number;
  smtpMailboxes: number;
  emailsToday: number;
  emailsThisMonth: number;
  aiUsageToday: number;
}

type SubTab =
  | "general" | "branding" | "smtp" | "ai"
  | "users" | "billing" | "security" | "cms" | "analytics";

// ─── Default values ───────────────────────────────────────────────────────────

const DEFAULTS: SettingsMap = {
  // General
  platformName:    "BrokerMail AI",
  supportEmail:    "",
  contactPhone:    "",
  companyAddress:  "",
  footerText:      "Built for the auto transport industry.",
  maintenanceMode: "false",
  // Branding
  defaultAccentColor:  "#1d4ed8",
  defaultEmailSlogan:  "Your #1 Auto Transport Partner",
  defaultEmailStyle:   "clean",
  defaultButtonStyle:  "rounded",
  defaultFont:         "inter",
  // SMTP
  defaultBatchSize:    "10",
  defaultDelaySeconds: "15",
  defaultMaxPerHour:   "100",
  queueEnabled:        "true",
  autoRetryEnabled:    "true",
  maxRetryAttempts:    "3",
  // AI
  aiModel:        "gpt-4o-mini",
  aiEnabled:      "true",
  aiTemperature:  "0.7",
  dailyAiLimit:   "500",
  // Users
  allowRegistrations:      "true",
  requireEmailVerification: "false",
  freeMonthlyEmailLimit:   "100",
  freeBatchLimit:          "10",
  autoSuspendOnAbuse:      "false",
  // Billing
  stripePublishableKey:  "",
  stripeWebhookSecret:   "",
  creditsPerDollar:      "100",
  creditSystemEnabled:   "false",
  freeTrialDays:         "0",
  // Security
  sessionTimeoutHours:     "24",
  loginRateLimit:          "10",
  failedLoginThreshold:    "5",
  requireAdminMfa:         "false",
  maxEmailsPerDay:         "1000",
  maxLeadsPerUpload:       "10000",
  emailLimitPerUser:       "500",
  // CMS
  heroTitle:       "Close more transport deals with AI-powered outreach.",
  heroSubtitle:    "Upload lead sheets, personalize emails instantly, and send directly from your own business mailbox.",
  heroSlogan:      "Built specifically for auto transport brokers.",
  faqContent:      "",
  pricingContent:  "",
  contactContent:  "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function token() { return localStorage.getItem("auth_token") ?? ""; }

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`/api/admin/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? `Error ${res.status}`); }
  return res.json();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, desc, color }: {
  icon: React.ElementType; title: string; desc: string; color: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-5 pb-4 border-b border-slate-100">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-bold text-slate-900 text-base">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function Field({
  label, settingsKey, settings, onChange, type = "text", placeholder, hint, mono,
}: {
  label: string; settingsKey: string; settings: SettingsMap;
  onChange: (key: string, val: string) => void;
  type?: string; placeholder?: string; hint?: string; mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <Input
        type={type}
        value={settings[settingsKey] ?? ""}
        onChange={e => onChange(settingsKey, e.target.value)}
        placeholder={placeholder}
        className={`rounded-xl ${mono ? "font-mono" : ""}`}
      />
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function SecretField({
  label, settingsKey, settings, onChange, placeholder,
}: {
  label: string; settingsKey: string; settings: SettingsMap;
  onChange: (key: string, val: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={settings[settingsKey] ?? ""}
          onChange={e => onChange(settingsKey, e.target.value)}
          placeholder={placeholder}
          className="rounded-xl font-mono pr-10"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label, desc, settingsKey, settings, onChange, danger,
}: {
  label: string; desc?: string; settingsKey: string;
  settings: SettingsMap; onChange: (key: string, val: string) => void;
  danger?: boolean;
}) {
  const on = settings[settingsKey] === "true";
  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
      on && danger ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"
    }`}>
      <div className="flex-1 min-w-0 pr-4">
        <p className={`text-sm font-semibold ${on && danger ? "text-red-900" : "text-slate-800"}`}>{label}</p>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(settingsKey, on ? "false" : "true")}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
          on ? (danger ? "bg-red-500" : "bg-blue-600") : "bg-slate-200"
        }`}
        role="switch"
        aria-checked={on}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function NumberSlider({
  label, desc, settingsKey, settings, onChange, min, max, step = 1, unit,
}: {
  label: string; desc?: string; settingsKey: string; settings: SettingsMap;
  onChange: (key: string, val: string) => void;
  min: number; max: number; step?: number; unit?: string;
}) {
  const val = Number(settings[settingsKey] ?? min);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
          {val}{unit ? ` ${unit}` : ""}
        </span>
      </div>
      {desc && <p className="text-xs text-slate-400">{desc}</p>}
      <input
        type="range"
        min={min} max={max} step={step}
        value={val}
        onChange={e => onChange(settingsKey, e.target.value)}
        className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600"
      />
      <div className="flex justify-between text-xs text-slate-400">
        <span>{min}{unit ? unit : ""}</span>
        <span>{max}{unit ? unit : ""}</span>
      </div>
    </div>
  );
}

function TextareaField({
  label, settingsKey, settings, onChange, placeholder, rows = 4, hint,
}: {
  label: string; settingsKey: string; settings: SettingsMap;
  onChange: (key: string, val: string) => void;
  placeholder?: string; rows?: number; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <textarea
        value={settings[settingsKey] ?? ""}
        onChange={e => onChange(settingsKey, e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
      />
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function SaveBar({ saving, onSave, label = "Save Settings" }: {
  saving: boolean; onSave: () => void; label?: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-2 border-t border-slate-100 mt-4">
      <Button onClick={onSave} disabled={saving} className="rounded-xl gap-2 px-6">
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Save className="h-4 w-4" />{label}</>}
      </Button>
      <p className="text-xs text-slate-400">Changes apply immediately across the platform.</p>
    </div>
  );
}

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${color}`}>
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="text-xs font-semibold opacity-70 mt-1">{label}</p>
      {sub && <p className="text-xs opacity-50 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── SUB-TABS DEFINITION ─────────────────────────────────────────────────────

const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: "general",   label: "General",   icon: Globe },
  { id: "branding",  label: "Branding",  icon: Palette },
  { id: "smtp",      label: "SMTP",      icon: Server },
  { id: "ai",        label: "AI",        icon: Bot },
  { id: "users",     label: "Users",     icon: Users },
  { id: "billing",   label: "Billing",   icon: CreditCard },
  { id: "security",  label: "Security",  icon: Shield },
  { id: "cms",       label: "CMS",       icon: FileText },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SubTab>("general");
  const [settings, setSettings] = useState<SettingsMap>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const set = (key: string, val: string) => setSettings(s => ({ ...s, [key]: val }));

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("settings");
      setSettings({ ...DEFAULTS, ...data });
    } catch {
      toast({ variant: "destructive", title: "Could not load settings" });
    } finally { setLoading(false); }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const [stats, queue] = await Promise.all([
        apiFetch("stats"),
        apiFetch("queue-status").catch(() => null),
      ]);
      setAnalytics({
        totalEmailsSent:   stats.totalDraftsCreated ?? 0,
        totalFailed:       stats.failedSends ?? 0,
        successRate:       (() => {
          const s = stats.totalDraftsCreated ?? 0;
          const f = stats.failedSends ?? 0;
          return s + f > 0 ? `${Math.round(s / (s + f) * 100)}%` : "—";
        })(),
        activeUsers:       stats.activeUsers ?? 0,
        totalUsers:        stats.totalUsers ?? 0,
        smtpMailboxes:     stats.smtpMailboxes ?? 0,
        emailsToday:       stats.emailsSentToday ?? 0,
        emailsThisMonth:   stats.emailsSentMonth ?? 0,
        aiUsageToday:      0,
      });
      if (queue) setQueueStatus(queue);
    } catch { /* silent */ }
    finally { setAnalyticsLoading(false); }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => { if (activeTab === "analytics") loadAnalytics(); }, [activeTab, loadAnalytics]);

  async function saveSection(keys: string[]) {
    setSaving(true);
    try {
      const patch: SettingsMap = {};
      keys.forEach(k => { patch[k] = settings[k] ?? DEFAULTS[k] ?? ""; });
      await apiFetch("settings", { method: "PUT", body: JSON.stringify(patch) });
      toast({ title: "Settings saved", description: `${keys.length} setting${keys.length !== 1 ? "s" : ""} updated.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Save failed", description: err.message });
    } finally { setSaving(false); }
  }

  const activeTabObj = SUB_TABS.find(t => t.id === activeTab)!;

  if (loading) {
    return (
      <div className="space-y-3">
        {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile tab selector */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setShowMobileMenu(m => !m)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700"
        >
          <div className="flex items-center gap-2">
            <activeTabObj.icon className="h-4 w-4 text-blue-600" />
            {activeTabObj.label}
          </div>
          {showMobileMenu ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
        {showMobileMenu && (
          <div className="mt-1 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-lg">
            {SUB_TABS.map(t => (
              <button key={t.id} type="button"
                onClick={() => { setActiveTab(t.id); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm border-b border-slate-50 last:border-0 transition-colors ${
                  activeTab === t.id ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <t.icon className="h-4 w-4 flex-shrink-0" />
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-5">
        {/* Desktop sidebar nav */}
        <nav className="hidden lg:flex flex-col gap-0.5 flex-shrink-0 w-44">
          {SUB_TABS.map(t => (
            <button key={t.id} type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                activeTab === t.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <t.icon className="h-4 w-4 flex-shrink-0" />
              {t.label}
            </button>
          ))}
        </nav>

        {/* Panel */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden">

          {/* ── 1. GENERAL ────────────────────────────────────────────────── */}
          {activeTab === "general" && (
            <div className="space-y-5">
              <SectionHeader icon={Globe} title="General Platform Settings" color="bg-blue-50 text-blue-600"
                desc="Platform identity, contact info, and operational status." />

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Platform Name" settingsKey="platformName" settings={settings} onChange={set}
                    placeholder="BrokerMail AI" />
                </div>
                <Field label="Support Email" settingsKey="supportEmail" settings={settings} onChange={set}
                  type="email" placeholder="support@brokermail.ai" />
                <Field label="Contact Phone" settingsKey="contactPhone" settings={settings} onChange={set}
                  type="tel" placeholder="+1 (555) 000-0000" />
                <div className="sm:col-span-2">
                  <Field label="Company Address" settingsKey="companyAddress" settings={settings} onChange={set}
                    placeholder="123 Main St, Orlando, FL 32801" />
                </div>
                <div className="sm:col-span-2">
                  <Field label="Footer Text" settingsKey="footerText" settings={settings} onChange={set}
                    placeholder="Built for the auto transport industry." />
                </div>
              </div>

              <Toggle label="Maintenance Mode" danger
                desc="When ON, non-admin users see a maintenance page and cannot use the platform."
                settingsKey="maintenanceMode" settings={settings} onChange={set} />

              {settings.maintenanceMode === "true" && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                  <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-800 font-medium">
                    Maintenance mode is <strong>ON</strong>. All non-admin users are locked out.
                  </p>
                </div>
              )}

              <SaveBar saving={saving} onSave={() => saveSection([
                "platformName", "supportEmail", "contactPhone",
                "companyAddress", "footerText", "maintenanceMode",
              ])} label="Save General Settings" />
            </div>
          )}

          {/* ── 2. BRANDING ───────────────────────────────────────────────── */}
          {activeTab === "branding" && (
            <div className="space-y-5">
              <SectionHeader icon={Palette} title="Branding Defaults" color="bg-purple-50 text-purple-600"
                desc="Default visual settings applied to emails and the platform UI." />

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Default Accent Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={settings.defaultAccentColor ?? "#1d4ed8"}
                      onChange={e => set("defaultAccentColor", e.target.value)}
                      className="h-11 w-16 rounded-xl border border-slate-200 cursor-pointer p-1"
                    />
                    <Input
                      value={settings.defaultAccentColor ?? "#1d4ed8"}
                      onChange={e => set("defaultAccentColor", e.target.value)}
                      placeholder="#1d4ed8"
                      className="rounded-xl font-mono flex-1"
                    />
                  </div>
                  <div className="h-8 rounded-xl border border-slate-100" style={{ backgroundColor: settings.defaultAccentColor || "#1d4ed8" }} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Default Email Layout Style</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "clean",   label: "Clean",   color: "#1d4ed8" },
                      { value: "modern",  label: "Modern",  color: "#4f46e5" },
                      { value: "minimal", label: "Minimal", color: "#e2e8f0" },
                      { value: "luxury",  label: "Luxury",  color: "#0f172a" },
                    ].map(s => (
                      <button key={s.value} type="button"
                        onClick={() => set("defaultEmailStyle", s.value)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-xs font-semibold text-left transition-colors ${
                          settings.defaultEmailStyle === s.value
                            ? "border-blue-500 bg-blue-50 text-blue-800"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <span className="h-4 w-4 rounded flex-shrink-0" style={{ backgroundColor: s.color }} />
                        {s.label}
                        {settings.defaultEmailStyle === s.value && <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 ml-auto" />}
                      </button>
                    ))}
                  </div>
                </div>

                <Field label="Default Email Slogan" settingsKey="defaultEmailSlogan" settings={settings} onChange={set}
                  placeholder="Your #1 Auto Transport Partner" />

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Default Font</label>
                  <select
                    value={settings.defaultFont ?? "inter"}
                    onChange={e => set("defaultFont", e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white text-slate-700"
                  >
                    {["inter", "roboto", "lato", "open-sans", "georgia", "courier"].map(f => (
                      <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1).replace("-", " ")}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Default Button Style</label>
                  <div className="flex gap-2">
                    {[
                      { value: "rounded",   label: "Rounded" },
                      { value: "pill",      label: "Pill" },
                      { value: "sharp",     label: "Sharp" },
                    ].map(b => (
                      <button key={b.value} type="button"
                        onClick={() => set("defaultButtonStyle", b.value)}
                        className={`flex-1 py-2 text-xs font-semibold rounded-xl border-2 transition-colors ${
                          settings.defaultButtonStyle === b.value
                            ? "border-blue-500 bg-blue-50 text-blue-800"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <SaveBar saving={saving} onSave={() => saveSection([
                "defaultAccentColor", "defaultEmailSlogan", "defaultEmailStyle",
                "defaultButtonStyle", "defaultFont",
              ])} label="Save Branding" />
            </div>
          )}

          {/* ── 3. SMTP SYSTEM CONTROLS ───────────────────────────────────── */}
          {activeTab === "smtp" && (
            <div className="space-y-5">
              <SectionHeader icon={Server} title="SMTP System Controls" color="bg-emerald-50 text-emerald-600"
                desc="Platform-wide defaults for email delivery, rate limiting, and queue behavior." />

              <div className="grid sm:grid-cols-2 gap-5">
                <NumberSlider label="Default Batch Size" desc="Emails queued per send batch."
                  settingsKey="defaultBatchSize" settings={settings} onChange={set}
                  min={1} max={500} unit="emails" />
                <NumberSlider label="Default Delay Between Emails" desc="Pause between each delivery."
                  settingsKey="defaultDelaySeconds" settings={settings} onChange={set}
                  min={1} max={300} unit="sec" />
                <NumberSlider label="Default Hourly Send Limit" desc="Max emails per user per hour."
                  settingsKey="defaultMaxPerHour" settings={settings} onChange={set}
                  min={10} max={2000} step={10} unit="/hr" />
                <NumberSlider label="Max Retry Attempts" desc="Before permanently marking failed."
                  settingsKey="maxRetryAttempts" settings={settings} onChange={set}
                  min={0} max={10} />
              </div>

              <div className="space-y-3">
                <Toggle label="Email Queue System"
                  desc="Enables the background queue processor. Disable to block all sending."
                  settingsKey="queueEnabled" settings={settings} onChange={set} />
                <Toggle label="Auto Retry on Failure"
                  desc="Automatically retry failed emails up to the max retry limit."
                  settingsKey="autoRetryEnabled" settings={settings} onChange={set} />
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { key: "maxEmailsPerDay",   label: "Max Emails / Day (platform)" },
                  { key: "emailLimitPerUser", label: "Max Emails / Day (per user)" },
                  { key: "maxLeadsPerUpload", label: "Max Leads Per Upload" },
                ].map(f => (
                  <Field key={f.key} label={f.label} settingsKey={f.key} settings={settings} onChange={set}
                    type="number" mono />
                ))}
              </div>

              <SaveBar saving={saving} onSave={() => saveSection([
                "defaultBatchSize", "defaultDelaySeconds", "defaultMaxPerHour",
                "maxRetryAttempts", "queueEnabled", "autoRetryEnabled",
                "maxEmailsPerDay", "emailLimitPerUser", "maxLeadsPerUpload",
              ])} label="Save SMTP Controls" />
            </div>
          )}

          {/* ── 4. AI SETTINGS ────────────────────────────────────────────── */}
          {activeTab === "ai" && (
            <div className="space-y-5">
              <SectionHeader icon={Bot} title="AI Settings" color="bg-violet-50 text-violet-600"
                desc="Control AI generation behavior, model selection, and usage limits." />

              <Toggle label="AI Email Generation"
                desc="Enables AI-powered email personalization. Disable to use templates only."
                settingsKey="aiEnabled" settings={settings} onChange={set} />

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">AI Model</label>
                  <select
                    value={settings.aiModel ?? "gpt-4o-mini"}
                    onChange={e => set("aiModel", e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white text-slate-700"
                  >
                    {[
                      { value: "gpt-4o-mini",   label: "GPT-4o Mini (fast, cheap)" },
                      { value: "gpt-4o",         label: "GPT-4o (smart, slower)" },
                      { value: "gpt-4-turbo",    label: "GPT-4 Turbo" },
                      { value: "gpt-3.5-turbo",  label: "GPT-3.5 Turbo (economy)" },
                    ].map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <p className="text-xs text-slate-400">Selected model is used for all AI generation on the platform.</p>
                </div>

                <Field label="Daily AI Usage Limit (calls)" settingsKey="dailyAiLimit"
                  settings={settings} onChange={set} type="number" mono
                  hint="Max AI API calls per day across all users." />
              </div>

              <NumberSlider label="AI Temperature" desc="Controls creativity. Lower = more deterministic."
                settingsKey="aiTemperature" settings={settings} onChange={set}
                min={0} max={1} step={0.1} />

              <div className="flex items-center gap-3 p-4 rounded-xl bg-violet-50 border border-violet-100">
                <Bot className="h-5 w-5 text-violet-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-violet-900">Current Model: {settings.aiModel || "gpt-4o-mini"}</p>
                  <p className="text-xs text-violet-700 mt-0.5">
                    Temperature {settings.aiTemperature || "0.7"} · Daily limit {(settings.dailyAiLimit || "500")} calls
                  </p>
                </div>
              </div>

              <SaveBar saving={saving} onSave={() => saveSection([
                "aiEnabled", "aiModel", "aiTemperature", "dailyAiLimit",
              ])} label="Save AI Settings" />
            </div>
          )}

          {/* ── 5. USER MANAGEMENT CONTROLS ──────────────────────────────── */}
          {activeTab === "users" && (
            <div className="space-y-5">
              <SectionHeader icon={Users} title="User Management Controls" color="bg-teal-50 text-teal-600"
                desc="Registration controls, verification requirements, and default plan limits." />

              <div className="space-y-3">
                <Toggle label="Allow New Registrations"
                  desc="When OFF, no new accounts can be created (invite-only mode)."
                  settingsKey="allowRegistrations" settings={settings} onChange={set} />
                <Toggle label="Require Email Verification"
                  desc="New users must verify their email before accessing the platform."
                  settingsKey="requireEmailVerification" settings={settings} onChange={set} />
                <Toggle label="Auto-Suspend on Abuse" danger
                  desc="Automatically suspends accounts that trigger spam/rate-limit violations."
                  settingsKey="autoSuspendOnAbuse" settings={settings} onChange={set} />
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Free Plan Defaults</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Monthly Email Limit (Free)" settingsKey="freeMonthlyEmailLimit"
                    settings={settings} onChange={set} type="number" mono
                    hint="Set to -1 for unlimited." />
                  <Field label="Batch Send Limit (Free)" settingsKey="freeBatchLimit"
                    settings={settings} onChange={set} type="number" mono
                    hint="Max emails per batch for free users." />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-teal-50 border border-teal-100">
                <p className="text-xs font-semibold text-teal-800 mb-2">Current Status</p>
                <div className="flex flex-wrap gap-3">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    settings.allowRegistrations === "true" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  }`}>
                    {settings.allowRegistrations === "true" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    Registrations {settings.allowRegistrations === "true" ? "Open" : "Closed"}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    settings.requireEmailVerification === "true" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    <Mail className="h-3.5 w-3.5" />
                    Email Verification {settings.requireEmailVerification === "true" ? "Required" : "Not Required"}
                  </span>
                </div>
              </div>

              <SaveBar saving={saving} onSave={() => saveSection([
                "allowRegistrations", "requireEmailVerification", "autoSuspendOnAbuse",
                "freeMonthlyEmailLimit", "freeBatchLimit",
              ])} label="Save User Settings" />
            </div>
          )}

          {/* ── 6. BILLING SETTINGS ──────────────────────────────────────── */}
          {activeTab === "billing" && (
            <div className="space-y-5">
              <SectionHeader icon={CreditCard} title="Billing Settings" color="bg-amber-50 text-amber-600"
                desc="Stripe integration, credit system, and pricing configuration." />

              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Stripe Integration — Coming Soon</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Add your Stripe keys below to enable paid plan subscriptions. Currently, plans are managed manually.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stripe Configuration</p>
                <Field label="Stripe Publishable Key (pk_live_...)" settingsKey="stripePublishableKey"
                  settings={settings} onChange={set} placeholder="pk_live_..." mono />
                <SecretField label="Stripe Webhook Secret (whsec_...)" settingsKey="stripeWebhookSecret"
                  settings={settings} onChange={set} placeholder="whsec_..." />
              </div>

              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Credit System</p>
                <Toggle label="Enable Credit System"
                  desc="Users can purchase credits to unlock AI generation and extra sends."
                  settingsKey="creditSystemEnabled" settings={settings} onChange={set} />
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Credits per Dollar" settingsKey="creditsPerDollar"
                    settings={settings} onChange={set} type="number" mono
                    hint="How many credits $1 USD buys." />
                  <Field label="Free Trial Days" settingsKey="freeTrialDays"
                    settings={settings} onChange={set} type="number" mono
                    hint="Days of Pro access after signup. 0 = no trial." />
                </div>
              </div>

              <SaveBar saving={saving} onSave={() => saveSection([
                "stripePublishableKey", "stripeWebhookSecret",
                "creditsPerDollar", "creditSystemEnabled", "freeTrialDays",
              ])} label="Save Billing Settings" />
            </div>
          )}

          {/* ── 7. SECURITY SETTINGS ─────────────────────────────────────── */}
          {activeTab === "security" && (
            <div className="space-y-5">
              <SectionHeader icon={Shield} title="Security Settings" color="bg-red-50 text-red-600"
                desc="Session management, rate limiting, and authentication controls." />

              <div className="grid sm:grid-cols-2 gap-5">
                <NumberSlider label="Session Timeout" desc="Users are auto-logged out after this many hours of inactivity."
                  settingsKey="sessionTimeoutHours" settings={settings} onChange={set}
                  min={1} max={168} unit="hrs" />
                <NumberSlider label="Login Rate Limit" desc="Max login attempts per IP per 15 minutes."
                  settingsKey="loginRateLimit" settings={settings} onChange={set}
                  min={3} max={50} />
                <NumberSlider label="Failed Login Threshold" desc="Failed attempts before account is locked."
                  settingsKey="failedLoginThreshold" settings={settings} onChange={set}
                  min={3} max={20} />
              </div>

              <div className="space-y-3">
                <Toggle label="Require Admin MFA" danger
                  desc="Admin accounts must use multi-factor authentication to log in."
                  settingsKey="requireAdminMfa" settings={settings} onChange={set} />
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Security Summary</p>
                {[
                  { label: "Session Timeout", value: `${settings.sessionTimeoutHours || 24}h` },
                  { label: "Login Rate Limit", value: `${settings.loginRateLimit || 10} / 15 min` },
                  { label: "Failed Login Lockout", value: `After ${settings.failedLoginThreshold || 5} attempts` },
                  { label: "Admin MFA", value: settings.requireAdminMfa === "true" ? "Required" : "Not Required" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center text-sm py-1 border-b border-slate-100 last:border-0">
                    <span className="text-slate-500 text-xs">{label}</span>
                    <span className="font-semibold text-slate-800 text-xs">{value}</span>
                  </div>
                ))}
              </div>

              <SaveBar saving={saving} onSave={() => saveSection([
                "sessionTimeoutHours", "loginRateLimit", "failedLoginThreshold", "requireAdminMfa",
              ])} label="Save Security Settings" />
            </div>
          )}

          {/* ── 8. CMS / WEBSITE SETTINGS ────────────────────────────────── */}
          {activeTab === "cms" && (
            <div className="space-y-5">
              <SectionHeader icon={FileText} title="CMS / Website Settings" color="bg-indigo-50 text-indigo-600"
                desc="Edit homepage copy, FAQ content, and public-facing page text." />

              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Homepage Hero</p>
                <Field label="Hero Title" settingsKey="heroTitle" settings={settings} onChange={set}
                  placeholder="Close more transport deals with AI-powered outreach." />
                <Field label="Hero Subtitle" settingsKey="heroSubtitle" settings={settings} onChange={set}
                  placeholder="Upload lead sheets, personalize emails instantly…" />
                <Field label="Hero Slogan / Tagline" settingsKey="heroSlogan" settings={settings} onChange={set}
                  placeholder="Built specifically for auto transport brokers." />
              </div>

              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">FAQ Content</p>
                <TextareaField label="FAQ Page Content (Markdown / plain text)" settingsKey="faqContent"
                  settings={settings} onChange={set} rows={8}
                  placeholder={"Q: What is BrokerMail AI?\nA: BrokerMail AI is an email automation platform...\n\nQ: How does the batch system work?\nA: ..."}
                  hint="Leave blank to use the hardcoded FAQ component." />
              </div>

              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pricing Page Notes</p>
                <TextareaField label="Pricing Page Disclaimer / Extra Content" settingsKey="pricingContent"
                  settings={settings} onChange={set} rows={4}
                  placeholder="All prices are in USD. Cancel anytime. No contracts."
                  hint="Shown at the bottom of the pricing page." />
              </div>

              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact Page</p>
                <TextareaField label="Contact Page Custom Message" settingsKey="contactContent"
                  settings={settings} onChange={set} rows={4}
                  placeholder="Have questions? Reach us at support@brokermail.ai or call (555) 000-0000."
                  hint="Replaces or supplements the default contact page intro." />
              </div>

              <SaveBar saving={saving} onSave={() => saveSection([
                "heroTitle", "heroSubtitle", "heroSlogan",
                "faqContent", "pricingContent", "contactContent",
              ])} label="Save CMS Content" />
            </div>
          )}

          {/* ── 9. ANALYTICS DASHBOARD ────────────────────────────────────── */}
          {activeTab === "analytics" && (
            <div className="space-y-5">
              <SectionHeader icon={BarChart3} title="Analytics Dashboard" color="bg-blue-50 text-blue-600"
                desc="Real-time platform metrics, email delivery stats, and queue health." />

              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">Live data from the database</p>
                <Button variant="outline" size="sm" onClick={loadAnalytics}
                  disabled={analyticsLoading} className="gap-1.5 rounded-xl h-8">
                  <RefreshCw className={`h-3.5 w-3.5 ${analyticsLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>

              {analyticsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
                </div>
              ) : analytics ? (
                <>
                  {/* Email stats */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Email Delivery</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <StatCard label="Total Sent (All Time)" value={analytics.totalEmailsSent.toLocaleString()}
                        color="bg-emerald-50 border-emerald-100 text-emerald-800" />
                      <StatCard label="Total Failed" value={analytics.totalFailed.toLocaleString()}
                        color={analytics.totalFailed > 0 ? "bg-red-50 border-red-100 text-red-800" : "bg-slate-50 border-slate-100 text-slate-600"} />
                      <StatCard label="SMTP Success Rate" value={analytics.successRate}
                        color="bg-blue-50 border-blue-100 text-blue-800" />
                      <StatCard label="Emails Today" value={analytics.emailsToday.toLocaleString()}
                        sub={`${analytics.emailsThisMonth.toLocaleString()} this month`}
                        color="bg-indigo-50 border-indigo-100 text-indigo-800" />
                    </div>
                  </div>

                  {/* User stats */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Users & Connections</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <StatCard label="Active Users" value={analytics.activeUsers.toLocaleString()}
                        sub={`of ${analytics.totalUsers} total`}
                        color="bg-teal-50 border-teal-100 text-teal-800" />
                      <StatCard label="SMTP Mailboxes" value={analytics.smtpMailboxes.toLocaleString()}
                        color="bg-violet-50 border-violet-100 text-violet-800" />
                      <StatCard label="AI Calls Today" value={analytics.aiUsageToday.toLocaleString()}
                        sub={`Limit: ${settings.dailyAiLimit || "500"}`}
                        color="bg-amber-50 border-amber-100 text-amber-800" />
                    </div>
                  </div>

                  {/* Queue status */}
                  {queueStatus && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Queue Status</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard label="Pending" value={queueStatus.pending.toLocaleString()}
                          color="bg-blue-50 border-blue-100 text-blue-800" />
                        <StatCard label="Currently Sending" value={queueStatus.sending.toLocaleString()}
                          color={queueStatus.sending > 0 ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-slate-50 border-slate-100 text-slate-600"} />
                        <StatCard label="Delivered (Queue)" value={queueStatus.success.toLocaleString()}
                          color="bg-teal-50 border-teal-100 text-teal-800" />
                        <StatCard label="Failed (Queue)" value={queueStatus.failed.toLocaleString()}
                          color={queueStatus.failed > 0 ? "bg-red-50 border-red-100 text-red-800" : "bg-slate-50 border-slate-100 text-slate-600"} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <Database className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-xs text-slate-600">
                            {(queueStatus.pending + queueStatus.sending + queueStatus.success + queueStatus.failed).toLocaleString()} total queue items
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-xs text-slate-600">{queueStatus.last24h.toLocaleString()} processed in last 24h</span>
                        </div>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            settings.queueEnabled === "true"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${settings.queueEnabled === "true" ? "bg-emerald-500" : "bg-red-500"}`} />
                            Queue {settings.queueEnabled === "true" ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Summary row */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Platform Health</p>
                    <div className="space-y-2">
                      {[
                        {
                          label: "Delivery Success Rate",
                          value: analytics.successRate,
                          ok: analytics.successRate !== "—" && parseInt(analytics.successRate) >= 90,
                        },
                        {
                          label: "Queue System",
                          value: settings.queueEnabled === "true" ? "Operational" : "Disabled",
                          ok: settings.queueEnabled === "true",
                        },
                        {
                          label: "AI Generation",
                          value: settings.aiEnabled === "true" ? `Active (${settings.aiModel || "gpt-4o-mini"})` : "Disabled",
                          ok: settings.aiEnabled === "true",
                        },
                        {
                          label: "Maintenance Mode",
                          value: settings.maintenanceMode === "true" ? "ON — Users Locked Out" : "OFF — Platform Active",
                          ok: settings.maintenanceMode !== "true",
                        },
                        {
                          label: "Registrations",
                          value: settings.allowRegistrations === "true" ? "Open" : "Closed",
                          ok: true,
                        },
                      ].map(({ label, value, ok }) => (
                        <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                          <span className="text-xs text-slate-500">{label}</span>
                          <span className={`flex items-center gap-1.5 text-xs font-semibold ${ok ? "text-emerald-700" : "text-red-600"}`}>
                            {ok
                              ? <CheckCircle2 className="h-3.5 w-3.5" />
                              : <AlertTriangle className="h-3.5 w-3.5" />}
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-16 text-center">
                  <BarChart3 className="h-10 w-10 mx-auto text-slate-200 mb-3" />
                  <p className="text-slate-400 text-sm">Could not load analytics. Try refreshing.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
