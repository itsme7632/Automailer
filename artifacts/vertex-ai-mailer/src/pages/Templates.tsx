import { useState } from "react";
import { Link } from "wouter";
import { useGetTemplates, useCreateTemplate } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Loader2, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetTemplatesQueryKey } from "@workspace/api-client-react";

export default function Templates() {
  const { data: templates, isLoading } = useGetTemplates();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTemplate = useCreateTemplate();

  const handleCreate = () => {
    if (!newTemplateName.trim()) return;
    
    createTemplate.mutate(
      { 
        data: { 
          name: newTemplateName,
          subject: "Shipping Quote for your {vehicle}",
          body: "Hi {name},\n\nI can get your {vehicle} shipped from {pickup} to {delivery} for {price}.\n\nLet me know if you want to proceed."
        } 
      },
      {
        onSuccess: () => {
          toast({ title: "Template created" });
          setIsCreateOpen(false);
          setNewTemplateName("");
          queryClient.invalidateQueries({ queryKey: getGetTemplatesQueryKey() });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Error", description: err.message });
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Email Templates</h2>
          <p className="text-muted-foreground mt-1">Base templates that AI uses to generate personalized drafts.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Template</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Template Name</label>
                <Input 
                  placeholder="e.g. Standard Cold Outreach" 
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createTemplate.isPending || !newTemplateName.trim()}>
                {createTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
              <CardContent><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
          ))
        ) : templates?.length === 0 ? (
          <div className="col-span-full p-12 text-center border border-dashed rounded-lg">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No templates found</h3>
            <p className="text-muted-foreground">Create your first template to start generating drafts.</p>
          </div>
        ) : (
          templates?.map(template => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="truncate">{template.name}</CardTitle>
                <CardDescription className="truncate">Subject: {template.subject}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded border line-clamp-4 font-mono">
                  {template.body}
                </div>
              </CardContent>
              <CardFooter className="pt-0 justify-between border-t p-4 mt-auto">
                <span className="text-xs text-muted-foreground">
                  Updated {new Date(template.updatedAt).toLocaleDateString()}
                </span>
                <Button variant="ghost" size="sm" asChild className="group">
                  <Link href={`/templates/${template.id}`}>
                    Edit <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}