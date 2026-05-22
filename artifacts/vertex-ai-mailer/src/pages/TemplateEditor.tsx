import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, Link } from "wouter";
import { 
  useGetTemplate, 
  useUpdateTemplate, 
  getGetTemplateQueryKey,
  usePreviewEmail
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Play, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PreviewEmailInputTone } from "@workspace/api-client-react";

const CHIPS = ["{name}", "{vehicle}", "{route}", "{pickup}", "{delivery}", "{price}"];

export default function TemplateEditor() {
  const [, params] = useRoute("/templates/:id");
  const templateId = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: template, isLoading } = useGetTemplate(templateId, {
    query: { enabled: !!templateId, queryKey: getGetTemplateQueryKey(templateId) }
  });

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [previewTone, setPreviewTone] = useState<PreviewEmailInputTone>("professional");
  
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
        }
      }
    );
  };

  const [previewData, setPreviewData] = useState<{subject: string, body: string} | null>(null);

  const handlePreview = () => {
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
            price: "$1,250"
          }
        }
      },
      {
        onSuccess: (data) => {
          setPreviewData(data);
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Preview failed", description: err.message });
        }
      }
    );
  };

  const insertChip = (chip: string) => {
    setBody(prev => prev + chip);
  };

  if (isLoading) {
    return <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>;
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
          {updateTemplate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
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
              <div className="flex gap-2">
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

        <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          <div className="h-14 border-b border-border bg-muted/20 px-4 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Play className="h-4 w-4" /> AI Preview
            </h3>
            <div className="flex items-center gap-2">
              <Select value={previewTone} onValueChange={(v) => setPreviewTone(v as PreviewEmailInputTone)}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="secondary" onClick={handlePreview} disabled={previewEmail.isPending}>
                {previewEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run Test"}
              </Button>
            </div>
          </div>
          
          <div className="p-6 flex-1 bg-background/50">
            {previewEmail.isPending ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : previewData ? (
              <div className="space-y-6">
                <div>
                  <div className="text-xs text-muted-foreground mb-1 uppercase font-semibold tracking-wider">Subject</div>
                  <div className="font-medium">{previewData.subject}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1 uppercase font-semibold tracking-wider">Body</div>
                  <div className="whitespace-pre-wrap text-sm text-foreground/90 font-mono">
                    {previewData.body}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center">
                <Play className="h-12 w-12 mb-4 opacity-20" />
                <p>Click "Run Test" to generate a sample email<br/>using Vertex AI and dummy lead data.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}