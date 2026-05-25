import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import {
  Zap, ArrowRight, Upload, FileText, Send, Sparkles,
  Mail, Shield, LayoutGrid, ScanText, Smartphone, Building2,
  Truck, Users, Globe,
} from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user, setLocation]);

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-hidden selection:bg-blue-100">

      {/* ── Nav ── */}
      <header className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="container mx-auto px-5 h-16 flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight">BrokerMail AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="hidden sm:inline-flex text-slate-600 hover:text-slate-900 text-sm">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild className="rounded-xl shadow-sm text-sm h-9 px-5">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="pt-36 pb-20 px-5 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-blue-50 to-transparent rounded-full blur-3xl -z-10 pointer-events-none opacity-70" />
          <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-violet-50 rounded-full blur-3xl -z-10 pointer-events-none opacity-50" />

          <div className="container mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium mb-7">
                <Zap className="h-3.5 w-3.5" />
                AI-Powered Outreach for Auto Transport
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-5 leading-[1.1] text-slate-900">
                Close more transport deals
                <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-500">
                  {" "}with AI-powered outreach.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-500 max-w-2xl mx-auto mb-8 leading-relaxed px-2">
                Upload lead sheets, personalize emails instantly, and send directly from your own business mailbox using SMTP or Gmail.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
                <Button size="lg" className="h-12 px-7 rounded-xl shadow-md font-medium group w-full sm:w-auto" asChild>
                  <Link href="/register">
                    Start Sending Outreach
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-7 rounded-xl border-slate-200 font-medium text-slate-700 w-full sm:w-auto" asChild>
                  <Link href="/login">View Demo</Link>
                </Button>
              </div>

              <p className="text-xs text-slate-400 font-medium">Built specifically for auto transport brokers.</p>
            </motion.div>

            {/* App mockup */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-16 relative mx-auto max-w-4xl"
            >
              <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80 overflow-hidden">
                <div className="h-10 bg-slate-50 border-b border-slate-100 flex items-center px-4 gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="h-5 w-44 bg-slate-100 rounded-md" />
                  </div>
                </div>
                <div className="flex">
                  <div className="w-40 bg-white border-r border-slate-100 p-3 space-y-1 hidden sm:block">
                    {["Dashboard", "Campaigns", "Upload & Send", "Templates", "Mailbox"].map((item, i) => (
                      <div key={item} className={`h-8 rounded-lg flex items-center px-3 gap-2 ${i === 0 ? "bg-blue-50" : ""}`}>
                        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${i === 0 ? "bg-blue-500" : "bg-slate-200"}`} />
                        <div className={`h-2 rounded-full ${i === 0 ? "bg-blue-300 w-16" : "bg-slate-100 w-14"}`} />
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 p-4 bg-slate-50/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      {["bg-blue-500", "bg-violet-400", "bg-emerald-400", "bg-amber-400"].map((c, i) => (
                        <div key={i} className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                          <div className={`h-6 w-6 rounded-lg ${c} opacity-20 mb-2`} />
                          <div className="h-2 w-12 bg-slate-100 rounded-full mb-1.5" />
                          <div className="h-5 w-8 bg-slate-200 rounded-md" />
                        </div>
                      ))}
                    </div>
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
                      {[80, 60, 90, 45].map((w, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="h-7 w-7 rounded-lg bg-slate-100 flex-shrink-0" />
                          <div className="flex-1 space-y-1.5 min-w-0">
                            <div className="h-2 rounded-full bg-slate-100" style={{ width: `${w}%` }} />
                            <div className="h-1.5 rounded-full bg-slate-50" style={{ width: `${Math.max(w - 20, 10)}%` }} />
                          </div>
                          <div className="h-5 w-14 rounded-full bg-blue-50 flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Provider Compatibility ── */}
        <section className="py-10 px-5 border-y border-slate-100 bg-slate-50">
          <div className="container mx-auto max-w-4xl text-center">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-6">
              Works with your existing business email
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
              {["Gmail", "Outlook", "Hostinger", "GoDaddy", "Zoho", "Namecheap", "Private Mail"].map((provider) => (
                <div
                  key={provider}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-sm font-medium text-slate-700"
                >
                  <Mail className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                  {provider}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="py-24 px-5">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
                Everything you need for bulk outreach
              </h2>
              <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
                From lead import to personalized sending — designed for the auto transport workflow.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  icon: Sparkles,
                  title: "AI Personalization",
                  desc: "Generate personalized outreach emails from CSV or XLSX lead sheets.",
                  color: "bg-violet-50 text-violet-600",
                },
                {
                  icon: Shield,
                  title: "SMTP + IMAP Support",
                  desc: "Connect Hostinger, GoDaddy, Zoho, Outlook, Gmail, or private mail.",
                  color: "bg-blue-50 text-blue-600",
                },
                {
                  icon: Globe,
                  title: "White-Label Branding",
                  desc: "Use your own company name, signature, and branding.",
                  color: "bg-emerald-50 text-emerald-600",
                },
                {
                  icon: LayoutGrid,
                  title: "Bulk Outreach Control",
                  desc: "Send campaigns in batches like 100, 500, or full lead lists.",
                  color: "bg-amber-50 text-amber-600",
                },
                {
                  icon: ScanText,
                  title: "Auto Column Detection",
                  desc: "Automatically detect name, vehicle, route, and pricing columns.",
                  color: "bg-pink-50 text-pink-600",
                },
                {
                  icon: Smartphone,
                  title: "Mobile Friendly",
                  desc: "Manage campaigns and outreach directly from your phone.",
                  color: "bg-cyan-50 text-cyan-600",
                },
              ].map((feat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07, duration: 0.4 }}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-4 ${feat.color}`}>
                    <feat.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1.5">{feat.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{feat.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="py-24 px-5 bg-slate-50 border-y border-slate-100">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">How it works</h2>
              <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
                From spreadsheet to personalized outreach in under 60 seconds.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  icon: FileText,
                  step: "01",
                  title: "Write your template",
                  desc: "Create an email with variables like {name}, {vehicle}, {pickup}. Any CSV column header becomes a variable.",
                  color: "bg-blue-50 text-blue-600",
                },
                {
                  icon: Upload,
                  step: "02",
                  title: "Upload your leads",
                  desc: "Drop your CSV or XLSX file. Columns are auto-detected and mapped to template variables instantly.",
                  color: "bg-violet-50 text-violet-600",
                },
                {
                  icon: Send,
                  step: "03",
                  title: "Send direct outreach",
                  desc: "Emails send from your own SMTP mailbox or land in Gmail drafts — reviewed and delivered on your terms.",
                  color: "bg-emerald-50 text-emerald-600",
                },
              ].map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="bg-white rounded-2xl border border-slate-200 p-7 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${step.color}`}>
                      <step.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-300 tracking-widest">{step.step}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Built For ── */}
        <section className="py-24 px-5">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
                Built for the Auto Transport Industry
              </h2>
              <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
                Designed around how vehicle shipping teams actually work.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Truck, label: "Auto Transport Brokers" },
                { icon: Users, label: "Dispatch Teams" },
                { icon: Building2, label: "Vehicle Shipping Companies" },
                { icon: LayoutGrid, label: "Lead Generation Teams" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col items-center text-center gap-4 hover:shadow-md transition-shadow"
                >
                  <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                    <item.icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800 leading-snug">{item.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="py-24 px-5 bg-slate-50 border-t border-slate-100">
          <div className="container mx-auto max-w-2xl text-center">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 mx-auto mb-6 flex items-center justify-center shadow-md">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Upload your first lead sheet in under 60 seconds.
            </h2>
            <p className="text-slate-500 mb-8 leading-relaxed text-sm sm:text-base px-2">
              No complicated setup. Connect your mailbox, upload your leads, and start sending personalized outreach today.
            </p>
            <Button size="lg" className="h-12 px-10 rounded-xl shadow-md font-medium w-full sm:w-auto" asChild>
              <Link href="/register">Start Sending Emails</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="py-10 border-t border-slate-100 bg-white">
        <div className="container mx-auto px-5 max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-slate-900 text-sm">BrokerMail AI</span>
          </div>
          <p className="text-xs text-slate-400">Built for the auto transport industry.</p>
        </div>
      </footer>
    </div>
  );
}
