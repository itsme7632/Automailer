import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Mail, Cpu, Database, Key, AlertCircle, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface DiagnosticsResult {
  database?: { ok: boolean; error?: string };
  ai?: { ok: boolean; provider: string; model: string; error?: string };
  gmail?: { configured: boolean; redirectUri: string };
  userGmail?: {
    connected: boolean;
    email?: string | null;
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    tokenExpiry?: string | null;
    tokenExpired?: boolean | null;
  };
  env?: Record<string, boolean>;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${ok ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"}`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {label}
    </div>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);

  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const gmailConnectedParam = params.get("gmail") === "connected";
  const oauthError = params.get("error");

  async function handleConnectGmail() {
    setConnectingGmail(true);
    setGmailError(null);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/gmail/connect", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const { authUrl } = await res.json();
      window.location.href = authUrl;
    } catch (err: unknown) {
      setGmailError(err instanceof Error ? err.message : "Failed to start Gmail connect");
      setConnectingGmail(false);
    }
  }

  async function handleDisconnectGmail() {
    setDisconnecting(true);
    setGmailError(null);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/gmail/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      await queryClient.invalidateQueries();
      window.location.reload();
    } catch (err: unknown) {
      setGmailError(err instanceof Error ? err.message : "Failed to disconnect Gmail");
    } finally {
      setDisconnecting(false);
    }
  }

  async function loadDiagnostics() {
    setIsLoadingDiagnostics(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/diagnostics/full", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDiagnostics(data);
    } catch {
      setDiagnostics(null);
    } finally {
      setIsLoadingDiagnostics(false);
    }
  }

  useEffect(() => {
    loadDiagnostics();
  }, []);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your account and integrations.</p>
      </div>

      <div className="space-y-8">

        {/* Profile */}
        <section className="space-y-4">
          <h3 className="text-lg font-medium">Profile</h3>
          <div className="p-6 rounded-lg border border-border bg-card space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <p className="text-foreground">{user?.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-foreground">{user?.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Role</label>
              <p className="text-foreground capitalize">{user?.role}</p>
            </div>
          </div>
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
                    {user?.gmailConnected
                      ? `Connected as ${user.gmailEmail}`
                      : "Not connected — required for creating drafts"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {user?.gmailConnected && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnectGmail}
                    disabled={disconnecting}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disconnect"}
                  </Button>
                )}
                <Button
                  variant={user?.gmailConnected ? "outline" : "default"}
                  onClick={handleConnectGmail}
                  disabled={connectingGmail}
                >
                  {connectingGmail ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connecting…</>
                  ) : user?.gmailConnected ? (
                    "Reconnect"
                  ) : (
                    "Connect Gmail"
                  )}
                </Button>
              </div>
            </div>

            {gmailConnectedParam && (
              <div className="flex items-center gap-2 mt-2 p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-600 text-sm">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                Gmail connected successfully.
              </div>
            )}

            {(gmailError || oauthError) && (
              <p className="mt-2 text-sm text-destructive">
                {gmailError ??
                  (oauthError === "oauth_denied"
                    ? "You denied access. Please try again."
                    : "Gmail connection failed. Please try again.")}
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
              {isLoadingDiagnostics
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />}
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
                {/* Database */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span>Database</span>
                  </div>
                  <StatusBadge ok={diagnostics.database?.ok ?? false} label={diagnostics.database?.ok ? "Connected" : diagnostics.database?.error ?? "Error"} />
                </div>

                {/* AI */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    <span>OpenAI ({diagnostics.ai?.model ?? "gpt-4o-mini"})</span>
                  </div>
                  <StatusBadge ok={diagnostics.ai?.ok ?? false} label={diagnostics.ai?.ok ? "Connected" : diagnostics.ai?.error ?? "Not configured"} />
                </div>

                {/* Gmail OAuth */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>Gmail OAuth App</span>
                  </div>
                  <StatusBadge ok={diagnostics.gmail?.configured ?? false} label={diagnostics.gmail?.configured ? "Configured" : "Missing credentials"} />
                </div>

                {/* Gmail token */}
                {diagnostics.userGmail?.connected && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>Your Gmail Token</span>
                    </div>
                    <StatusBadge
                      ok={diagnostics.userGmail.hasRefreshToken && diagnostics.userGmail.tokenExpired !== true}
                      label={
                        !diagnostics.userGmail.hasRefreshToken
                          ? "No refresh token — reconnect Gmail"
                          : diagnostics.userGmail.tokenExpired
                          ? "Expired — reconnect Gmail"
                          : "Valid"
                      }
                    />
                  </div>
                )}

                {/* Env vars */}
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
