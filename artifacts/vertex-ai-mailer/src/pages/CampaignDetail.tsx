import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetCampaign,
  useGetLeads,
  getGetCampaignQueryKey,
  getGetLeadsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, Clock, CheckCircle2, XCircle, Loader2,
  Gauge, RotateCcw, ChevronDown, ChevronUp, Play, Layers,
  Mail, Server, FileText, AlertTriangle, RefreshCw, Inbox,
  Users, Timer, BarChart3, Eye, TrendingUp, ExternalLink,
} from "lucide-react";
import { SendProgressPanel } from "@/components/SendProgressPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CampaignProgress {
  total: number;
  sent: number;
  queued: number;
  failed: number;
  remaining: number;
  sentThisHour: number;
  hourlyLimit: number;
  remainingQuota: number;
  isHourlyLimitReached: boolean;
  cooldownSeconds: number;
  currentJobId: string | null;
  isJobActive: boolean;
  sendMode: string;
  status: string;
}

interface CampaignBatch {
  id: number;
  jobId: string | null;
  sendMode: string;
  batchSize: number;
  sentCount: number;
  failedCount: number;
  mailboxEmail: string | null;
  createdAt: string;
}

const BATCH_SIZES = [10, 25, 50, 100] as const;

function formatSeconds(secs: number): string {
  if (secs <= 0) return "0s";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function StatCard({
  label, value, sub, color, icon,
}: {
  label: string; value: number | string; sub?: string; color: string; icon?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-1 ${color}`}>
      {icon && <div className="mb-1 opacity-70">{icon}</div>}
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="text-xs font-semibold opacity-80">{label}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Countdown timer hook ─────────────────────────────────────────────────────
function useCooldownTimer(initialSeconds: number) {
  const [secs, setSecs] = useState(initialSeconds);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    setSecs(initialSeconds);
    if (initialSeconds <= 0) return;
    ref.current = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [initialSeconds]);
  return secs;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CampaignDetail() {
  const [, params]    = useRoute("/campaigns/:id");
  const campaignId    = Number(params?.id);
  const { toast }     = useToast();
  const queryClient   = useQueryClient();

  const [leadsPage, setLeadsPage]         = useState(1);
  const [batchSize, setBatchSize]         = useState<number>(25);
  const [isSending, setIsSending]         = useState(false);
  const [progress, setProgress]           = useState<CampaignProgress | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [batches, setBatches]             = useState<CampaignBatch[]>([]);
  const [showBatches, setShowBatches]     = useState(false);
  const [showLeads, setShowLeads]         = useState(true);
  const [activeJobId, setActiveJobId]     = useState<string | null>(null);
  const [jobDelay, setJobDelay]           = useState(15);
  const [delaySettings, setDelaySettings] = useState(15);

  const cooldownLeft = useCooldownTimer(progress?.cooldownSeconds ?? 0);

  const { data: campaign, isLoading: isCampaignLoading } = useGetCampaign(campaignId, {
    query: { enabled: !!campaignId, queryKey: getGetCampaignQueryKey(campaignId) }
  });

  const { data: leadsData, isLoading: isLeadsLoading } = useGetLeads(
    { campaignId, page: leadsPage, limit: 10 },
    { query: { enabled: !!campaignId && showLeads } }
  );

  const { data: analytics } = useQuery({
    queryKey: ["campaign-analytics", campaignId],
    enabled: !!campaignId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res   = await fetch(`/api/campaigns/${campaignId}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json() as Promise<{
        total: number; sent: number; failed: number; remaining: number;
        totalOpens: number; uniqueOpens: number;
        deliveryRate: number; failedRate: number; openRate: number;
        sendMode: string;
      }>;
    },
  });

  // ─── Fetch progress ──────────────────────────────────────────────────────────
  const fetchProgress = useCallback(async () => {
    if (!campaignId) return;
    try {
      const token = localStorage.getItem("auth_token");
      const res   = await fetch(`/api/campaigns/${campaignId}/progress`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load progress");
      const data: CampaignProgress = await res.json();
      setProgress(data);
      setProgressError(null);
      if (data.currentJobId) setActiveJobId(data.currentJobId);
    } catch (err: any) {
      setProgressError(err.message);
    }
  }, [campaignId]);

  // ─── Fetch batch history ─────────────────────────────────────────────────────
  const fetchBatches = useCallback(async () => {
    if (!campaignId) return;
    try {
      const token = localStorage.getItem("auth_token");
      const res   = await fetch(`/api/campaigns/${campaignId}/batches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setBatches(data.data ?? []);
    } catch { /* silent */ }
  }, [campaignId]);

  // ─── Load mailbox delay setting ──────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch("/api/mailbox", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d?.delaySeconds) setDelaySettings(d.delaySeconds); })
      .catch(() => {});
  }, []);

  // ─── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!campaignId) return;
    fetchProgress();
    fetchBatches();
  }, [campaignId, fetchProgress, fetchBatches]);

  // ─── Poll progress while job active ─────────────────────────────────────────
  useEffect(() => {
    if (!campaignId) return;
    const interval = setInterval(() => {
      fetchProgress();
    }, 3000);
    return () => clearInterval(interval);
  }, [campaignId, fetchProgress]);

  // ─── Send next batch ─────────────────────────────────────────────────────────
  async function handleSendBatch(size: number) {
    setIsSending(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res   = await fetch(`/api/campaigns/${campaignId}/send-batch`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ batchSize: size }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send batch");

      if (data.jobId) {
        setActiveJobId(data.jobId);
        setJobDelay(data.delaySeconds ?? delaySettings);
        toast({
          title: `${data.total} email${data.total !== 1 ? "s" : ""} queued`,
          description: `SMTP sending started with ${data.delaySeconds ?? delaySettings}s delay.`,
        });
      } else {
        toast({
          title: `${data.succeeded ?? 0} draft${(data.succeeded ?? 0) !== 1 ? "s" : ""} created`,
          description: data.failed > 0 ? `${data.failed} failed.` : "Open Gmail Drafts to review.",
        });
      }

      await Promise.all([fetchProgress(), fetchBatches()]);
      queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey({ campaignId, page: leadsPage, limit: 10 }) });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Send Error", description: err.message });
    } finally {
      setIsSending(false);
    }
  }

  // ─── Job complete callback ────────────────────────────────────────────────────
  function handleJobComplete() {
    fetchProgress();
    fetchBatches();
    queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey({ campaignId, page: leadsPage, limit: 10 }) });
    queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
  }

  // ─── Loading state ────────────────────────────────────────────────────────────
  if (isCampaignLoading) {
    return (
      <div className="space-y-5 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Campaign not found.</p>
        <Button asChild variant="outline" className="mt-4 rounded-xl">
          <Link href="/campaigns"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Campaigns</Link>
        </Button>
      </div>
    );
  }

  const pct      = progress && progress.total > 0
    ? Math.round(((progress.sent + progress.queued) / progress.total) * 100) : 0;
  const isSmtp   = (progress?.sendMode ?? campaign.sendMode) === "smtp";
  const isDone   = progress?.remaining === 0 && (progress?.queued ?? 0) === 0;
  const isActive = progress?.isJobActive ?? false;

  const statusColors: Record<string, string> = {
    pending:   "bg-amber-100 text-amber-800",
    sending:   "bg-blue-100 text-blue-800",
    paused:    "bg-slate-100 text-slate-600",
    completed: "bg-emerald-100 text-emerald-800",
    failed:    "bg-red-100 text-red-800",
    drafted:   "bg-violet-100 text-violet-800",
  };

  const sendModeLabel = isSmtp ? "SMTP Direct" : "Gmail Drafts";
  const sendModeIcon  = isSmtp
    ? <Server className="h-3.5 w-3.5" />
    : <Mail className="h-3.5 w-3.5" />;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Campaigns
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{campaign.name}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColors[campaign.status] ?? "bg-slate-100 text-slate-600"}`}>
                {campaign.status}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                {sendModeIcon} {sendModeLabel}
              </span>
              {campaign.fileName && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <FileText className="h-3 w-3" /> {campaign.fileName}
                </span>
              )}
              <span className="text-xs text-slate-400">
                {new Date(campaign.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Gmail open button */}
          {!isSmtp && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs flex-shrink-0" asChild>
              <a href="https://mail.google.com/mail/u/0/#drafts" target="_blank" rel="noreferrer">
                <Inbox className="h-3.5 w-3.5" /> Open Gmail Drafts
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* ─── Progress Bar ─────────────────────────────────────────────────────── */}
      {progress && progress.total > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600">{pct}% processed</span>
            <span className="text-xs text-slate-400">{progress.sent + progress.queued} / {progress.total}</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${isDone ? "bg-emerald-500" : isActive ? "bg-blue-500" : "bg-blue-400"}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* ─── Stat Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total Leads"
          value={progress?.total ?? campaign.totalLeads}
          color="bg-slate-50 border-slate-200 text-slate-800"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label={isSmtp ? "Sent" : "Drafted"}
          value={progress?.sent ?? 0}
          color="bg-emerald-50 border-emerald-100 text-emerald-800"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Remaining"
          value={progress?.remaining ?? 0}
          sub={progress?.remaining && progress.remaining > 0 ? "unsent leads" : undefined}
          color="bg-blue-50 border-blue-100 text-blue-800"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Failed"
          value={progress?.failed ?? 0}
          color={
            (progress?.failed ?? 0) > 0
              ? "bg-red-50 border-red-100 text-red-800"
              : "bg-slate-50 border-slate-100 text-slate-500"
          }
          icon={<XCircle className="h-4 w-4" />}
        />
      </div>

      {/* ─── Hourly rate card (SMTP only) ─────────────────────────────────────── */}
      {isSmtp && progress && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-violet-700">
            <Gauge className="h-4 w-4" />
            <span className="text-sm font-semibold">Hourly Rate</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600 flex-wrap">
            <span>{progress.sentThisHour} / {progress.hourlyLimit} sent this hour</span>
            <span className="h-3 w-px bg-slate-200" />
            <span>{progress.remainingQuota} remaining quota</span>
          </div>

          {cooldownLeft > 0 && (
            <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200">
              <Timer className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-xs font-semibold text-amber-800">
                Cooldown: {formatSeconds(cooldownLeft)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── Cooldown warning ─────────────────────────────────────────────────── */}
      {cooldownLeft > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Hourly limit reached</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Sending will resume automatically. You can also send the next batch manually in{" "}
              <span className="font-bold">{formatSeconds(cooldownLeft)}</span>.
            </p>
          </div>
        </div>
      )}

      {/* ─── Active SMTP Job ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isSmtp && activeJobId && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            key={activeJobId}
          >
            <SendProgressPanel
              jobId={activeJobId}
              delaySeconds={jobDelay}
              onComplete={handleJobComplete}
              onReset={() => {
                setActiveJobId(null);
                fetchProgress();
                fetchBatches();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Send Next Batch ──────────────────────────────────────────────────── */}
      {!isDone && (progress?.remaining ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Play className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Send Next Batch</p>
                <p className="text-xs text-slate-500">
                  {progress?.remaining ?? 0} leads remaining · {sendModeLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 py-4">
            {/* Batch size selector */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-600 mb-2 block">Batch Size</label>
              <div className="flex gap-2 flex-wrap">
                {BATCH_SIZES.map(n => (
                  <button
                    key={n}
                    onClick={() => setBatchSize(n)}
                    disabled={n > (progress?.remaining ?? 0)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      batchSize === n
                        ? "border-blue-500 bg-blue-50 text-blue-800"
                        : n > (progress?.remaining ?? 0)
                          ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                          : "border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setBatchSize(progress?.remaining ?? 0)}
                  disabled={(progress?.remaining ?? 0) === 0}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    batchSize === (progress?.remaining ?? 0)
                      ? "border-blue-500 bg-blue-50 text-blue-800"
                      : "border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  All ({progress?.remaining ?? 0})
                </button>
              </div>
            </div>

            {/* Cooldown notice */}
            {cooldownLeft > 0 && progress?.isHourlyLimitReached && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <Timer className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                Hourly limit reached. Sending available in {formatSeconds(cooldownLeft)}.
              </div>
            )}

            <Button
              onClick={() => handleSendBatch(batchSize)}
              disabled={isSending || isActive || (isSmtp && cooldownLeft > 0 && (progress?.isHourlyLimitReached ?? false))}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2"
            >
              {isSending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                : isActive
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Job in progress…</>
                  : <><Send className="h-4 w-4" /> Send Next {batchSize} {isSmtp ? "emails" : "drafts"}</>}
            </Button>
          </div>
        </div>
      )}

      {/* ─── Done banner ──────────────────────────────────────────────────────── */}
      {isDone && progress && progress.total > 0 && (
        <div className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${
          (progress.failed ?? 0) > 0
            ? "bg-amber-50 border-amber-200"
            : "bg-emerald-50 border-emerald-200"
        }`}>
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {(progress.failed ?? 0) > 0
              ? <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              : <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-0.5" />}
            <div>
              <p className={`font-bold text-sm ${(progress.failed ?? 0) > 0 ? "text-amber-900" : "text-emerald-900"}`}>
                {(progress.failed ?? 0) > 0
                  ? `Campaign complete — ${progress.sent} sent, ${progress.failed} failed`
                  : `All ${progress.sent} ${isSmtp ? "emails sent" : "drafts created"} successfully!`}
              </p>
              <p className={`text-xs mt-0.5 ${(progress.failed ?? 0) > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {(progress.failed ?? 0) > 0
                  ? "Use the Sent Emails page to retry or ignore failed emails."
                  : isSmtp ? "Check your Sent folder for delivery confirmations." : "Review your Gmail Drafts folder."}
              </p>
            </div>
          </div>
          {(progress.failed ?? 0) > 0 && (
            <Button asChild size="sm" variant="outline" className="rounded-xl gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-100 flex-shrink-0">
              <Link href="/sent-emails">
                <ExternalLink className="h-3.5 w-3.5" /> Retry Failed Emails
              </Link>
            </Button>
          )}
        </div>
      )}

      {/* ─── Batch History ────────────────────────────────────────────────────── */}
      {batches.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBatches(b => !b)}
            className="w-full px-5 py-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="h-8 w-8 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
              <Layers className="h-4 w-4 text-violet-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900">Batch History</p>
              <p className="text-xs text-slate-500">{batches.length} batch{batches.length !== 1 ? "es" : ""} sent</p>
            </div>
            {showBatches
              ? <ChevronUp className="h-4 w-4 text-slate-400" />
              : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>

          <AnimatePresence>
            {showBatches && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                  {batches.map((batch, i) => (
                    <div key={batch.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                      <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                        {batches.length - i}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            batch.sendMode === "smtp"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-violet-50 text-violet-700"
                          }`}>
                            {batch.sendMode === "smtp" ? "SMTP" : "Gmail"}
                          </span>
                          <span className="text-xs text-slate-600">
                            Batch of <span className="font-semibold">{batch.batchSize}</span>
                          </span>
                          {batch.sentCount > 0 && (
                            <span className="text-xs text-emerald-700 font-medium">
                              ✓ {batch.sentCount} sent
                            </span>
                          )}
                          {batch.failedCount > 0 && (
                            <span className="text-xs text-red-700 font-medium">
                              ✗ {batch.failedCount} failed
                            </span>
                          )}
                          {batch.mailboxEmail && (
                            <span className="text-xs text-slate-400 truncate">{batch.mailboxEmail}</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(batch.createdAt).toLocaleString([], {
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ─── Leads Table ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowLeads(b => !b)}
          className="w-full px-5 py-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
        >
          <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Users className="h-4 w-4 text-slate-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900">Campaign Leads</p>
            <p className="text-xs text-slate-500">{leadsData?.total ?? 0} total</p>
          </div>
          <Button
            variant="ghost" size="sm"
            onClick={e => { e.stopPropagation(); fetchProgress(); fetchBatches(); }}
            className="text-slate-400 hover:text-slate-600 h-7 w-7 p-0 rounded-xl"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          {showLeads
            ? <ChevronUp className="h-4 w-4 text-slate-400" />
            : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>

        <AnimatePresence>
          {showLeads && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-slate-100 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 hidden sm:table-cell">Vehicle</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 hidden md:table-cell">Route</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLeadsLoading ? (
                      Array(5).fill(0).map((_, i) => (
                        <tr key={i}>
                          {[...Array(6)].map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <Skeleton className="h-4 w-full" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : leadsData?.data?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">
                          No leads in this campaign yet.
                        </td>
                      </tr>
                    ) : (
                      leadsData?.data?.map(lead => {
                        const statusBadge: Record<string, string> = {
                          new:     "bg-slate-100 text-slate-600",
                          queued:  "bg-blue-100 text-blue-700",
                          sent:    "bg-emerald-100 text-emerald-700",
                          drafted: "bg-violet-100 text-violet-700",
                          failed:  "bg-red-100 text-red-700",
                        };
                        return (
                          <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-xs font-medium text-slate-800 truncate max-w-[120px]">
                              {lead.name || "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600 truncate max-w-[160px]">
                              {lead.email}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell truncate max-w-[120px]">
                              {lead.vehicle || "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell truncate max-w-[140px]">
                              {lead.pickup && lead.delivery
                                ? `${lead.pickup} → ${lead.delivery}`
                                : lead.route || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusBadge[lead.status] ?? "bg-slate-100 text-slate-600"}`}>
                                {lead.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {lead.status === "failed" && (
                                <Button asChild variant="ghost" size="sm" className="h-6 px-2 text-xs rounded-lg text-red-600 hover:bg-red-50 gap-1">
                                  <Link href="/sent-emails">
                                    <RotateCcw className="h-3 w-3" /> Retry
                                  </Link>
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-5 py-3 flex items-center justify-between border-t border-slate-100">
                <Button
                  variant="outline" size="sm"
                  disabled={leadsPage === 1}
                  onClick={() => setLeadsPage(p => p - 1)}
                  className="rounded-xl text-xs"
                >
                  Previous
                </Button>
                <span className="text-xs text-slate-400">
                  Page {leadsData?.page ?? 1} of {Math.max(1, Math.ceil((leadsData?.total ?? 0) / 10))}
                </span>
                <Button
                  variant="outline" size="sm"
                  disabled={leadsPage >= Math.ceil((leadsData?.total ?? 0) / 10)}
                  onClick={() => setLeadsPage(p => p + 1)}
                  className="rounded-xl text-xs"
                >
                  Next
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Campaign Analytics ─────────────────────────────────────────────── */}
        {analytics && campaign?.sendMode === "smtp" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors"
              onClick={() => {}}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <BarChart3 className="h-4 w-4 text-slate-500" />
                Campaign Analytics
              </div>
            </button>
            <div className="border-t border-slate-100 px-5 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: "Delivery Rate",
                    value: `${analytics.deliveryRate}%`,
                    sub: `${analytics.sent} of ${analytics.total} sent`,
                    color: "emerald",
                    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
                  },
                  {
                    label: "Open Rate",
                    value: `${analytics.openRate}%`,
                    sub: `${analytics.uniqueOpens} unique opens`,
                    color: "blue",
                    icon: <Eye className="h-4 w-4 text-blue-500" />,
                  },
                  {
                    label: "Total Opens",
                    value: analytics.totalOpens,
                    sub: analytics.totalOpens !== analytics.uniqueOpens
                      ? `${analytics.totalOpens - analytics.uniqueOpens} re-opens`
                      : "all unique",
                    color: "violet",
                    icon: <TrendingUp className="h-4 w-4 text-violet-500" />,
                  },
                  {
                    label: "Failed Rate",
                    value: `${analytics.failedRate}%`,
                    sub: `${analytics.failed} failed`,
                    color: analytics.failed > 0 ? "red" : "slate",
                    icon: <XCircle className={`h-4 w-4 ${analytics.failed > 0 ? "text-red-500" : "text-slate-400"}`} />,
                  },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 rounded-xl p-3.5">
                    <div className="mb-1.5">{s.icon}</div>
                    <div className="text-xl font-bold text-slate-900">{s.value}</div>
                    <div className="text-xs font-medium text-slate-600 mt-0.5">{s.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
                  </div>
                ))}
              </div>
              {analytics.sent > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>Delivery</span>
                    <span>{analytics.deliveryRate}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                      style={{ width: `${analytics.deliveryRate}%` }}
                    />
                  </div>
                  {analytics.uniqueOpens > 0 && (
                    <>
                      <div className="flex justify-between text-xs text-slate-500 mb-1.5 mt-2">
                        <span>Opens</span>
                        <span>{analytics.openRate}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-700"
                          style={{ width: `${analytics.openRate}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className="mt-3 flex justify-end">
                <Link href="/sent-emails" className="text-xs text-primary hover:underline flex items-center gap-1">
                  View all sent emails →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
