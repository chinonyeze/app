import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Stethoscope, Mic, Eye, TrendingUp, Brain, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { PlansGrid } from "@/components/Plans";
import { createCheckout } from "@/lib/api";
import { toast } from "sonner";

const features = [
  { icon: Mic, title: "Realistic Voice Mock Interviews", desc: "6 interviewer personalities. AI listens, follows up, probes — never scripted." },
  { icon: Eye, title: "Body Language Coaching", desc: "Eye contact, posture, expression. Coaching signals — not personality verdicts." },
  { icon: Brain, title: "SARR Framework Coach", desc: "Situation → Action → Reflection → Relevance, scored on every answer." },
  { icon: Stethoscope, title: "Know Your Application", desc: "Upload your ERAS story. AI generates the questions interviewers will actually ask." },
  { icon: TrendingUp, title: "Readiness Score", desc: "7 categories, tracked over time. Know your biggest opportunity for growth." },
  { icon: Sparkles, title: "Program-Specific Prep", desc: '"Know This Program" briefings and personalised "Why Us?" answers.' },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const startLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Nav */}
      <header className="sticky top-0 z-40 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2" data-testid="brand-logo">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 grid place-items-center text-white">
              <Stethoscope className="w-5 h-5" />
            </div>
            <span className="font-display font-extrabold text-lg text-slate-900">matchprep<span className="text-rose-600">ai</span></span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#features" className="text-sm text-slate-600 hover:text-slate-900 hidden sm:block">Features</a>
            <a href="#pricing" className="text-sm text-slate-600 hover:text-slate-900 hidden sm:block">Pricing</a>
            {user ? (
              <Button data-testid="nav-open-app" onClick={() => navigate("/dashboard")} className="bg-rose-600 hover:bg-rose-700 rounded-full">Open App <ChevronRight className="w-4 h-4 ml-1"/></Button>
            ) : (
              <Button data-testid="nav-sign-in" onClick={startLogin} className="bg-rose-600 hover:bg-rose-700 rounded-full">Sign in</Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-rose-50/60 via-white to-white" />
        <div className="absolute top-24 -left-32 w-96 h-96 bg-rose-200/40 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 -right-32 w-96 h-96 bg-pink-200/40 rounded-full blur-3xl -z-10" />
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div className="fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50/70 px-4 py-1.5 text-xs font-semibold tracking-wider text-rose-700 uppercase">
              <Sparkles className="w-3.5 h-3.5" /> Built for the match
            </div>
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.05]">
              Walk into every residency interview <span className="text-rose-600">already prepared.</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              Voice-first AI mock interviews with 6 realistic personalities. Body language coaching. SARR framework analysis. Program-specific prep. All in one clinical-grade workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button data-testid="hero-start-cta" onClick={startLogin} size="lg" className="rounded-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-lg shadow-rose-500/25 px-8">
                Start free — upgrade anytime
              </Button>
              <Button data-testid="hero-see-features" variant="outline" size="lg" onClick={() => document.getElementById("features").scrollIntoView({ behavior: "smooth" })} className="rounded-full border-rose-200 text-slate-700">
                See what's inside
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-6 text-xs text-slate-500">
              <span>✓ 6 interviewer personalities</span>
              <span>✓ Voice + video coaching</span>
              <span>✓ Cancel anytime</span>
            </div>
          </div>
          <div className="relative">
            <div className="glass rounded-3xl p-6 shadow-xl shadow-rose-500/10 hover-lift">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-rose-100 grid place-items-center text-rose-700 font-semibold">PD</div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Warm Program Director</div>
                  <div className="text-xs text-slate-500">Live mock — Internal Medicine</div>
                </div>
                <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-medium">02:14</span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-md p-3 text-slate-700">Tell me about a time you disagreed with an attending. Walk me through what you did.</div>
                <div className="bg-rose-50 border border-rose-100 rounded-2xl rounded-tr-md p-3 ml-6 text-slate-800">During my sub-I, an attending recommended a discharge I felt was premature. I reviewed the labs, called the case manager…</div>
                <div className="flex items-center gap-2 text-xs text-rose-600 font-medium pl-1">
                  <span className="wave-bar"/><span className="wave-bar"/><span className="wave-bar"/><span className="wave-bar"/><span className="wave-bar"/>
                  <span className="ml-2">listening…</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wider font-semibold">
                <div className="rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 py-2 text-center">Situation</div>
                <div className="rounded-lg bg-amber-50 text-amber-700 border border-amber-100 py-2 text-center">Action</div>
                <div className="rounded-lg bg-rose-50 text-rose-700 border border-rose-100 py-2 text-center">Reflect</div>
                <div className="rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 py-2 text-center">Relevance</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-16">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold tracking-wider uppercase text-rose-700">Everything in one place</div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">The residency interview toolkit that actually listens.</h2>
        </div>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger">
          {features.map((f) => (
            <Card key={f.title} className="border-rose-100/70 rounded-2xl hover-lift" data-testid={`feature-${f.title.toLowerCase().replace(/\s+/g,'-')}`}>
              <CardContent className="p-6">
                <div className="w-10 h-10 rounded-xl bg-rose-50 grid place-items-center text-rose-600 mb-4">
                  <f.icon className="w-5 h-5"/>
                </div>
                <h3 className="font-display font-semibold text-slate-900 text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-16">
        <div className="max-w-2xl mb-10">
          <div className="text-xs font-semibold tracking-wider uppercase text-rose-700">Pricing</div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">Start free. Go Pro when you're ready.</h2>
          <p className="mt-3 text-slate-600">Interview Season Pass covers you from Sept 23 through Match Day (Mar 15) for one flat price.</p>
        </div>
        <PlansGrid
          onSelect={async (lookup) => {
            if (!user) { startLogin(); return; }
            try {
              const { checkout_url } = await createCheckout(window.location.origin, lookup);
              window.location.href = checkout_url;
            } catch { toast.error("Could not open checkout"); }
          }}
          currentPlan={user?.plan}
        />
      </section>

      <footer className="border-t border-rose-100 py-8 text-center text-xs text-slate-500">
        © matchprepai · Educational coaching only, not clinical advice.
      </footer>
    </div>
  );
}
