import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, CheckCircle2, XCircle, Server, Mail, User, Lock,
  Wifi, Trash2, Save, FlaskConical, ChevronDown, ChevronUp,
} from "lucide-react";

type Secure = "ssl" | "tls" | "none";

interface MailboxForm {
  smtpHost: string; smtpPort: string; smtpUser: string; smtpPass: string; smtpSecure: Secure;
  imapHost: string; imapPort: string; imapUser: string; imapPass: string;
  fromName: string; replyTo: string;
}

const EMPTY_FORM: MailboxForm = {
  smtpHost: "", smtpPort: "587", smtpUser: "", smtpPass: "", smtpSecure: "tls",
  imapHost: "", imapPort: "993", imapUser: "", imapPass: "",
  fromName: "", replyTo: "",
};

const PRESETS = [
  { name: "Hostinger",       smtp: "smtp.hostinger.com", smtpPort: "465", secure: "ssl" as Secure, imap: "imap.hostinger.com", imapPort: "993" },
  { name: "cPanel / WHM",    smtp: "mail.yourdomain.com", smtpPort: "465", secure: "ssl" as Secure, imap: "mail.yourdomain.com", imapPort: "993" },
  { name: "Zoho Mail",       smtp: "smtp.zoho.com", smtpPort: "465", secure: "ssl" as Secure, imap: "imap.zoho.com", imapPort: "993" },
  { name: "Outlook / 365",   smtp: "smtp.office365.com", smtpPort: "587", secure: "tls" as Secure, imap: "outlook.office365.com", imapPort: "993" },
  { name: "Gmail SMTP",      smtp: "smtp.gmail.com", smtpPort: "587", secure: "tls" as Secure, imap: "imap.gmail.com", imapPort: "993" },
  { name: "Namecheap Email", smtp: "mail.privateemail.com", smtpPort: "465", secure: "ssl" as Secure, imap: "mail.privateemail.com", imapPort: "993" },
];

