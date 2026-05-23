import { useState } from "react";
import { useGetDrafts } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { UploadCloud } from "lucide-react";

export default function Drafts() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetDrafts({ page, limit: 20 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gmail Drafts</h1>
          <p className="text-slate-500 mt-1 text-sm">All drafts created from your templates. Find them in your Gmail Drafts folder.</p>
        </div>
        <Button asChild className="gap-2 rounded-xl shadow-sm">
          <Link href="/leads/import">
            <UploadCloud className="h-4 w-4" />
            Upload & Send
          </Link>
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70">
              <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</TableHead>
              <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Subject</TableHead>
              <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
              ))
            ) : data?.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-40 text-slate-400">
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm">No drafts created yet.</p>
                    <Button asChild variant="outline" size="sm" className="rounded-xl gap-1.5">
                      <Link href="/leads/import">
                        <UploadCloud className="h-3.5 w-3.5" /> Upload leads to create drafts
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data?.data?.map(draft => (
                <TableRow key={draft.id} className="hover:bg-slate-50/60">
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      draft.status === "success" ? "bg-emerald-50 text-emerald-700" :
                      draft.status === "failed"  ? "bg-red-50 text-red-600" :
                      "bg-amber-50 text-amber-700"
                    }`}>
                      {draft.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900 truncate max-w-md text-sm">{draft.subject}</div>
                    {draft.errorMessage && (
                      <div className="text-xs text-red-500 mt-0.5">{draft.errorMessage}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">{new Date(draft.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => setPage(p => p - 1)}
          className="rounded-lg"
        >
          Previous
        </Button>
        <span className="text-sm text-slate-500">
          Page {data?.page || 1} of {Math.max(1, Math.ceil((data?.total || 0) / 20))}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= Math.ceil((data?.total || 0) / 20)}
          onClick={() => setPage(p => p + 1)}
          className="rounded-lg"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
