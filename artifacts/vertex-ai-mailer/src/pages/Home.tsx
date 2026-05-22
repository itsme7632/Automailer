import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { Zap, ArrowRight, Upload, Sparkles, Send, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/30">
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-primary tracking-tight">
            <Zap className="h-6 w-6" />
            <span>Vertex Mailer</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="pt-32 pb-20 md:pt-48 md:pb-32 px-6 relative">
          {/* Background glows */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
          
          <div className="container mx-auto max-w-5xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
                <Sparkles className="h-4 w-4" />
                <span>AI-Powered Vehicle Shipping Outreach</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]">
                Turn lead sheets into <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
                  ready-to-send drafts.
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
                The purpose-built outreach cockpit for auto transport brokers. Upload your CSVs, generate hyper-personalized emails with Vertex AI, and sync them directly to Gmail.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" className="h-14 px-8 text-base font-medium w-full sm:w-auto group" asChild>
                  <Link href="/register">
                    Start Generating
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-8 text-base font-medium w-full sm:w-auto" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
              </div>
            </motion.div>

            {/* Dashboard Preview Mockup */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-20 relative mx-auto max-w-4xl"
            >
              <div className="rounded-xl border border-border/50 bg-card shadow-2xl overflow-hidden backdrop-blur-sm">
                <div className="h-12 border-b border-border/50 flex items-center px-4 gap-2 bg-muted/30">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                  </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="col-span-1 space-y-4">
                    <div className="h-20 rounded border border-border/50 bg-background/50 flex flex-col justify-center px-4">
                      <div className="h-2 w-1/3 bg-muted rounded mb-3" />
                      <div className="h-4 w-2/3 bg-primary/40 rounded" />
                    </div>
                    <div className="h-20 rounded border border-border/50 bg-background/50 flex flex-col justify-center px-4">
                      <div className="h-2 w-1/3 bg-muted rounded mb-3" />
                      <div className="h-4 w-1/2 bg-blue-500/40 rounded" />
                    </div>
                    <div className="h-32 rounded border border-border/50 bg-background/50" />
                  </div>
                  <div className="col-span-2 space-y-4">
                    <div className="h-12 rounded border border-border/50 bg-background/50" />
                    <div className="h-48 rounded border border-border/50 bg-background/50 flex flex-col p-4 gap-3">
                      <div className="h-3 w-full bg-muted rounded" />
                      <div className="h-3 w-full bg-muted rounded" />
                      <div className="h-3 w-3/4 bg-muted rounded" />
                      <div className="h-3 w-5/6 bg-muted rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-24 bg-muted/20 border-y border-border/40">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">The Outreach Machine</h2>
              <p className="text-muted-foreground text-lg">Stop copying and pasting templates. Build a scalable pipeline that sounds like you wrote every email by hand.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  icon: <Upload className="h-6 w-6" />,
                  title: "1. Upload Leads",
                  desc: "Drop your CSV or XLSX. We automatically parse columns for names, vehicles, routes, and pricing."
                },
                {
                  icon: <Sparkles className="h-6 w-6" />,
                  title: "2. Generate with AI",
                  desc: "Vertex AI crafts highly specific, context-aware emails using your templates and preferred tone."
                },
                {
                  icon: <Send className="h-6 w-6" />,
                  title: "3. Sync to Gmail",
                  desc: "Review drafts right in your Gmail account. Just hit send when you're ready to close the deal."
                }
              ].map((step, i) => (
                <div key={i} className="p-8 rounded-xl border border-border/50 bg-card hover:bg-muted/10 transition-colors">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-6">
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-border/40 bg-background text-center text-muted-foreground">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground">Vertex Mailer</span>
        </div>
        <p className="text-sm">Engineered for vehicle shipping brokers.</p>
      </footer>
    </div>
  );
}