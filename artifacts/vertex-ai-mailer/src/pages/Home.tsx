import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { Zap, ArrowRight, Upload, FileText, Send } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user, setLocation]);

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-hidden selection:bg-blue-100">
      {/* Nav */}
      <header className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight">Vertex Mailer</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="hidden sm:inline-flex text-slate-600 hover:text-slate-900">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild className="rounded-xl shadow-sm">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="pt-36 pb-24 px-6 relative overflow-hidden">
          {/* Soft gradient blobs */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-blue-50 to-transparent rounded-full blur-3xl -z-10 pointer-events-none opacity-70" />
          <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-violet-50 rounded-full blur-3xl -z-10 pointer-events-none opacity-60" />

          <div className="container mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium mb-8">
                <Zap className="h-3.5 w-3.5" />
                Gmail Draft Automation for Auto Transport
              </div>

              <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 leading-[1.1] text-slate-900">
                Upload a spreadsheet.
                <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-500">
                  {" "}Create Gmail drafts instantly.
                </span>
              </h1>

              <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
                Write your own email template with dynamic variables, upload your leads CSV,
                and Vertex Mailer creates personalized Gmail drafts — ready to review and send.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button size="lg" className="h-12 px-8 rounded-xl shadow-md font-medium group" asChild>
                  <Link href="/register">
                    Start for free
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-8 rounded-xl border-slate-200 font-medium text-slate-700" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            </motion.div>

            {/* App mockup */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-20 relative mx-auto max-w-4xl"
            >
              <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80 overflow-hidden">
                {/* Browser chrome */}
                <div className="h-11 bg-slate-50 border-b border-slate-100 flex items-center px-4 gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-slate-200" />
                    <div className="w-3 h-3 rounded-full bg-slate-200" />
                    <div className="w-3 h-3 rounded-full bg-slate-200" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="h-5 w-48 bg-slate-100 rounded-md" />
                  </div>
                </div>
                {/* Mock dashboard */}
                <div className="flex">
                  <div className="w-44 bg-white border-r border-slate-100 p-3 space-y-1 hidden sm:block">
                    {["Dashboard", "Campaigns", "Leads", "Templates", "Drafts"].map((item, i) => (
                      <div key={item} className={`h-8 rounded-lg flex items-center px-3 gap-2 ${i === 0 ? "bg-blue-50" : ""}`}>
                        <div className={`h-2 w-2 rounded-full ${i === 0 ? "bg-blue-500" : "bg-slate-200"}`} />
                        <div className={`h-2 rounded-full ${i === 0 ? "bg-blue-300 w-16" : "bg-slate-100 w-14"}`} />
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 p-5 bg-slate-50/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
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
                          <div className="flex-1 space-y-1.5">
                            <div className="h-2 rounded-full bg-slate-100" style={{ width: `${w}%` }} />
                            <div className="h-1.5 rounded-full bg-slate-50" style={{ width: `${w - 20}%` }} />
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

        {/* How it works */}
        <section className="py-24 px-6 bg-slate-50 border-y border-slate-100">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900 mb-3">How it works</h2>
              <p className="text-slate-500 max-w-xl mx-auto">
                Paste your template, upload your spreadsheet, click create. Gmail drafts ready in 60 seconds.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
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
                  title: "Create Gmail drafts",
                  desc: "Variables are replaced with spreadsheet data. Drafts land in your Gmail — never auto-sent.",
                  color: "bg-emerald-50 text-emerald-600",
                },
              ].map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${step.color}`}>
                      <step.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-300 tracking-widest">{step.step}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 px-6">
          <div className="container mx-auto max-w-2xl text-center">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 mx-auto mb-6 flex items-center justify-center shadow-md">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Ready to create drafts in 60 seconds?
            </h2>
            <p className="text-slate-500 mb-8 leading-relaxed">
              Built for auto transport brokers. No AI subscription required — just your template and your spreadsheet.
            </p>
            <Button size="lg" className="h-12 px-10 rounded-xl shadow-md font-medium" asChild>
              <Link href="/register">Get started for free</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="py-10 border-t border-slate-100 bg-white">
        <div className="container mx-auto px-6 max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-slate-900 text-sm">Vertex Mailer</span>
          </div>
          <p className="text-xs text-slate-400">Engineered for vehicle shipping brokers.</p>
        </div>
      </footer>
    </div>
  );
}
