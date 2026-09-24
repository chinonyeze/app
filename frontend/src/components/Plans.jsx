import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import { createCheckout } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";

export const PLANS = [
  {
    id: "free",
    lookup: null,
    name: "Free",
    price: "$0",
    cadence: "",
    tagline: "Get a feel for the coach.",
    highlight: false,
    features: ["3 mock questions / week", "Basic question bank", "Limited feedback"],
  },
  {
    id: "essential",
    lookup: "matchprep_essential_monthly",
    name: "Essential",
    price: "$9.99",
    cadence: "/ month",
    tagline: "Practice unlimited, feedback on tap.",
    highlight: false,
    features: ["Unlimited practice", "Answer feedback", "Progress tracking"],
  },
  {
    id: "pro",
    lookup: "matchprep_pro_monthly",
    name: "Pro",
    price: "$19.99",
    cadence: "/ month",
    tagline: "The full residency interview coach.",
    highlight: true,
    trialDays: 7,
    features: [
      "7-day free trial — cancel anytime",
      "Everything in Essential",
      "AI voice mock interviews",
      "Speech & body-language analysis",
      "Personalized CV question bank",
      "Program-specific prep & Why Us",
    ],
  },
  {
    id: "season_pass",
    lookup: "matchprep_season_pass_one_time",
    name: "Interview Season Pass",
    price: "$69",
    cadence: "one-time",
    tagline: "Sept 23 – March 15. Pay once.",
    highlight: false,
    features: ["Full Pro access all season", "No monthly renewals", "Best value for match applicants"],
  },
];

export function PlansGrid({ onSelect, currentPlan, trialUsed }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
      {PLANS.map((p) => {
        const isCurrent = currentPlan === p.id;
        const proTrialAvailable = p.id === "pro" && !trialUsed && currentPlan !== "pro";
        const ctaLabel = isCurrent
          ? "Current plan"
          : !p.lookup
          ? "Included"
          : proTrialAvailable
          ? "Start 7-day free trial"
          : "Choose";
        return (
          <div
            key={p.id}
            data-testid={`plan-card-${p.id}`}
            className={`relative rounded-2xl border p-6 flex flex-col ${p.highlight ? "border-rose-300 bg-gradient-to-br from-white to-rose-50/60 shadow-lg shadow-rose-500/10" : "border-slate-200 bg-white"}`}
          >
            {p.highlight && (
              <span className="absolute -top-3 left-6 text-[10px] uppercase tracking-wider font-semibold bg-rose-600 text-white px-2.5 py-1 rounded-full">Most popular</span>
            )}
            {proTrialAvailable && (
              <span className="absolute -top-3 right-6 text-[10px] uppercase tracking-wider font-semibold bg-emerald-600 text-white px-2.5 py-1 rounded-full">7-day free trial</span>
            )}
            <div className="text-xs uppercase tracking-wider font-semibold text-rose-700">{p.name}</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-display text-3xl font-extrabold text-slate-900">{p.price}</span>
              <span className="text-xs text-slate-500">{p.cadence}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{p.tagline}</p>
            {proTrialAvailable && (
              <p className="mt-2 text-xs text-emerald-700 font-medium">Free for 7 days. Then $19.99/mo. Cancel anytime.</p>
            )}
            <ul className="mt-4 space-y-2 text-sm text-slate-700 flex-1">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0"/>{f}</li>
              ))}
            </ul>
            <Button
              data-testid={`plan-cta-${p.id}`}
              disabled={!p.lookup || isCurrent}
              onClick={() => p.lookup && onSelect(p.lookup)}
              className={`mt-5 rounded-full ${p.highlight ? "bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700" : "bg-slate-900 hover:bg-slate-800"}`}
            >
              {ctaLabel}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export function UpgradeDialog({ open, onOpenChange, currentPlan, trialUsed }) {
  const [busy, setBusy] = useState(false);
  const start = async (lookup) => {
    setBusy(true);
    try {
      const { checkout_url } = await createCheckout(window.location.origin, lookup);
      window.location.href = checkout_url;
    } catch (e) {
      toast.error("Could not open checkout");
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl" data-testid="upgrade-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Choose your MatchPrep plan</DialogTitle>
        </DialogHeader>
        <div className="mt-2"><PlansGrid onSelect={start} currentPlan={currentPlan} trialUsed={trialUsed}/></div>
        {busy && <div className="mt-4 text-sm text-slate-500 text-center">Opening secure checkout…</div>}
      </DialogContent>
    </Dialog>
  );
}
