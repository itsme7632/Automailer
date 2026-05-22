import { useState } from "react";
import { useRoute } from "wouter";
import { 
  useGetCampaign, 
  useGetLeads, 
  useGenerateCampaignDrafts, 
  useGetTemplates,
  getGetCampaignQueryKey,
  getGetLeadsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Play, FileText, ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { GenerateDraftsInputTone } from "@workspace/api-client-react";

export default function CampaignDetail() {
  const [, params] = useRoute("/campaigns/:id");
  const campaignId = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedTone, setSelectedTone] = useState<GenerateDraftsInputTone>("professional");

  const { data: campaign, isLoading: isCampaignLoading } = useGetCampaign(campaignId, {
    query: { enabled: !!campaignId, queryKey: getGetCampaignQueryKey(campaignId) }
  });

  const { data: leadsData, isLoading: isLeadsLoading } = useGetLeads(
    { campaignId, page, limit: 10 },
    { query: { enabled: !!campaignId, queryKey: getGetLeadsQueryKey({ campaignId, page, limit: 10 }) } }
  );

  const { data: templatesData } = useGetTemplates();
  const generateDrafts = useGenerateCampaignDrafts();

  const handleGenerate = () => {
    if (!selectedTemplate) {
      toast({ variant: "destructive", title: "Error", description: "Please select a template" });
      return;
    }

    generateDrafts.mutate(
      { 
        id: campaignId, 
        data: { 
          templateId: Number(selectedTemplate), 
          tone: selectedTone 
        } 
      },
      {
        onSuccess: () => {
          toast({ title: "Draft generation started" });
          setIsGenerateOpen(false);
          queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
          queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey({ campaignId, page, limit: 10 }) });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Generation failed", description: err.message });
        }
      }
    );
  };

  if (isCampaignLoading) {
    return <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>;
  }

  if (!campaign) {
    return <div>Campaign not found</div>;
  }

  const progress = campaign.totalLeads > 0 
    ? Math.round((campaign.draftedCount / campaign.totalLeads) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/campaigns" className="hover:text-primary flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </Link>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{campaign.name}</h2>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              campaign.status === 'completed' ? 'bg-green-500/10 text-green-500' : 
              campaign.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
              campaign.status === 'failed' ? 'bg-red-500/10 text-red-500' :
              'bg-muted text-muted-foreground'
            }`}>
              {campaign.status}
            </span>
            <span>•</span>
            <span>Created {new Date(campaign.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="https://mail.google.com/mail/u/0/#drafts" target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Gmail
            </a>
          </Button>
          
          <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Play className="mr-2 h-4 w-4" />
                Generate Drafts
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Gmail Drafts</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Template</label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templatesData?.map(t => (
                        <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tone</label>
                  <Select value={selectedTone} onValueChange={(val) => setSelectedTone(val as GenerateDraftsInputTone)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="followup">Follow-up</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsGenerateOpen(false)}>Cancel</Button>
                <Button onClick={handleGenerate} disabled={generateDrafts.isPending || !selectedTemplate}>
                  {generateDrafts.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Start Generation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.totalLeads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Drafted Successfully</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{campaign.draftedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{campaign.failedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLeadsLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : leadsData?.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No leads in this campaign. <Link href="/leads/import" className="text-primary hover:underline">Import some leads.</Link>
                  </TableCell>
                </TableRow>
              ) : (
                leadsData?.data?.map(lead => (
                  <TableRow key={lead.id}>
                    <TableCell>{lead.name}</TableCell>
                    <TableCell>{lead.email}</TableCell>
                    <TableCell>{lead.vehicle || "-"}</TableCell>
                    <TableCell>
                      {lead.pickup && lead.delivery ? `${lead.pickup} → ${lead.delivery}` : (lead.route || "-")}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        lead.status === 'drafted' ? 'bg-green-500/10 text-green-500' : 
                        lead.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {lead.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          <div className="flex items-center justify-between mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {leadsData?.page || 1} of {Math.ceil((leadsData?.total || 0) / 10) || 1}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page >= Math.ceil((leadsData?.total || 0) / 10)}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}