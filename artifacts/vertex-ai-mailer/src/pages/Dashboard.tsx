import { useGetDashboardStats, useGetRecentCampaigns, useGetDashboardActivity, useGetGmailStatus } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Mail, Zap, CheckCircle2, AlertCircle, BarChart3, Clock, Play } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: campaigns, isLoading: campaignsLoading } = useGetRecentCampaigns({ limit: 5 });
  const { data: activity, isLoading: activityLoading } = useGetDashboardActivity({ limit: 10 });
  const { data: gmailStatus, isLoading: gmailLoading } = useGetGmailStatus();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Welcome back, {user?.name}</h2>
          <p className="text-muted-foreground mt-1">Here's what's happening with your outreach today.</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/campaigns">
            <Play className="h-4 w-4" />
            New Campaign
          </Link>
        </Button>
      </div>

      {!gmailLoading && !gmailStatus?.connected && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-yellow-500">Gmail Not Connected</h3>
                <p className="text-sm text-yellow-500/80">Connect your Gmail account to start syncing AI-generated drafts.</p>
              </div>
            </div>
            <Button variant="outline" className="border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-white" onClick={() => window.location.href = "/api/gmail/connect"}>
              Connect Gmail
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Campaigns" value={stats?.activeCampaigns} icon={<BarChart3 />} loading={statsLoading} />
        <StatCard title="Total Leads" value={stats?.totalLeads} icon={<UsersIcon />} loading={statsLoading} />
        <StatCard title="Drafts Created" value={stats?.totalDraftsCreated} icon={<Mail />} loading={statsLoading} />
        <StatCard title="Draft Success Rate" value={stats?.draftSuccessRate ? `${stats.draftSuccessRate}%` : "0%"} icon={<CheckCircle2 />} loading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Campaigns</CardTitle>
            <CardDescription>Your latest outreach efforts.</CardDescription>
          </CardHeader>
          <CardContent>
            {campaignsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                {campaigns?.map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-background/50">
                    <div>
                      <Link href={`/campaigns/${campaign.id}`} className="font-medium hover:underline">{campaign.name}</Link>
                      <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                        <span>{campaign.draftedCount} / {campaign.totalLeads} drafted</span>
                        <span>•</span>
                        <span className="capitalize">{campaign.status}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/campaigns/${campaign.id}`}>View</Link>
                    </Button>
                  </div>
                ))}
                {!campaigns?.length && (
                  <div className="text-center p-8 text-muted-foreground">No campaigns yet.</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Feed</CardTitle>
            <CardDescription>Recent system events.</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                {activity?.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
                {!activity?.length && (
                  <div className="text-center p-8 text-muted-foreground">No recent activity.</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, loading }: { title: string; value?: number | string; icon: React.ReactNode; loading: boolean }) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-16 mt-1" />
          ) : (
            <h4 className="text-2xl font-bold">{value || 0}</h4>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function UsersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users h-5 w-5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  )
}