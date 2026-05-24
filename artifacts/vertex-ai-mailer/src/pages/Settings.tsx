import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, CheckCircle2, Mail, Cpu, Database, Key, AlertCircle,
  RefreshCw, Building2, Globe, Phone, Hash, Palette, PenLine,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface DiagnosticsResult {
  database?: { ok: boolean; error?: string };
  ai?: { ok: boolean; provider: string; model: string; error?: string };
  gmail?: { configured: boolean; redirectUri: string };
  userGmail?: {
    connected: boolean; email?: string | null; hasAccessToken: boolean;
    hasRefreshToken: boolean; tokenExpiry?: string | null; tokenExpired?: boolean | null;
  };
  env?: Record<string, boolean>;
}

interface BrandingData {
  companyName: string; companyWebsite: string; companyPhone: string;
  usdot: string; mcNumber: string; accentColor: string; useSignature: boolean;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
      ok ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"
    }`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {label}
    </div>
  );
}

/** Variables users put inside template bodies */
const TEMPLATE_VARIABLES = [
  { var: "{name}",     desc: "Recipient's name" },
  { var: "{vehicle}",  desc: "Vehicle (year/make/model)" },
  { var: "{pickup}",   desc: "Pickup location" },
  { var: "{delivery}", desc: "Delivery location" },
  { var: "{price}",    desc: "Transport price (auto-formats)" },
  { var: "{route}",    desc: "Route summary" },
  { var: "{agent_name}", desc: "Sending agent's name (CSV column)" },
];

export default function Settings() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  // Gmail
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);

  // Diagnostics
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false);

  // Branding
  const [branding, setBranding] = useState<BrandingData>({
    companyName: "", companyWebsite: "", companyPhone: "",
    usdot: "", mcNumber: "", accentColor: "", useSignature: false,
  });
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);

  const params      = new URLSearchParams(window.location.search);
  const gmailConnectedParam = params.get("gmail") === "connected";
  const oauthError  = params.get("error");

  // Load branding on mount
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch("/api/users/branding", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setBranding(d))
      .catch(() => {});
    loadDiagnostics();
  }, []);

  async function handleConnectGmail() {
    setConnectingGmail(true); setGmailError(null);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/gmail/connect", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `Request failed (${res.status})`); }
      const { authUrl } = await res.json();
      window.location.href = authUrl;
    } catch (err: unknown) {
      setGmailError(err instanceof Error ? err.message : "Failed to start Gmail connect");
      setConnectingGmail(false);
    }
  }

  async function handleDisconnectGmail() {
    setDisconnecting(true); setGmailError(null);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/gmail/disconnect", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `Request failed (${res.status})`); }
      await queryClient.invalidateQueries();
      window.location.reload();
    } catch (err: unknown) {
      setGmailError(err instanceof Error ? err.message : "Failed to disconnect Gmail");
    } finally { setDisconnecting(false); }
  }

  async function loadDiagnostics() {
    setIsLoadingDiagnostics(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res  = await fetch("/api/diagnostics/full", { headers: { Authorization: `Bearer ${token}` } });
      setDiagnostics(await res.json());
    } catch { setDiagnostics(null); }
    finally { setIsLoadingDiagnostics(false); }
  }

  async function handleSaveBranding(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingBranding(true); setBrandingSaved(false);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/users/branding", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(branding),
      });
      if (!res.ok) throw new Error("Save failed");
      setBrandingSaved(true);
      setTimeout(() => setBrandingSaved(false), 3000);
    } finally { setIsSavingBranding(false); }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your account, branding, and integrations.</p>
      </div>

      <div className="space-y-8">

        {/* Profile */}
        <section className="space-y-4">
          <h3 className="text-lg font-medium">Profile</h3>
          <div className="p-6 rounded-lg border border-border bg-card space-y-4">
            <div><label className="text-sm font-medium text-muted-foreground">Name</label><p className="text-foreground">{user?.name}</p></div>
            <div><label className="text-sm font-medium text-muted-foreground">Email</label><p className="text-foreground">{user?.email}</p></div>
            <div><label className="text-sm font-medium text-muted-foreground">Role</label><p className="text-foreground capitalize">{user?.role}</p></div>
          </div>
        </section>

        {/* Company Branding */}
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Company Branding</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Set your company details once. Use these variables in any email template to personalize automatically.
            </p>
          </div>

          <form onSubmit={handleSaveBranding} className="p-6 rounded-lg border border-border bg-card space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Company Name
                </label>
                <Input
                  value={branding.companyName}
                  onChange={e => setBranding(b => ({ ...b, companyName: e.target.value }))}
                  placeholder="e.g. NSLA Carship"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" /> Website
                </label>
                <Input
                  value={branding.companyWebsite}
                  onChange={e => setBranding(b => ({ ...b, companyWebsite: e.target.value }))}
                  placeholder="e.g. nslacarship.com"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Phone
                </label>
                <Input
                  value={branding.companyPhone}
                  onChange={e => setBranding(b => ({ ...b, companyPhone: e.target.value }))}
                  placeholder="e.g. (555) 123-4567"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" /> USDOT #
                </label>
                <Input
                  value={branding.usdot}
                  onChange={e => setBranding(b => ({ ...b, usdot: e.target.value }))}
                  placeholder="e.g. 1234567"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" /> MC #
                </label>
                <Input
                  value={branding.mcNumber}
                  onChange={e => setBranding(b => ({ ...b, mcNumber: e.target.value }))}
                  placeholder="e.g. 987654"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-muted-foreground" /> Accent Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={branding.accentColor || "#1d4ed8"}
                    onChange={e => setBranding(b => ({ ...b, accentColor: e.target.value }))}
                    className="h-11 w-12 rounded-xl border border-input cursor-pointer bg-transparent p-1"
                  />
                  <Input
                    value={branding.accentColor}
                    onChange={e => setBranding(b => ({ ...b, accentColor: e.target.value }))}
                    placeholder="#1d4ed8"
                    className="rounded-xl font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Automatic Signature Toggle */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <PenLine className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Automatic Signature</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {branding.useSignature
                        ? "On — phone, website, USDOT & MC# are appended to every draft automatically"
                        : "Off — template content is sent exactly as written, no additions"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBranding(b => ({ ...b, useSignature: !b.useSignature }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                    branding.useSignature ? "bg-blue-600" : "bg-slate-200"
                  }`}
                  role="switch"
                  aria-checked={branding.useSignature}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                    branding.useSignature ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>
            </div>

            {/* How branding works */}
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                <p className="text-xs font-semibold text-blue-800 mb-1">Automatic — no variables needed</p>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Your company name appears in the email header automatically. When "Automatic Signature" is enabled above, phone, website, USDOT, and MC# are appended to every draft.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Use these in template bodies</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TEMPLATE_VARIABLES.map(v => (
                    <div key={v.var} className="flex flex-col gap-0.5 p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <code className="text-xs font-mono text-blue-600 font-semibold">{v.var}</code>
                      <span className="text-xs text-slate-500">{v.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={isSavingBranding} className="rounded-xl gap-2">
                {isSavingBranding
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                  : "Save Branding"}
              </Button>
              {brandingSaved && (
                <span className="flex items-center gap-1.5 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Saved
                </span>
              )}
            </div>
          </form>
        </section>

        {/* Gmail */}
        <section className="space-y-4">
          <h3 className="text-lg font-medium">Integrations</h3>
          <div className="p-6 rounded-lg border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h4 className="font-medium">Gmail</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {user?.gmailConnected ? `Connected as ${user.gmailEmail}` : "Not connected — required for creating drafts"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {user?.gmailConnected && (
                  <Button variant="ghost" size="sm" onClick={handleDisconnectGmail} disabled={disconnecting} className="text-muted-foreground hover:text-destructive">
                    {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disconnect"}
                  </Button>
                )}
                <Button variant={user?.gmailConnected ? "outline" : "default"} onClick={handleConnectGmail} disabled={connectingGmail}>
                  {connectingGmail ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connecting…</> : user?.gmailConnected ? "Reconnect" : "Connect Gmail"}
                </Button>
              </div>
            </div>

            {gmailConnectedParam && (
              <div className="flex items-center gap-2 mt-2 p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-600 text-sm">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> Gmail connected successfully.
              </div>
            )}
            {(gmailError || oauthError) && (
              <p className="mt-2 text-sm text-destructive">
                {gmailError ?? (oauthError === "oauth_denied" ? "You denied access. Please try again." : "Gmail connection failed. Please try again.")}
              </p>
            )}
            <p className="text-xs text-muted-foreground/60 mt-1">
              Google Console authorized redirect URI:{" "}
              <code className="font-mono">{window.location.origin}/api/auth/callback</code>
            </p>
          </div>
        </section>

        {/* Diagnostics */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">System Diagnostics</h3>
            <Button variant="ghost" size="sm" onClick={loadDiagnostics} disabled={isLoadingDiagnostics}>
              {isLoadingDiagnostics ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
          <div className="p-6 rounded-lg border border-border bg-card space-y-4">
            {isLoadingDiagnostics && !diagnostics && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Running checks…
              </div>
            )}
            {diagnostics && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm"><Database className="h-4 w-4 text-muted-foreground" /><span>Database</span></div>
                  <StatusBadge ok={diagnostics.database?.ok ?? false} label={diagnostics.database?.ok ? "Connected" : diagnostics.database?.error ?? "Error"} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm"><Cpu className="h-4 w-4 text-muted-foreground" /><span>OpenAI ({diagnostics.ai?.model ?? "gpt-4o-mini"})</span></div>
                  <StatusBadge ok={diagnostics.ai?.ok ?? false} label={diagnostics.ai?.ok ? "Connected" : diagnostics.ai?.error ?? "Not configured"} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span>Gmail OAuth App</span></div>
                  <StatusBadge ok={diagnostics.gmail?.configured ?? false} label={diagnostics.gmail?.configured ? "Configured" : "Missing credentials"} />
                </div>
                {diagnostics.userGmail?.connected && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span>Your Gmail Token</span></div>
                    <StatusBadge
                      ok={diagnostics.userGmail.hasRefreshToken && diagnostics.userGmail.tokenExpired !== true}
                      label={!diagnostics.userGmail.hasRefreshToken ? "No refresh token — reconnect Gmail" : diagnostics.userGmail.tokenExpired ? "Expired — reconnect Gmail" : "Valid"}
                    />
                  </div>
                )}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Environment Variables</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {diagnostics.env && Object.entries(diagnostics.env).map(([key, set]) => (
                      <div key={key} className="flex items-center gap-1.5 text-xs">
                        <Key className={`h-3 w-3 ${set ? "text-green-500" : "text-red-400"}`} />
                        <span className={`font-mono ${set ? "text-foreground" : "text-red-400"}`}>{key}</span>
                        {!set && <span className="text-red-400">missing</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Sign out */}
        <section className="pt-6 border-t border-border">
          <Button variant="destructive" onClick={logout}>Sign Out</Button>
        </section>
      </div>
    </div>
  );
}
