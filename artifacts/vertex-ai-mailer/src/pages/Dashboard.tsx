import { useState } from "react";
import { useGetDashboardStats, useGetRecentCampaigns, useGetDashboardActivity, useGetGmailStatus } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  BarChart3, Mail, CheckCircle2, AlertCircle, Clock,
  Plus, ArrowRight, Zap, Users, TrendingUp,
} from "lucide-react";
import { Link } from "wouter";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.3 } }),
};

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  color = "blue",
}: {
  title: string;
  value?: number | string;
  icon: React.ElementType;
  loading: boolean;
  color?: "blue" | "violet" | "emerald" | "amber";
}) {
  const colorMap = {
    blue:    { bg: "bg-blue-50",   icon: "text-blue-600",   ring: "ring-blue-100" },
    violet:  { bg: "bg-violet-50", icon: "text-violet-600", ring: "ring-violet-100" },
    emerald: { bg: "bg-emerald-50",icon: "text-emerald-600",ring: "ring-emerald-100" },
    amber:   { bg: "bg-amber-50",  icon: "text-amber-600",  ring: "ring-amber-100" },
  };
  const c = colorMap[color];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-5 shadow-sm hover:shadow-md transition-shadow">
      <div className={`h-12 w-12 rounded-xl ${c.bg} ring-1 ${c.ring} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`h-5 w-5 ${c.icon}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-bold text-slate-900 leading-none">{value ?? 0}</p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: campaigns, isLoading: campaignsLoading } = useGetRecentCampaigns({ limit: 5 });
  const { data: activity, isLoading: activityLoading } = useGetDashboardActivity({ limit: 10 });
  const { data: gmailStatus, isLoading: gmailLoading } = useGetGmailStatus();
  const [connectingGmail, setConnectingGmail] = useState(false);

  async function handleConnectGmail() {
    setConnectingGmail(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/gmail/connect", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { authUrl } = await res.json();
      window.location.href = authUrl;
    } catch {
      setConnectingGmail(false);
    }
  }

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Good morning, {firstName} 👋
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Here's what's happening with your outreach today.</p>
        </div>
        <Button asChild className="gap-2 rounded-xl shadow-sm">
          <Link href="/campaigns">
            <Plus className="h-4 w-4" />
            New Campaign
          </Link>
        </Button>
      </div>

      {/* Gmail warning */}
      {!gmailLoading && !gmailStatus?.connected && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl"
        >
          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-900 text-sm">Connect Gmail to start syncing drafts</p>
            <p className="text-amber-700 text-xs mt-0.5">Your AI-generated emails will be saved as Gmail drafts — never auto-sent.</p>
          </div>
          <Button
            size="sm"
            onClick={handleConnectGmail}
            disabled={connectingGmail}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex-shrink-0"
          >
            {connectingGmail ? "Connecting…" : "Connect Gmail"}
          </Button>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { title: "Active Campaigns", value: stats?.activeCampaigns, icon: BarChart3, color: "blue" as const },
          { title: "Total Leads",      value: stats?.totalLeads,      icon: Users,    color: "violet" as const },
          { title: "Drafts Created",   value: stats?.totalDraftsCreated, icon: Mail,  color: "emerald" as const },
          { title: "Success Rate",     value: stats?.draftSuccessRate ? `${stats.draftSuccessRate}%` : "0%", icon: TrendingUp, color: "amber" as const },
        ].map((card, i) => (
          <motion.div key={card.title} custom={i} initial="hidden" animate="show" variants={fadeUp}>
            <StatCard {...card} loading={statsLoading} />
          </motion.div>
        ))}
      </div>

      {/* Two-column content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Campaigns */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Recent Campaigns</h2>
              <p className="text-xs text-slate-500 mt-0.5">Your latest outreach efforts</p>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-slate-500 hover:text-slate-900 text-xs">
              <Link href="/campaigns">View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </div>
          <div className="divide-y divide-slate-50">
            {campaignsLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
              </div>
            ) : campaigns?.length ? (
              campaigns.map((campaign) => {
                const pct = campaign.totalLeads > 0
                  ? Math.round((campaign.draftedCount / campaign.totalLeads) * 100)
                  : 0;
                return (
                  <div key={campaign.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/70 transition-colors">
                    <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/campaigns/${campaign.id}`} className="font-medium text-slate-900 text-sm hover:text-blue-600 transition-colors truncate block">
                        {campaign.name}
                      </Link>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[120px]">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{campaign.draftedCount}/{campaign.totalLeads} drafted</span>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      campaign.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                      campaign.status === "pending"   ? "bg-amber-50 text-amber-700" :
                      campaign.status === "failed"    ? "bg-red-50 text-red-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {campaign.status}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Zap className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No campaigns yet</p>
                <Button asChild variant="ghost" size="sm" className="mt-3 text-blue-600 hover:text-blue-700">
                  <Link href="/campaigns">Create your first campaign →</Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Activity</h2>
            <p className="text-xs text-slate-500 mt-0.5">Recent system events</p>
          </div>
          <div className="p-4 space-y-1">
            {activityLoading ? (
              <div className="space-y-3 p-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : activity?.length ? (
              activity.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-700 leading-relaxed">{item.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(item.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <CheckCircle2 className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
