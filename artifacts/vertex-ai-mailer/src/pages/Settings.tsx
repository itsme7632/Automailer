import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Mail } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Settings() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);

  // Read ?gmail=connected or ?error= from the URL (set by the OAuth callback)
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      <div className="space-y-8">
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
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Connecting…
                    </>
                  ) : user?.gmailConnected ? (
                    "Reconnect"
                  ) : (
                    "Connect Gmail"
                  )}
                </Button>
              </div>
            </div>

            {/* Success banner after OAuth callback */}
            {gmailConnectedParam && (
              <div className="flex items-center gap-2 mt-2 p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                Gmail connected successfully.
              </div>
            )}

            {/* Error from OAuth callback or fetch */}
            {(gmailError || oauthError) && (
              <p className="mt-2 text-sm text-destructive">
                {gmailError ??
                  (oauthError === "oauth_denied"
                    ? "You denied access. Please try again."
                    : "Gmail connection failed. Please try again.")}
              </p>
            )}

            {/* Hint: redirect URI for Google Console */}
            <p className="text-xs text-muted-foreground/60 mt-1">
              Google Console authorized redirect URI:{" "}
              <code className="font-mono">{window.location.origin}/api/auth/callback</code>
            </p>
          </div>
        </section>

        <section className="pt-6 border-t border-border">
          <Button variant="destructive" onClick={logout}>Sign Out</Button>
        </section>
      </div>
    </div>
  );
}
