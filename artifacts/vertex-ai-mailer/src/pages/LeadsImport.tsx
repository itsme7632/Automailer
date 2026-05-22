import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useBulkImportLeads, useGetCampaigns } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, File, Loader2, CheckCircle2 } from "lucide-react";
import { ParsedFileResult } from "@workspace/api-client-react";

export default function LeadsImport() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [parseResult, setParseResult] = useState<ParsedFileResult | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("none");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: campaigns } = useGetCampaigns({ limit: 50 });
  const importLeads = useBulkImportLeads();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    await uploadAndParseFile(selectedFile);
  };

  const uploadAndParseFile = async (fileToUpload: File) => {
    setIsUploading(true);
    setParseResult(null);
    
    try {
      const formData = new FormData();
      formData.append("file", fileToUpload);
      
      const token = localStorage.getItem("auth_token");
      
      const response = await fetch("/api/uploads/parse", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Failed to parse file");
      }
      
      const data = await response.json();
      setParseResult(data);
      
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: err.message
      });
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleImport = () => {
    if (!parseResult || parseResult.validRows === 0) return;
    
    const leads = parseResult.rows
      .filter(r => r.hasValidEmail && !r.isDuplicate)
      .map(r => ({
        name: r.name || "Unknown",
        email: r.email!,
        vehicle: r.vehicle || undefined,
        route: r.route || undefined,
        pickup: r.pickup || undefined,
        delivery: r.delivery || undefined,
        price: r.price || undefined,
        notes: r.notes || undefined,
      }));
      
    const campaignId = selectedCampaignId !== "none" ? Number(selectedCampaignId) : null;
    
    importLeads.mutate(
      { data: { campaignId, leads } },
      {
        onSuccess: (res) => {
          toast({
            title: "Import Successful",
            description: `Imported ${res.imported} leads. Skipped ${res.skipped}.`
          });
          setLocation(campaignId ? `/campaigns/${campaignId}` : "/leads");
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Import Failed",
            description: err.message
          });
        }
      }
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Import Leads</h2>
        <p className="text-muted-foreground mt-1">Upload a CSV or XLSX file containing your vehicle shipping leads.</p>
      </div>

      <Card>
        <CardContent className="p-6">
          {!file && !isUploading && (
            <div 
              className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors bg-muted/20"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">Click to upload or drag and drop</h3>
              <p className="text-sm text-muted-foreground">CSV or XLSX (max 5MB)</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".csv, .xlsx, .xls"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {isUploading && (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Parsing file columns...</p>
            </div>
          )}

          {parseResult && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border border-border">
                <File className="h-8 w-8 text-primary" />
                <div className="flex-1">
                  <h4 className="font-medium">{file?.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {parseResult.totalRows} rows found
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setFile(null); setParseResult(null); }}>
                  Remove
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded border border-border bg-card">
                  <div className="text-sm text-muted-foreground">Valid Leads</div>
                  <div className="text-2xl font-bold text-green-500">{parseResult.validRows}</div>
                </div>
                <div className="p-4 rounded border border-border bg-card">
                  <div className="text-sm text-muted-foreground">Missing Email</div>
                  <div className="text-2xl font-bold text-yellow-500">{parseResult.invalidRows}</div>
                </div>
                <div className="p-4 rounded border border-border bg-card">
                  <div className="text-sm text-muted-foreground">Duplicates</div>
                  <div className="text-2xl font-bold text-red-500">{parseResult.duplicateRows}</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Add to Campaign (Optional)</label>
                <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Campaign</SelectItem>
                    {campaigns?.data?.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button onClick={handleImport} disabled={importLeads.isPending || parseResult.validRows === 0}>
                  {importLeads.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Import {parseResult.validRows} Leads
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}