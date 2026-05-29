import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Eye, Mail, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface OpenEvent {
  id: number;
  openedAt: string;
  email: string | null;
  customerName: string | null;
  subject: string | null;
  campaignId: number | null;
  isAppleMail: boolean;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return "just now";
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function getAuthHeaders(): Record<string, string> {
  const t = localStorage.getItem("auth_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const LS_KEY = "notif_last_seen";

export function NotificationBell() {
  const [events,   setEvents]  = useState<OpenEvent[]>([]);
  const [open,     setOpen]    = useState(false);
  const [loading,  setLoading] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const lastSeen = useRef<string | null>(
    typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null
  );

  const unreadCount = events.filter(e =>
    !lastSeen.current || e.openedAt > lastSeen.current
  ).length;

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/live?limit=10", {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    fetchEvents();
  }, [fetchEvents]);

  // Poll every 15 seconds
  useEffect(() => {
    const id = setInterval(fetchEvents, 15_000);
    return () => clearInterval(id);
  }, [fetchEvents]);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function handleOpen() {
    if (!open) {
      // Mark all as seen
      const now = new Date().toISOString();
      localStorage.setItem(LS_KEY, now);
      lastSeen.current = now;
    }
    setOpen(v => !v);
  }

  const display = unreadCount > 9 ? "9+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={handleOpen}
        className={cn(
          "relative flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
          open
            ? "bg-blue-50 text-blue-600"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        )}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {display && (
          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-0.5 flex items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold leading-none">
            {display}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-slate-900">Email Opens</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col gap-1 p-3">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl">
                    <div className="h-8 w-8 rounded-xl bg-slate-100 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3" />
                      <div className="h-2.5 bg-slate-100 rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Mail className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs font-medium">No opens tracked yet</p>
                <p className="text-xs mt-0.5 text-center px-4">
                  Opens appear here when a lead reads your email.
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {events.map(e => (
                  <div key={e.id} className="flex items-start gap-3 px-2.5 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className={cn(
                      "h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
                      e.isAppleMail ? "bg-slate-50 text-slate-400" : "bg-emerald-50 text-emerald-600"
                    )}>
                      <Eye className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {e.customerName ?? e.email ?? "Unknown"}
                      </p>
                      {e.email && e.customerName && (
                        <p className="text-xs text-slate-400 truncate">{e.email}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-slate-400">{timeAgo(e.openedAt)}</span>
                        {e.isAppleMail && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                            Apple Mail
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {events.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 text-center">
              <a
                href="/sent-emails"
                className="text-xs text-primary hover:underline"
                onClick={() => setOpen(false)}
              >
                View all sent emails →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
