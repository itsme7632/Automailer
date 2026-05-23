import { useState } from "react";
import { useGetDashboardStats, useGetDashboardActivity, useGetGmailStatus, useGetDrafts } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Mail, CheckCircle2, AlertCircle, Clock,
  ArrowRight, FileText, UploadCloud, TrendingUp, Wifi,
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
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p
            className="text-2xl font-bold text-slate-900 leading-none truncate"
            title={typeof value === "string" ? value : undefined}
          >
            {value ?? 0}
          </p>
        )}
      </div>
    </div>
  );
}

function GmailCard({
  gmailStatus,
  loading,
  onConnect,
  connecting,
}: {
  gmailStatus: { connected: boolean; email?: string | null } | undefined;
  loading: boolean;
  onConnect: () => void;
  connecting: boolean;
}) {
  const connected = gmailStatus?.connected;
  const email = gmailStatus?.email;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div className={`h-12 w-12 rounded-xl ring-1 flex items-center justify-center flex-shrink-0 ${
          connected ? "bg-emerald-50 ring-emerald-100" : "bg-amber-50 ring-amber-100"
        }`}>
          {connected
            ? <Wifi className="h-5 w-5 text-emerald-600" />
            : <Mail className="h-5 w-5 text-amber-600" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-slate-500">Gmail</p>
            {!loading && connected && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex-shrink-0">
                Connected
              </span>
            )}
          </div>
          {loading ? (
            <Skeleton className="h-5 w-40" />
          ) : connected && email ? (
            <p className="text-sm font-semibold text-slate-800 truncate max-w-[200px]" title={email}>
              {email}
            </p>
          ) : (
            <Button
              size="sm"
              onClick={onConnect}
              disabled={connecting}
              className="mt-1 h-7 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
            >
              {connecting ? "Connecting…" : "Connect Gmail"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetDashboardActivity({ limit: 10 });
  const { data: gmailStatus, isLoading: gmailLoading } = useGetGmailStatus();
  const { data: recentDrafts, isLoading: draftsLoading } = useGetDrafts({ page: 1, limit: 5 });
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
            Welcome back, {firstName}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Upload a spreadsheet, pick a template, and create Gmail drafts in seconds.</p>
        </div>
        <Button asChild className="gap-2 rounded-xl shadow-sm">
          <Link href="/leads/import">
            <UploadCloud className="h-4 w-4" />
            Upload & Send
          </Link>
        </Button>
      </div>

      {/* Gmail warning banner */}
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
            <p className="font-semibold text-amber-900 text-sm">Connect Gmail to start creating drafts</p>
            <p className="text-amber-700 text-xs mt-0.5">Your emails will be saved as Gmail drafts — never auto-sent.</p>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: "Drafts Created",  value: stats?.totalDraftsCreated, icon: Mail,       color: "blue" as const },
          { title: "Success Rate",    value: stats?.draftSuccessRate ? `${stats.draftSuccessRate}%` : "—", icon: TrendingUp, color: "emerald" as const },
        ].map((card, i) => (
          <motion.div key={card.title} custom={i} initial="hidden" animate="show" variants={fadeUp}>
            <StatCard {...card} loading={statsLoading} />
          </motion.div>
        ))}
        <motion.div custom={2} initial="hidden" animate="show" variants={fadeUp}>
          <GmailCard
            gmailStatus={gmailStatus}
            loading={gmailLoading}
            onConnect={handleConnectGmail}
            connecting={connectingGmail}
          />
        </motion.div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/leads/import">
          <div className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-6 flex items-center gap-4 cursor-pointer">
            <div className="h-12 w-12 rounded-xl bg-blue-50 ring-1 ring-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
              <UploadCloud className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 text-sm">Upload & Send</p>
              <p className="text-xs text-slate-500 mt-0.5">Upload CSV/XLSX and create Gmail drafts from a template</p>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </div>
        </Link>

        <Link href="/templates">
          <div className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-violet-200 transition-all p-6 flex items-center gap-4 cursor-pointer">
            <div className="h-12 w-12 rounded-xl bg-violet-50 ring-1 ring-violet-100 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
              <FileText className="h-5 w-5 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 text-sm">Email Templates</p>
              <p className="text-xs text-slate-500 mt-0.5">Write templates with dynamic variables like {"{name}"} and {"{vehicle}"}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </div>
        </Link>
      </div>

      {/* Two-column content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Drafts */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Recent Drafts</h2>
              <p className="text-xs text-slate-500 mt-0.5">Latest Gmail drafts created</p>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-slate-500 hover:text-slate-900 text-xs">
              <Link href="/drafts">View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </div>
          <div className="divide-y divide-slate-50">
            {draftsLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
              </div>
            ) : recentDrafts?.data?.length ? (
              recentDrafts.data.map((draft) => (
                <div key={draft.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/70 transition-colors">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    draft.status === "success" ? "bg-emerald-50" : draft.status === "failed" ? "bg-red-50" : "bg-slate-50"
                  }`}>
                    <Mail className={`h-4 w-4 ${
                      draft.status === "success" ? "text-emerald-600" : draft.status === "failed" ? "text-red-500" : "text-slate-400"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">{draft.subject}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(draft.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
                    draft.status === "success" ? "bg-emerald-50 text-emerald-700" :
                    draft.status === "failed"  ? "bg-red-50 text-red-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {draft.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Mail className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No drafts yet</p>
                <Button asChild variant="ghost" size="sm" className="mt-3 text-blue-600 hover:text-blue-700">
                  <Link href="/leads/import">Upload leads to create drafts →</Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Activity</h2>
            <p className="text-xs text-slate-500 mt-0.5">Recent events</p>
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
