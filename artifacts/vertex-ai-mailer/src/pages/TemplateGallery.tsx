import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Eye, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

type TemplateStyle = {
  id: string;
  label: string;
  desc: string;
  bg: string;
  accent: string;
  textColor: string;
  badge?: string;
  badgeColor?: string;
};

const TEMPLATES: TemplateStyle[] = [
  { id: "clean",     label: "Clean",             desc: "Classic blue header, white card — the industry standard for transport quotes.",      bg: "#1d4ed8",  accent: "#1d4ed8",  textColor: "#fff",     badge: "Popular", badgeColor: "bg-blue-100 text-blue-700" },
  { id: "modern",    label: "Modern",             desc: "Purple gradient header, contemporary look for forward-thinking brokers.",            bg: "#4f46e5",  accent: "#4f46e5",  textColor: "#fff" },
  { id: "minimal",   label: "Minimal",            desc: "Clean white with thin accent line — high deliverability, distraction-free.",         bg: "#f8fafc",  accent: "#2563eb",  textColor: "#1e293b" },
  { id: "luxury",    label: "Luxury",             desc: "Dark navy with gold accents and serif typography. Premium service positioning.",     bg: "#0f172a",  accent: "#d97706",  textColor: "#d97706",  badge: "Premium", badgeColor: "bg-amber-100 text-amber-700" },
  { id: "corporate", label: "Corporate",          desc: "Deep navy, formal business style with \"QUOTE\" badge — professional authority.",    bg: "#0a2558",  accent: "#0a2558",  textColor: "#fff",     badge: "New", badgeColor: "bg-emerald-100 text-emerald-700" },
  { id: "urgent",    label: "Urgent",             desc: "Red header with ⚡ TIME-SENSITIVE badge — ideal for follow-up sequences.",           bg: "#dc2626",  accent: "#dc2626",  textColor: "#fff",     badge: "New", badgeColor: "bg-emerald-100 text-emerald-700" },
  { id: "dispatch",  label: "Dispatch",           desc: "Emerald green with dispatch branding — conveys reliability and speed.",             bg: "#065f46",  accent: "#059669",  textColor: "#fff",     badge: "New", badgeColor: "bg-emerald-100 text-emerald-700" },
  { id: "friendly",  label: "Friendly Broker",    desc: "Sky blue header, warm footer — builds trust and approachability.",                  bg: "#0369a1",  accent: "#0369a1",  textColor: "#fff",     badge: "New", badgeColor: "bg-emerald-100 text-emerald-700" },
  { id: "mobile",    label: "Mobile Optimized",   desc: "Ultra minimal, large readable text. Perfect for recipients on mobile.",              bg: "#f8fafc",  accent: "#1e40af",  textColor: "#1e293b",  badge: "New", badgeColor: "bg-emerald-100 text-emerald-700" },
  { id: "dark",      label: "Dark Modern",        desc: "Dark navy card on dark background — modern, tech-forward, eye-catching.",           bg: "#1e293b",  accent: "#3b82f6",  textColor: "#93c5fd",  badge: "New", badgeColor: "bg-emerald-100 text-emerald-700" },
];

const SAMPLE_SUBJECT = "Your Auto Transport Quote — {vehicle} from {pickup} to {delivery}";
const SAMPLE_BODY = `Hi {name},

Thank you for reaching out! I've prepared a personalized transport quote for your {vehicle}.

Here are the details:

• Vehicle: {vehicle}
• Pickup: {pickup}
• Delivery: {delivery}
• Quoted Price: {price}
• Quote Reference: {quote_id}

This is a fully insured, door-to-door service from a licensed auto transport broker. We handle everything from pickup scheduling to final delivery confirmation.

Please reply to this email or call us to confirm your booking. This quote is valid for 7 days.

We look forward to transporting your vehicle safely!`;

const SAMPLE_ROW = {
  name:       "Sarah Johnson",
  vehicle:    "2022 Tesla Model 3",
  pickup:     "Los Angeles, CA",
  delivery:   "New York, NY",
  price:      "1250",
  quote_id:   "BM-20240528",
};