function Field({
  label, icon: Icon, type = "text", value, onChange, placeholder, hint,
}: {
  label: string; icon: React.ElementType; type?: string;
  value: string; onChange: (v: string) => void; placeholder?: string; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium flex items-center gap-1.5 text-slate-700">
        <Icon className="h-3.5 w-3.5 text-slate-400" /> {label}
      </label>
      <Input
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl font-mono text-sm"
        autoComplete="off"
      />
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function TestBadge({ state }: { state: "idle" | "testing" | "ok" | "fail"; msg?: string }) {
  if (state === "testing") return <span className="flex items-center gap-1 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Testing…</span>;
  if (state === "ok")      return <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Connected</span>;
  if (state === "fail")    return <span className="flex items-center gap-1 text-xs text-red-500"><XCircle className="h-3.5 w-3.5" /> Failed</span>;
  return null;
}

export default function MailboxSettings() {
  const { toast } = useToast();
  const [form, setForm]         = useState<MailboxForm>(EMPTY_FORM);
  const [isLoading, setIsLoading]     = useState(true);
  const [isSaving, setIsSaving]       = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [smtpTest, setSmtpTest] = useState<"idle"|"testing"|"ok"|"fail">("idle");
  const [imapTest, setImapTest] = useState<"idle"|"testing"|"ok"|"fail">("idle");
  const [smtpErr, setSmtpErr]   = useState("");
  const [imapErr, setImapErr]   = useState("");
  const [showImap, setShowImap] = useState(false);

  const set = (key: keyof MailboxForm, val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  useEffect(() => {
    loadMailbox();
  }, []);

  async function loadMailbox() {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/mailbox", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setIsConnected(true);
          setShowImap(!!data.imapHost);
          setForm({
            smtpHost: data.smtpHost ?? "",
            smtpPort: String(data.smtpPort ?? "587"),
            smtpUser: data.smtpUser ?? "",
            smtpPass: "",
            smtpSecure: (data.smtpSecure ?? "tls") as Secure,
            imapHost: data.imapHost ?? "",
            imapPort: String(data.imapPort ?? "993"),
            imapUser: data.imapUser ?? "",
            imapPass: "",
            fromName: data.fromName ?? "",
            replyTo:  data.replyTo  ?? "",
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  function applyPreset(p: typeof PRESETS[0]) {
    setForm(f => ({
      ...f,
      smtpHost: p.smtp, smtpPort: p.smtpPort, smtpSecure: p.secure,
      imapHost: p.imap, imapPort: p.imapPort,
    }));
    setShowImap(true);
  }

  async function handleTestSmtp() {
    setSmtpTest("testing"); setSmtpErr("");
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/mailbox/test-smtp", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost: form.smtpHost, smtpPort: Number(form.smtpPort),
          smtpUser: form.smtpUser, smtpPass: form.smtpPass,
          smtpSecure: form.smtpSecure,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test failed");
      setSmtpTest("ok");
    } catch (err: any) {
      setSmtpTest("fail"); setSmtpErr(err.message);
    }
  }

  async function handleTestImap() {
    setImapTest("testing"); setImapErr("");
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/mailbox/test-imap", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          imapHost: form.imapHost, imapPort: Number(form.imapPort),
          imapUser: form.imapUser, imapPass: form.imapPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test failed");
      setImapTest("ok");
    } catch (err: any) {
      setImapTest("fail"); setImapErr(err.message);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/mailbox", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost: form.smtpHost, smtpPort: Number(form.smtpPort),
          smtpUser: form.smtpUser, smtpPass: form.smtpPass || undefined,
          smtpSecure: form.smtpSecure,
          imapHost: form.imapHost || undefined, imapPort: Number(form.imapPort) || 993,
          imapUser: form.imapUser || undefined, imapPass: form.imapPass || undefined,
          fromName: form.fromName || undefined,
          replyTo:  form.replyTo  || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setIsConnected(true);
      toast({ title: "Mailbox saved", description: "Your SMTP settings are now active." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Save failed", description: err.message });
    } finally { setIsSaving(false); }
  }

  async function handleDisconnect() {
    try {
      const token = localStorage.getItem("auth_token");
      await fetch("/api/mailbox", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setIsConnected(false);
      setForm(EMPTY_FORM);
      setSmtpTest("idle"); setImapTest("idle");
      toast({ title: "Mailbox disconnected" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not disconnect mailbox." });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Mailbox Settings</h2>
        <p className="text-slate-500 mt-1 text-sm">
          Connect your business email to send directly from your own domain — no Gmail required.
        </p>
      </div>

      {/* Status badge */}
      <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
        isConnected
          ? "bg-emerald-50 border-emerald-200"
          : "bg-slate-50 border-slate-200"
      }`}>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isConnected ? "bg-emerald-100" : "bg-slate-100"
        }`}>
          <Mail className={`h-4.5 w-4.5 ${isConnected ? "text-emerald-600" : "text-slate-400"} h-5 w-5`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${isConnected ? "text-emerald-900" : "text-slate-700"}`}>
            {isConnected ? `Connected — ${form.smtpUser}` : "No mailbox connected"}
          </p>
          <p className={`text-xs mt-0.5 ${isConnected ? "text-emerald-700" : "text-slate-500"}`}>
            {isConnected
              ? `SMTP ${form.smtpHost}:${form.smtpPort} · ${form.smtpSecure.toUpperCase()}`
              : "Add your SMTP credentials below to enable direct sending."}
          </p>
        </div>
        {isConnected && (
          <Button
            variant="ghost" size="sm"
            onClick={handleDisconnect}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1.5 flex-shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" /> Disconnect
          </Button>
        )}
      </div>

      {/* Provider presets */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quick setup — select your provider</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p)}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors text-slate-600"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* SMTP Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Server className="h-4 w-4 text-blue-500" />
            <h3 className="font-semibold text-slate-800 text-sm">SMTP Settings</h3>
            <span className="ml-auto text-xs text-slate-400">For sending</span>
          </div>
          <div className="p-6 grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="SMTP Host" icon={Server} value={form.smtpHost}
                onChange={v => set("smtpHost", v)} placeholder="smtp.hostinger.com" />
            </div>
            <Field label="Port" icon={Wifi} value={form.smtpPort}
              onChange={v => set("smtpPort", v)} placeholder="587" />
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5 text-slate-700">
                <Wifi className="h-3.5 w-3.5 text-slate-400" /> Encryption
              </label>
              <div className="flex gap-2">
                {(["ssl","tls","none"] as Secure[]).map(s => (
                  <button
                    key={s} type="button"
                    onClick={() => set("smtpSecure", s)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      form.smtpSecure === s
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">SSL=465, TLS=587, None=25</p>
            </div>
            <Field label="Username / Email" icon={User} value={form.smtpUser}
              onChange={v => set("smtpUser", v)} placeholder="sales@yourcompany.com" />
            <Field label="Password" icon={Lock} type="password" value={form.smtpPass}
              onChange={v => set("smtpPass", v)}
              placeholder={isConnected ? "Leave blank to keep current" : "SMTP password"}
              hint={isConnected ? "Only fill to change the saved password" : undefined} />
          </div>
          <div className="px-6 pb-5 flex items-center gap-3">
            <Button
              type="button" variant="outline" size="sm"
              onClick={handleTestSmtp}
              disabled={smtpTest === "testing" || !form.smtpHost || !form.smtpUser || !form.smtpPass}
              className="rounded-xl gap-1.5"
            >
              {smtpTest === "testing"
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <FlaskConical className="h-3.5 w-3.5" />}
              Test SMTP
            </Button>
            <TestBadge state={smtpTest} />
            {smtpErr && <span className="text-xs text-red-500 truncate">{smtpErr}</span>}
          </div>
        </div>

        {/* IMAP Section (collapsible) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowImap(s => !s)}
            className="w-full px-6 py-4 flex items-center gap-2 hover:bg-slate-50 transition-colors"
          >
            <Mail className="h-4 w-4 text-purple-500" />
            <h3 className="font-semibold text-slate-800 text-sm">IMAP Settings</h3>
            <span className="ml-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Optional</span>
            <span className="ml-auto text-xs text-slate-400">Save to Sent folder</span>
            {showImap
              ? <ChevronUp className="h-4 w-4 text-slate-400 ml-2" />
              : <ChevronDown className="h-4 w-4 text-slate-400 ml-2" />}
          </button>
          {showImap && (
            <>
              <div className="px-6 pb-2 bg-blue-50/50 border-y border-slate-100">
                <p className="text-xs text-slate-500 py-2">
                  When configured, sent emails are automatically copied to your Sent folder via IMAP.
                  Many hosting providers (Hostinger, cPanel) do this automatically without IMAP.
                </p>
              </div>
              <div className="p-6 grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Field label="IMAP Host" icon={Server} value={form.imapHost}
                    onChange={v => set("imapHost", v)} placeholder="imap.hostinger.com" />
                </div>
                <Field label="Port" icon={Wifi} value={form.imapPort}
                  onChange={v => set("imapPort", v)} placeholder="993" />
                <Field label="Username" icon={User} value={form.imapUser}
                  onChange={v => set("imapUser", v)} placeholder="sales@yourcompany.com" />
                <Field label="Password" icon={Lock} type="password" value={form.imapPass}
                  onChange={v => set("imapPass", v)}
                  placeholder={isConnected && form.imapHost ? "Leave blank to keep current" : "IMAP password"} />
              </div>
              <div className="px-6 pb-5 flex items-center gap-3">
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={handleTestImap}
                  disabled={imapTest === "testing" || !form.imapHost || !form.imapUser || !form.imapPass}
                  className="rounded-xl gap-1.5"
                >
                  {imapTest === "testing"
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <FlaskConical className="h-3.5 w-3.5" />}
                  Test IMAP
                </Button>
                <TestBadge state={imapTest} />
                {imapErr && <span className="text-xs text-red-500 truncate">{imapErr}</span>}
              </div>
            </>
          )}
        </div>

        {/* Sender Info */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Sender Info</h3>
          </div>
          <div className="p-6 grid sm:grid-cols-2 gap-4">
            <Field label="From Name" icon={User} value={form.fromName}
              onChange={v => set("fromName", v)} placeholder="NSLA Carship Sales" />
            <Field label="Reply-To Email" icon={Mail} value={form.replyTo}
              onChange={v => set("replyTo", v)} placeholder="sales@yourcompany.com" />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={isSaving} className="rounded-xl gap-2 px-6">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              : <><Save className="h-4 w-4" /> Save Mailbox</>}
          </Button>
          {isConnected && (
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Passwords stored encrypted
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
