import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetTemplate,
  useUpdateTemplate,
  getGetTemplateQueryKey,
  usePreviewEmail,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Save, Play, Loader2, AlertTriangle, RefreshCw, Clock,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PreviewEmailInputTone } from "@workspace/api-client-react";

const CHIPS = ["{name}", "{vehicle}", "{route}", "{pickup}", "{delivery}", "{price}"];

// ---------------------------------------------------------------------------
// Error parsing — converts raw API errors into friendly strings
// ---------------------------------------------------------------------------

interface ParsedAiError {
  message: string;
  isQuota: boolean;
  retryAfterSec: number | null;
}

function parseAiError(err: unknown): ParsedAiError {
  // Duck-type the ApiError shape (status + data)
  const status = (err as any)?.status as number | undefined;
  const data = (err as any)?.data as Record<string, unknown> | null | undefined;
  const headers = (err as any)?.headers as Headers | undefined;

  const serverMsg = typeof data?.error === "string" ? data.error : null;
  const isQuota = !!(data as any)?.quota || serverMsg?.toLowerCase().includes("quota") || serverMsg?.toLowerCase().includes("daily");

  const retryAfterHeader = headers?.get?.("retry-after");
  const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) || null : null;

  if (status === 429) {
    if (isQuota) {
      return {
        message: "Daily AI quota reached. Please try again later.",
        isQuota: true,
        retryAfterSec,
      };
    }
    return {
      message: serverMsg ?? "AI is temporarily busy. Please wait a few seconds and try again.",
      isQuota: false,
      retryAfterSec,
    };
  }

  if (status === 503 || status === 502) {
    return {
      message: "The AI service is temporarily unavailable. Please try again in a moment.",
      isQuota: false,
      retryAfterSec: 10,
    };
  }

  return {
    message: serverMsg ?? "Failed to generate preview. Please try again.",
    isQuota: false,
    retryAfterSec: null,
  };
}

// ---------------------------------------------------------------------------
// Retry countdown helper
// ---------------------------------------------------------------------------

