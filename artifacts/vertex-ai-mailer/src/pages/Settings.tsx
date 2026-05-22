import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const { user, logout } = useAuth();

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
          <div className="p-6 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Gmail</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {user?.gmailConnected ? `Connected as ${user.gmailEmail}` : "Not connected"}
                </p>
              </div>
              <Button 
                variant={user?.gmailConnected ? "outline" : "default"}
                onClick={() => window.location.href = "/api/gmail/connect"}
              >
                {user?.gmailConnected ? "Reconnect" : "Connect Gmail"}
              </Button>
            </div>
          </div>
        </section>

        <section className="pt-6 border-t border-border">
          <Button variant="destructive" onClick={logout}>Sign Out</Button>
        </section>
      </div>
    </div>
  );
}