function TemplateCard({ tmpl, onPreview }: { tmpl: TemplateStyle; onPreview: (id: string) => void }) {
  const isDark = tmpl.bg.startsWith("#0") || tmpl.bg.startsWith("#1") || tmpl.id === "dark";
  const textOnBg = isDark ? "#ffffff" : tmpl.id === "minimal" || tmpl.id === "mobile" ? "#1e293b" : "#ffffff";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-slate-300 transition-all group">
      {/* Color swatch */}
      <div
        className="h-24 relative flex items-center justify-center"
        style={{ backgroundColor: tmpl.bg }}
      >
        {/* Mini email card simulation */}
        <div className="w-28 bg-white/95 rounded-lg overflow-hidden shadow-sm">
          <div className="h-5" style={{ backgroundColor: tmpl.accent, opacity: 0.9 }} />
          <div className="p-2 space-y-1">
            <div className="h-1.5 rounded-full bg-slate-200 w-4/5" />
            <div className="h-1.5 rounded-full bg-slate-200 w-3/5" />
            <div className="h-1.5 rounded-full bg-slate-200 w-2/3 mt-1" />
            <div className="h-1.5 rounded-full bg-slate-100 w-1/2" />
          </div>
        </div>
        {tmpl.badge && (
          <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-semibold ${tmpl.badgeColor}`}>
            {tmpl.badge}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-slate-900 text-sm">{tmpl.label}</h3>
        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{tmpl.desc}</p>
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="outline" size="sm"
            onClick={() => onPreview(tmpl.id)}
            className="rounded-xl gap-1.5 text-xs flex-1"
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
          <Button asChild size="sm" variant="ghost" className="rounded-xl gap-1 text-xs text-blue-600 hover:bg-blue-50 flex-1">
            <Link href={`/leads/import`}>
              Use <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({
  styleId,
  open,
  onClose,
}: {
  styleId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [html, setHtml]       = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [withSig, setWithSig] = useState(false);

  const fetchPreview = useCallback(async (style: string, useSig: boolean) => {
    setLoading(true); setError(null); setHtml(null);
    try {
      const token = localStorage.getItem("auth_token") ?? "";
      const res = await fetch("/api/drafts/preview", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          body: SAMPLE_BODY,
          subject: SAMPLE_SUBJECT,
          row: SAMPLE_ROW,
          style,
          useSignatureBuilder: useSig,
        }),
      });
      if (!res.ok) throw new Error(`Preview failed (${res.status})`);
      const data = await res.json();
      setHtml(data.html ?? "");
      setSubject(data.subject ?? "");
    } catch (err: any) {
      setError(err.message ?? "Failed to load preview");
    } finally { setLoading(false); }
  }, []);

  const tmpl = TEMPLATES.find(t => t.id === styleId);

  useEffect(() => {
    if (open && styleId) {
      setHtml(null);
      setError(null);
      fetchPreview(styleId, withSig);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, styleId]);

  function handleSigToggle() {
    const next = !withSig;
    setWithSig(next);
    if (styleId) fetchPreview(styleId, next);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setHtml(null); setError(null); } }}>
      <DialogContent className="max-w-3xl w-full h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold text-slate-900 truncate">
                {tmpl?.label ?? styleId} — Template Preview
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {loading ? "Loading…" : (subject || SAMPLE_SUBJECT)}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleSigToggle}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  withSig ? "bg-blue-600" : "bg-slate-200"
                }`}
                title="Toggle signature"
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${
                  withSig ? "translate-x-4" : "translate-x-0"
                }`} />
              </button>
              <span className="text-xs text-slate-500">Signature</span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-slate-50 min-h-0">
          {loading && (
            <div className="p-6 space-y-3">
              <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-48 w-full" /><Skeleton className="h-4 w-1/2" />
            </div>
          )}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 p-8">
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" onClick={() => styleId && fetchPreview(styleId, withSig)} className="rounded-lg mt-1">
                Retry
              </Button>
            </div>
          )}
          {html && !loading && (
            <iframe srcDoc={html} className="w-full h-full border-0 min-h-[500px]" title="Template Preview" sandbox="allow-same-origin" />
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">Using sample lead data: Sarah Johnson · 2022 Tesla Model 3 · LA → NYC</p>
          <Button asChild className="rounded-xl gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm">
            <Link href="/leads/import">
              <Sparkles className="h-3.5 w-3.5" /> Use this style <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TemplateGallery() {
  const [previewStyle, setPreviewStyle] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Template Gallery</h1>
        <p className="text-slate-500 mt-1 text-sm">
          10 professional email styles for auto transport brokers. Click Preview to see a live rendered email with sample data.
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> All templates are mobile-responsive
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Gmail, Outlook &amp; Apple Mail safe
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Supports company logo &amp; branding
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Open tracking included
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {TEMPLATES.map(tmpl => (
          <TemplateCard key={tmpl.id} tmpl={tmpl} onPreview={id => setPreviewStyle(id)} />
        ))}
      </div>

      <PreviewModal
        styleId={previewStyle}
        open={!!previewStyle}
        onClose={() => setPreviewStyle(null)}
      />
    </div>
  );
}