function useRetryCountdown(seconds: number | null, onExpired: () => void) {
  const [remaining, setRemaining] = useState<number | null>(seconds);
  useEffect(() => {
    if (seconds == null) { setRemaining(null); return; }
    setRemaining(seconds);
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev == null || prev <= 1) {
          clearInterval(interval);
          onExpired();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);
  return remaining;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TemplateEditor() {
  const [, params] = useRoute("/templates/:id");
  const templateId = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: template, isLoading } = useGetTemplate(templateId, {
    query: { enabled: !!templateId, queryKey: getGetTemplateQueryKey(templateId) },
  });

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [previewTone, setPreviewTone] = useState<PreviewEmailInputTone>("professional");
  const [previewData, setPreviewData] = useState<{ subject: string; body: string } | null>(null);
  const [previewError, setPreviewError] = useState<ParsedAiError | null>(null);

  // Debounce: track when the last request was sent
  const lastRequestRef = useRef<number>(0);
  const DEBOUNCE_MS = 1500;

  const initializedForId = useRef<number | null>(null);
  useEffect(() => {
    if (template && initializedForId.current !== templateId) {
      initializedForId.current = templateId;
      setName(template.name);
      setSubject(template.subject);
      setBody(template.body);
    }
  }, [template, templateId]);

  const updateTemplate = useUpdateTemplate();
  const previewEmail = usePreviewEmail();

  // When error has a retryAfterSec, auto-clear the error after that delay
  const retryAfterSec = previewError?.retryAfterSec ?? null;
  useRetryCountdown(retryAfterSec, () => setPreviewError(null));

  const handleSave = () => {
    updateTemplate.mutate(
      { id: templateId, data: { name, subject, body } },
      {
        onSuccess: (data) => {
          toast({ title: "Template saved" });
          queryClient.setQueryData(getGetTemplateQueryKey(templateId), data);
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Save failed", description: err.message });
        },
      }
    );
  };

  const runPreview = useCallback(() => {
    // Debounce guard
    const now = Date.now();
    if (now - lastRequestRef.current < DEBOUNCE_MS) return;
    // In-flight guard (belt+suspenders on top of disabled button)
    if (previewEmail.isPending) return;

    lastRequestRef.current = now;
    setPreviewError(null);

    previewEmail.mutate(
      {
        data: {
          templateId,
          tone: previewTone,
          leadData: {
            name: "John Smith",
            email: "john@example.com",
            vehicle: "2023 Tesla Model Y",
            pickup: "Miami, FL",
            delivery: "Seattle, WA",
            price: "$1,250",
          },
        },
      },
      {
        onSuccess: (data) => {
          setPreviewData(data);
          setPreviewError(null);
        },
        onError: (err: unknown) => {
          const parsed = parseAiError(err);
          setPreviewError(parsed);
          // Only toast for non-rate-limit errors (inline UI covers 429)
          if (parsed.message && !parsed.isQuota && (err as any)?.status !== 429) {
            toast({ variant: "destructive", title: "Preview failed", description: parsed.message });
          }
        },
      }
    );
  }, [previewEmail, previewTone, templateId, toast]);

  const insertChip = (chip: string) => setBody(prev => prev + chip);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/templates" className="hover:text-primary flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Templates
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Edit Template</h2>
        <Button onClick={handleSave} disabled={updateTemplate.isPending}>
          {updateTemplate.isPending
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* ── Left: editor ── */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Template Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Subject Line</label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Body</label>
              <div className="flex gap-2 flex-wrap">
                {CHIPS.map(chip => (
                  <button
                    key={chip}
                    onClick={() => insertChip(chip)}
                    className="text-xs bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              className="min-h-[400px] font-mono"
            />
          </div>
        </div>

        {/* ── Right: AI Preview panel ── */}
        <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="h-14 border-b border-border bg-muted/20 px-4 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Play className="h-4 w-4" /> AI Preview
            </h3>
            <div className="flex items-center gap-2">
              <Select
                value={previewTone}
                onValueChange={(v) => setPreviewTone(v as PreviewEmailInputTone)}
              >
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                </SelectContent>
              </Select>

              <Button
                size="sm"
                variant="secondary"
                onClick={runPreview}
                disabled={previewEmail.isPending || !!previewError?.retryAfterSec}
              >
                {previewEmail.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Generating…
                  </>
                ) : previewError?.retryAfterSec ? (
                  <>
                    <Clock className="h-4 w-4 mr-1.5" />
                    Wait {previewError.retryAfterSec}s
                  </>
                ) : (
                  "Run Test"
                )}
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 flex-1 bg-background/50 min-h-[300px]">
            {/* Loading skeleton */}
            {previewEmail.isPending && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-3/4" />
                </div>
                <div className="space-y-2 pt-2">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            )}

            {/* Error state */}
            {!previewEmail.isPending && previewError && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8">
                <div className={`rounded-full p-3 ${previewError.isQuota ? "bg-orange-500/10" : "bg-yellow-500/10"}`}>
                  <AlertTriangle className={`h-8 w-8 ${previewError.isQuota ? "text-orange-400" : "text-yellow-400"}`} />
                </div>
                <div className="space-y-1 max-w-xs">
                  <p className="font-medium text-foreground">
                    {previewError.isQuota ? "Quota Reached" : "AI Temporarily Busy"}
                  </p>
                  <p className="text-sm text-muted-foreground">{previewError.message}</p>
                </div>
                {!previewError.isQuota && !previewError.retryAfterSec && (
                  <Button size="sm" variant="outline" onClick={runPreview} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </Button>
                )}
                {previewError.retryAfterSec && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Auto-retry in {previewError.retryAfterSec}s
                  </p>
                )}
              </div>
            )}

            {/* Success result */}
            {!previewEmail.isPending && !previewError && previewData && (
              <div className="space-y-6">
                <div>
                  <div className="text-xs text-muted-foreground mb-1 uppercase font-semibold tracking-wider">
                    Subject
                  </div>
                  <div className="font-medium">{previewData.subject}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1 uppercase font-semibold tracking-wider">
                    Body
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-foreground/90 font-mono">
                    {previewData.body}
                  </div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!previewEmail.isPending && !previewError && !previewData && (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center">
                <Play className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm">
                  Click "Run Test" to generate a sample email
                  <br />
                  using AI and dummy lead data.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
