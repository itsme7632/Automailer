import { useState } from "react";
import { Link } from "wouter";
import { useGetCampaigns, useCreateCampaign, getGetCampaignsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Mail, Loader2, Inbox } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    pending:   "bg-amber-50   text-amber-700   ring-amber-200",
    active:    "bg-blue-50    text-blue-700    ring-blue-200",
    failed:    "bg-red-50     text-red-700     ring-red-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${map[status] ?? "bg-slate-50 text-slate-600 ring-slate-200"}`}>
      {status}
    </span>
  );
}

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
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage your email outreach campaigns.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl shadow-sm">
              <Plus className="h-4 w-4" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>New Campaign</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Campaign Name</label>
                <Input
                  placeholder="e.g. Q3 Dealership Outreach"
                  value={newCampaignName}
                  onChange={e => setNewCampaignName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
                  className="rounded-xl border-slate-200"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleCreate} disabled={createCampaign.isPending || !newCampaignName.trim()} className="rounded-xl">
                {createCampaign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Campaign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search campaigns…"
          className="pl-9 rounded-xl border-slate-200 bg-white h-10"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1fr_80px_80px_1fr_80px] gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>Name</span>
          <span>Status</span>
          <span>Leads</span>
          <span>Drafted</span>
          <span>Created</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading ? (
          <div className="divide-y divide-slate-50">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_80px_80px_1fr_80px] gap-4 px-6 py-4 items-center">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-14 ml-auto rounded-lg" />
              </div>
            ))}
          </div>
        ) : !data?.data?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Inbox className="h-12 w-12 mb-3 opacity-30" />
            <p className="font-medium text-slate-500 text-sm">No campaigns yet</p>
            <p className="text-xs mt-1 mb-4">Create your first campaign to get started.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="rounded-xl gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> New Campaign
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {data.data.map(campaign => (
              <div
                key={campaign.id}
                className="grid grid-cols-[2fr_1fr_80px_80px_1fr_80px] gap-4 px-6 py-4 items-center hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <Link
                    href={`/campaigns/${campaign.id}`}
                    className="font-medium text-slate-900 hover:text-blue-600 transition-colors truncate text-sm"
                  >
                    {campaign.name}
                  </Link>
                </div>
                <StatusBadge status={campaign.status} />
                <span className="text-sm text-slate-600">{campaign.totalLeads}</span>
                <span className="text-sm text-slate-600">{campaign.draftedCount}</span>
                <span className="text-xs text-slate-400">{new Date(campaign.createdAt).toLocaleDateString()}</span>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg h-8"
                  >
                    <Link href={`/campaigns/${campaign.id}`}>Open →</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {(data?.total ?? 0) > 10 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, data?.total ?? 0)} of {data?.total} campaigns
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg"
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page * 10 >= (data?.total ?? 0)}
                className="rounded-lg"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
