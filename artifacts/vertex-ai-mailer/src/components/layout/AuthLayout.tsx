import { ReactNode } from "react";
import { Link } from "wouter";
import { Zap } from "lucide-react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="flex flex-col justify-center items-center p-8 lg:p-12 z-10 relative">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex items-center gap-2 text-primary font-bold text-2xl tracking-tight mb-8">
            <Zap className="h-6 w-6" />
            <span>Vertex Mailer</span>
          </div>
          {children}
        </div>
      </div>
      
      <div className="hidden lg:flex relative overflow-hidden bg-card border-l border-border flex-col justify-between p-12">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-background to-background opacity-50" />
          <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent opacity-50" />
        </div>
        
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-lg mx-auto">
          <h2 className="text-4xl font-bold tracking-tight text-foreground mb-6">
            Scale your outreach.<br />
            Close more transport deals.
          </h2>
          <p className="text-lg text-muted-foreground mb-12 leading-relaxed">
            The purpose-built outreach machine for vehicle shipping brokers. 
            Turn raw lead sheets into highly personalized, ready-to-send Gmail drafts in minutes.
          </p>
          
          <div className="space-y-6">
            {[
              "Import thousands of leads from CSV or XLSX",
              "Generate hyper-personalized emails via Vertex AI",
              "Sync directly to your Gmail drafts folder",
              "Command center for daily campaign tracking"
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-background/50 border border-border/50 backdrop-blur-sm">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                  {i + 1}
                </div>
                <span className="font-medium text-foreground/90">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}