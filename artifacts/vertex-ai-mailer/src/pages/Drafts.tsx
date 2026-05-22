import { useState } from "react";
import { useGetDrafts } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function Drafts() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetDrafts({ page, limit: 10 });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Drafts</h2>
        <p className="text-muted-foreground mt-1">History of all AI-generated email drafts.</p>
      </div>

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Created</TableHead>
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
                <TableCell colSpan={3} className="text-center h-32 text-muted-foreground">
                  No drafts generated yet.
                </TableCell>
              </TableRow>
            ) : (
              data?.data?.map(draft => (
                <TableRow key={draft.id}>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      draft.status === 'success' ? 'bg-green-500/10 text-green-500' : 
                      draft.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                      'bg-yellow-500/10 text-yellow-500'
                    }`}>
                      {draft.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium truncate max-w-md">{draft.subject}</div>
                    {draft.errorMessage && <div className="text-xs text-red-500 mt-1">{draft.errorMessage}</div>}
                  </TableCell>
                  <TableCell>{new Date(draft.createdAt).toLocaleDateString()}</TableCell>
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
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {data?.page || 1} of {Math.ceil((data?.total || 0) / 10) || 1}
        </span>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={page >= Math.ceil((data?.total || 0) / 10)}
          onClick={() => setPage(p => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}