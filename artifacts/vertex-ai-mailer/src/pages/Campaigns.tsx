import { useState } from "react";
import { Link } from "wouter";
import { useGetCampaigns, useCreateCampaign, getGetCampaignsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Mail, Loader2 } from "lucide-react";

export default function Campaigns() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetCampaigns({ page, limit: 10 });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createCampaign = useCreateCampaign();

  const handleCreate = async () => {
    if (!newCampaignName.trim()) return;
    
    createCampaign.mutate({ data: { name: newCampaignName } }, {
      onSuccess: () => {
        toast({ title: "Campaign created" });
        setIsCreateOpen(false);
        setNewCampaignName("");
        queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey() });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Error", description: err.message });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Campaigns</h2>
          <p className="text-muted-foreground mt-1">Manage your email outreach campaigns.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Campaign Name</label>
                <Input 
                  placeholder="e.g. Q3 Dealership Outreach" 
                  value={newCampaignName}
                  onChange={e => setNewCampaignName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createCampaign.isPending || !newCampaignName.trim()}>
                {createCampaign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search campaigns..." className="pl-9" />
        </div>
      </div>

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Leads</TableHead>
              <TableHead>Drafted</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : data?.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                  No campaigns found.
                </TableCell>
              </TableRow>
            ) : (
              data?.data?.map(campaign => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">
                    <Link href={`/campaigns/${campaign.id}`} className="hover:underline">{campaign.name}</Link>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      campaign.status === 'completed' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 
                      campaign.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                      campaign.status === 'failed' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                      'bg-muted text-muted-foreground border border-border'
                    }`}>
                      {campaign.status}
                    </span>
                  </TableCell>
                  <TableCell>{campaign.totalLeads}</TableCell>
                  <TableCell>{campaign.draftedCount}</TableCell>
                  <TableCell>{new Date(campaign.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/campaigns/${campaign.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}