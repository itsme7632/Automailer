import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, CheckCircle2, Mail, AlertCircle,
  Building2, Globe, Phone, Hash, Palette, PenLine, User,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface BrandingData {
  agentName: string; companyName: string; companyTagline: string; companyWebsite: string;
  companyPhone: string; usdot: string; mcNumber: string; accentColor: string; useSignature: boolean;
}

/** Variables users put inside template bodies */
const TEMPLATE_VARIABLES = [
  { var: "{name}",       desc: "Recipient's name" },
  { var: "{vehicle}",    desc: "Vehicle (year/make/model)" },
  { var: "{pickup}",     desc: "Pickup location" },
  { var: "{delivery}",   desc: "Delivery location" },
  { var: "{price}",      desc: "Transport price (auto-formats)" },
  { var: "{route}",      desc: "Route summary" },
  { var: "{quote_id}",   desc: "Quote / order ID from CSV" },
  { var: "{agent_name}", desc: "Sending agent's name (CSV column)" },
];

export default function Settings() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  // Gmail
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);

  // Branding
  const [branding, setBranding] = useState<BrandingData>({
    agentName: "", companyName: "", companyTagline: "", companyWebsite: "", companyPhone: "",
    usdot: "", mcNumber: "", accentColor: "", useSignature: false,
  });
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const gmailConnectedParam = params.get("gmail") === "connected";
  const oauthError = params.get("error");

  // Load branding on mount
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch("/api/users/branding", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setBranding(d))
      .catch(() => {});
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
                  <User className="h-3.5 w-3.5 text-muted-foreground" /> Agent Name
                </label>
                <Input
                  value={branding.agentName}
                  onChange={e => setBranding(b => ({ ...b, agentName: e.target.value }))}
                  placeholder="e.g. Sarah Mitchell"
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">Used in signature when no agent_name column in CSV</p>
              </div>
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
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Company Tagline / Slogan
                </label>
                <Input
                  value={branding.companyTagline}
                  onChange={e => setBranding(b => ({ ...b, companyTagline: e.target.value }))}
                  placeholder="e.g. Nationwide Vehicle Shipping"
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
                        ? "On — agent name, company, tagline, phone, website & credentials appended automatically"
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
                  Your company name appears in the email header automatically. When "Automatic Signature" is enabled, your agent name, company tagline, phone, website, USDOT, and MC# are appended to every email.
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
