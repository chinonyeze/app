import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Stethoscope, LayoutDashboard, Mic, Building2, LineChart, User, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { UpgradeDialog } from "@/components/Plans";

const tabs = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", tid: "tab-dashboard" },
  { to: "/practice", icon: Mic, label: "Practice", tid: "tab-practice" },
  { to: "/programs", icon: Building2, label: "Programs", tid: "tab-programs" },
  { to: "/progress", icon: LineChart, label: "Progress", tid: "tab-progress" },
  { to: "/my-story", icon: User, label: "My Story", tid: "tab-my-story" },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const showUpgrade = !user?.plan || user.plan === "free";
  const planLabel = { free: "Free plan", essential: "✓ Essential", pro: "✓ Pro member", season_pass: "✓ Season Pass" }[user?.plan || "free"] || "Free plan";

  const upgrade = () => setUpgradeOpen(true);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="p-5 flex items-center gap-2 border-b border-slate-100" data-testid="app-brand">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 grid place-items-center text-white">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display font-extrabold text-slate-900 leading-tight">MatchPrep <span className="text-rose-600">AI</span></div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Residency coach</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              data-testid={t.tid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive ? "bg-rose-50 text-rose-700 border border-rose-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3">
          {showUpgrade && (
            <button data-testid="sidebar-upgrade" onClick={upgrade} className="w-full text-left group rounded-2xl p-4 bg-gradient-to-br from-rose-500 to-pink-600 text-white hover-lift">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold opacity-90">
                <Sparkles className="w-3.5 h-3.5"/> Upgrade
              </div>
              <div className="mt-2 font-display font-bold text-lg leading-tight">{user?.trial_used ? "Unlock unlimited practice" : "Try Pro free for 7 days"}</div>
              <div className="mt-1 text-xs opacity-90">{user?.trial_used ? "From $9.99/month · cancel anytime" : "No charge for 7 days · cancel anytime"}</div>
            </button>
          )}
          <div className="mt-3 flex items-center gap-3 p-3 rounded-xl border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 grid place-items-center text-xs font-semibold">
              {user?.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-800 truncate" data-testid="user-name">{user?.name}</div>
              <div className="text-[11px] text-slate-500 truncate" data-testid="user-plan">{planLabel}</div>
            </div>
            <button data-testid="logout-button" onClick={() => { logout(); navigate("/"); }} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800">
              <LogOut className="w-4 h-4"/>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="lg:hidden sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center gap-2 overflow-x-auto">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} data-testid={`m-${t.tid}`} className={({isActive}) => `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${isActive ? "bg-rose-600 text-white" : "bg-slate-50 text-slate-600"}`}>
              <t.icon className="w-3.5 h-3.5"/>{t.label}
            </NavLink>
          ))}
        </div>
        <div className="p-6 lg:p-10 max-w-6xl">
          <Outlet />
        </div>
      </main>
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} currentPlan={user?.plan} trialUsed={user?.trial_used}/>
    </div>
  );
}
