import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Eye, Mail, CheckCircle2, Clock, AlertCircle, ChevronRight,
  User, AtSign, Calendar, Server, BarChart3, Search, Hash, X,
} from "lucide-react";

type SentEmail = {
  id: number;
  email: string;
  customerName: string | null;
  quoteId: string | null;
  subject: string;
  sentAt: string | null;
  mailboxEmail: string | null;
  mailboxFromName: string | null;
  status: string;
  trackingId: string | null;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  campaignId: number | null;
};

type TimelineEvent = { type: string; timestamp: string; detail?: string };

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

function TrackingBadge({ trackingId, openCount }: { trackingId: string | null; openCount: number }) {
  if (!trackingId) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200">
        <CheckCircle2 className="h-3 w-3" /> Sent
      </span>
    );
  }
  if (openCount === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
        <CheckCircle2 className="h-3 w-3" /> Delivered
      </span>
    );
  }
  if (openCount === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Eye className="h-3 w-3" /> Opened
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
      <Eye className="h-3 w-3" /> Opened {openCount}×
    </span>
  );
}

function EmailPreviewModal({
  emailId,
  open,
  onClose,
}: {
  emailId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data: preview, isLoading: loadingPreview } = useQuery({
    queryKey: ["sent-email-preview", emailId],
    enabled: !!emailId && open,
    queryFn: () =>
      apiFetch<{ html: string; subject: string; to: string; sentAt: string | null; customerName: string | null }>(
        `/api/sent-emails/${emailId}/preview`
      ),
  });

  const { data: timeline, isLoading: loadingTimeline } = useQuery({
    queryKey: ["sent-email-timeline", emailId],
    enabled: !!emailId && open,
    queryFn: () =>
      apiFetch<{ events: TimelineEvent[]; email: string; subject: string }>(
        `/api/sent-emails/${emailId}/timeline`
      ),
  });

  const timelineIcons: Record<string, React.ReactNode> = {
    sent:      <CheckCircle2 className="h-4 w-4 text-blue-500" />,
    delivered: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    opened:    <Eye className="h-4 w-4 text-violet-500" />,
    failed:    <AlertCircle className="h-4 w-4 text-red-500" />,
  };

  const timelineLabels: Record<string, string> = {
    sent:      "Email sent via SMTP",
    delivered: "Delivered to inbox",
    opened:    "Recipient opened email",
    failed:    "Delivery failed",
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="min-w-0">
            <DialogTitle className="text-base font-semibold text-slate-900 truncate">
              {loadingPreview ? <Skeleton className="h-5 w-64" /> : (preview?.subject ?? "Email Preview")}
            </DialogTitle>
            {preview && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <AtSign className="h-3 w-3" /> {preview.to}
                </span>
                {preview.customerName && (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <User className="h-3 w-3" /> {preview.customerName}
                  </span>
                )}
                {preview.sentAt && (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(preview.sentAt).toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* HTML email preview */}
          <div className="flex-1 overflow-auto bg-slate-50">
            {loadingPreview ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : preview?.html ? (
              <iframe
                srcDoc={preview.html}
                className="w-full h-full border-0 min-h-[400px]"
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                Preview not available
              </div>
            )}
          </div>

          {/* Activity timeline panel */}
          <div className="w-64 flex-shrink-0 overflow-y-auto p-4 bg-white border-l border-slate-200">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Activity Timeline
            </h3>
            {loadingTimeline ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : (timeline?.events.length ?? 0) === 0 ? (
              <p className="text-xs text-slate-400">No activity recorded yet.</p>
            ) : (
              <ol className="space-y-0">
                {timeline!.events.map((ev, i) => (
                  <li key={i} className="flex gap-3 pb-4 relative">
                    <div className="flex flex-col items-center">
                      <div className="flex-shrink-0 mt-0.5">
                        {timelineIcons[ev.type] ?? <CheckCircle2 className="h-4 w-4 text-slate-400" />}
                      </div>
                      {i < timeline!.events.length - 1 && (
                        <div className="w-px flex-1 bg-slate-200 mt-1 min-h-[12px]" />
                      )}
                    </div>
                    <div className="min-w-0 pb-1">
                      <p className="text-xs font-medium text-slate-800">
                        {timelineLabels[ev.type] ?? ev.type}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(ev.timestamp).toLocaleString()}
                      </p>
                      {ev.detail && ev.type === "opened" && (
                        <p className="text-xs text-slate-400 truncate mt-0.5" title={ev.detail}>
                          {ev.detail.length > 40 ? ev.detail.slice(0, 40) + "…" : ev.detail}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SentEmails() {
  const [page, setPage]       = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["sent-emails", page, activeSearch],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (activeSearch) params.set("search", activeSearch);
      return apiFetch<{ data: SentEmail[]; total: number; page: number; limit: number }>(
        `/api/sent-emails?${params}`
      );
    },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setActiveSearch(searchInput.trim());
  }

  function handleClearSearch() {
    setSearchInput("");
    setActiveSearch("");
    setPage(1);
  }

  const emails  = data?.data ?? [];
  const total   = data?.total ?? 0;
  const pages   = Math.max(1, Math.ceil(total / 25));
  const opened  = emails.filter(e => e.openCount > 0).length;
  const tracked = emails.filter(e => e.trackingId).length;
  const openRate = tracked > 0 ? Math.round((opened / tracked) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sent Emails</h1>
          <p className="text-slate-500 mt-1 text-sm">
            All SMTP emails sent via your connected mailbox — with open tracking.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
          <BarChart3 className="h-4 w-4 text-slate-400" />
          <span className="font-medium text-slate-800">{total}</span>
          <span className="text-slate-400">sent</span>
          <span className="text-slate-300 mx-1">·</span>
          <Eye className="h-3.5 w-3.5 text-violet-500" />
          <span className="font-medium text-violet-700">{opened}</span>
          <span className="text-slate-400">opened</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Sent",  value: total,                                        color: "blue",   icon: <Mail className="h-4 w-4 text-blue-500" /> },
          { label: "Opened",      value: opened,                                       color: "emerald", icon: <Eye className="h-4 w-4 text-emerald-500" /> },
          { label: "Multi-Open",  value: emails.filter(e => e.openCount > 1).length,   color: "violet", icon: <Eye className="h-4 w-4 text-violet-500" /> },
          { label: "Open Rate",   value: total > 0 ? `${openRate}%` : "—",             color: "amber",  icon: <BarChart3 className="h-4 w-4 text-amber-500" /> },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="mb-2">{s.icon}</div>
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by email, name, or quote ID…"
            className="pl-9 rounded-xl border-slate-200"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button type="submit" variant="outline" className="rounded-xl gap-1.5 shrink-0">
          <Search className="h-3.5 w-3.5" /> Search
        </Button>
        {activeSearch && (
          <Button type="button" variant="ghost" onClick={handleClearSearch} className="rounded-xl text-slate-500 text-sm shrink-0">
            Clear
          </Button>
        )}
      </form>
      {activeSearch && (
        <p className="text-xs text-slate-500 -mt-3">
          Showing results for <strong>"{activeSearch}"</strong> — {total} match{total !== 1 ? "es" : ""}
        </p>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/70">
                <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Recipient</TableHead>
                <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide hidden xl:table-cell">Quote ID</TableHead>
                <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide hidden sm:table-cell">Subject</TableHead>
                <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide hidden md:table-cell">Mailbox</TableHead>
                <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide hidden lg:table-cell">Sent</TableHead>
                <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(6).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {[1, 2, 3, 4, 5, 6].map(j => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                ))
              ) : emails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-40 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Mail className="h-8 w-8 text-slate-200" />
                      <p className="text-sm font-medium">
                        {activeSearch ? "No emails match your search" : "No sent emails yet"}
                      </p>
                      <p className="text-xs">
                        {activeSearch ? "Try a different search term" : "Emails sent via SMTP campaigns will appear here with open tracking."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                emails.map(email => (
                  <TableRow
                    key={email.id}
                    className="hover:bg-slate-50/60 cursor-pointer group"
                    onClick={() => setSelectedId(email.id)}
                  >
                    <TableCell>
                      <div className="font-medium text-slate-900 text-sm">
                        {email.customerName || <span className="text-slate-400 italic text-xs">Unknown</span>}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <AtSign className="h-2.5 w-2.5 flex-shrink-0 text-slate-400" />
                        <span className="truncate max-w-[160px]">{email.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {email.quoteId ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-50 border border-violet-100 text-xs font-mono text-violet-700">
                          <Hash className="h-2.5 w-2.5" />{email.quoteId}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="text-sm text-slate-800 truncate max-w-xs">{email.subject}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Server className="h-3 w-3 flex-shrink-0 text-slate-400" />
                        <span className="truncate max-w-[140px]">
                          {email.mailboxFromName
                            ? `${email.mailboxFromName} <${email.mailboxEmail}>`
                            : (email.mailboxEmail ?? "—")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {email.sentAt ? (
                        <div>
                          <div className="text-sm text-slate-700">{new Date(email.sentAt).toLocaleDateString()}</div>
                          <div className="text-xs text-slate-400">{new Date(email.sentAt).toLocaleTimeString()}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <TrackingBadge trackingId={email.trackingId} openCount={email.openCount} />
                      {email.firstOpenedAt && (
                        <div className="text-xs text-slate-400 mt-1">
                          First: {new Date(email.firstOpenedAt).toLocaleDateString()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline" size="sm" disabled={page === 1}
          onClick={() => setPage(p => p - 1)} className="rounded-lg"
        >
          Previous
        </Button>
        <span className="text-sm text-slate-500">
          Page {page} of {pages} · {total.toLocaleString()} emails
        </span>
        <Button
          variant="outline" size="sm" disabled={page >= pages}
          onClick={() => setPage(p => p + 1)} className="rounded-lg"
        >
          Next
        </Button>
      </div>

      {/* Email preview + timeline modal */}
      <EmailPreviewModal
        emailId={selectedId}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
