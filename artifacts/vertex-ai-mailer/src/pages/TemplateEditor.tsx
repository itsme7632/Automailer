import { useState, useEffect, useMemo, useRef } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetTemplate,
  useUpdateTemplate,
  getGetTemplateQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2, Eye } from "lucide-react";

// All standard chips + reminder that any CSV column works
const CHIPS = [
  "{name}", "{email}", "{vehicle}", "{pickup}", "{delivery}",
  "{price}", "{route}", "{company}", "{phone}", "{notes}",
];

// Sample data used for live preview substitution
const SAMPLE_DATA: Record<string, string> = {
  name: "Alex Johnson",
  email: "alex@example.com",
  vehicle: "2023 Tesla Model Y",
  pickup: "Miami, FL",
  delivery: "Seattle, WA",
  price: "$1,250",
  route: "FL → WA",
  company: "Swift Transport LLC",
  phone: "(555) 123-4567",
  notes: "Enclosed transport preferred",
};

function replaceVariables(text: string, data: Record<string, string>): string {
  return text.replace(/\{([^}]+)\}/g, (match, key) => data[key.trim()] ?? match);
}

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

  const previewSubject = useMemo(() => replaceVariables(subject, SAMPLE_DATA), [subject]);
  const previewBody    = useMemo(() => replaceVariables(body, SAMPLE_DATA),    [body]);

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
        <Button onClick={handleSave} disabled={updateTemplate.isPending} className="rounded-xl gap-2">
          {updateTemplate.isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Save className="h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* ── Left: editor ── */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Template Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="rounded-xl" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Subject Line</label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} className="rounded-xl" placeholder="e.g. Shipping quote for your {vehicle}" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Body</label>
            </div>
            {/* Variable chips */}
            <div className="flex gap-1.5 flex-wrap">
              {CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => insertChip(chip)}
                  className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors font-mono"
                >
                  {chip}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">Any CSV column header also works as a variable — e.g. <code className="font-mono bg-slate-100 px-1 rounded">{"{transport_type}"}</code></p>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              className="min-h-[360px] font-mono text-sm rounded-xl resize-none"
              placeholder={"Hi {name},\n\nI can get your {vehicle} shipped from {pickup} to {delivery} for {price}.\n\nLet me know if you'd like to move forward.\n\nBest regards,"}
            />
          </div>
        </div>

        {/* ── Right: live preview ── */}
        <div className="bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
          {/* Header */}
          <div className="h-12 border-b border-slate-100 bg-slate-50/60 px-5 flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-400" />
            <h3 className="font-semibold text-slate-700 text-sm">Live Preview</h3>
            <span className="ml-auto text-xs text-slate-400">Updates as you type</span>
          </div>

          <div className="p-6 flex-1 space-y-6 bg-white min-h-[300px]">
            {/* Sample data notice */}
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
              <span className="font-medium">Sample data:</span>
              <span className="text-blue-600">Alex Johnson · Tesla Model Y · Miami → Seattle</span>
            </div>

            {subject ? (
              <div>
                <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1.5">Subject</div>
                <div className="font-semibold text-slate-900 text-sm">{previewSubject}</div>
              </div>
            ) : (
              <div className="text-xs text-slate-300 italic">Add a subject line…</div>
            )}

            {body ? (
              <div>
                <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1.5">Body</div>
                <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 rounded-xl p-4 border border-slate-100">
                  {previewBody}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-300 italic">Add body text…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

