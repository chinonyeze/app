import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, Calendar, Target, TrendingUp, Play, BookOpen, Building2 } from "lucide-react";
import { progressSummary, getProfile } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

function Ring({ value = 0 }) {
  const r = 46, c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
      <circle cx="60" cy="60" r={r} stroke="#FCE7F3" strokeWidth="10" fill="none"/>
      <circle cx="60" cy="60" r={r} stroke="url(#g)" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset 800ms" }}/>
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#E11D48"/><stop offset="100%" stopColor="#EC4899"/></linearGradient></defs>
    </svg>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [profile, setProfile] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    progressSummary().then(setSummary).catch(() => {});
    getProfile().then(setProfile).catch(() => {});
  }, []);

  const days = summary?.streak_days || 0;
  const overall = summary?.overall_readiness || 0;
  const interviewDate = profile?.interview_date;
  const daysToInterview = interviewDate ? Math.max(0, Math.ceil((new Date(interviewDate) - new Date()) / (1000*60*60*24))) : null;

  return (
    <div className="space-y-8" data-testid="dashboard-view">
      <div className="flex items-end justify-between flex-wrap gap-4 fade-in-up">
        <div>
          <div className="text-xs uppercase tracking-wider text-rose-700 font-semibold">Welcome back</div>
          <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Hi {user?.name?.split(" ")[0]},</h1>
          <p className="mt-2 text-slate-600 max-w-lg">Today's 5-minute drill keeps your streak alive and sharpens your weakest area.</p>
        </div>
        <Button data-testid="dashboard-start-mock" onClick={() => navigate("/practice")} className="rounded-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-md shadow-rose-500/20">
          <Play className="w-4 h-4 mr-2"/> Start a mock interview
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-5 stagger">
        <Card className="rounded-2xl border-rose-100/70 hover-lift" data-testid="card-countdown">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-rose-700 font-semibold"><Calendar className="w-3.5 h-3.5"/> Interview countdown</div>
            <div className="mt-3 font-display text-4xl font-extrabold text-slate-900">{daysToInterview !== null ? `${daysToInterview}` : "—"}</div>
            <div className="text-sm text-slate-500">{daysToInterview !== null ? "days to go" : "Set your date in My Story"}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-rose-100/70 hover-lift" data-testid="card-streak">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-rose-700 font-semibold"><Flame className="w-3.5 h-3.5"/> Streak</div>
            <div className="mt-3 font-display text-4xl font-extrabold text-slate-900">{days}</div>
            <div className="text-sm text-slate-500">days practicing</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-rose-100/70 hover-lift" data-testid="card-readiness">
          <CardContent className="p-6 flex items-center gap-4">
            <Ring value={overall}/>
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-rose-700 font-semibold"><Target className="w-3.5 h-3.5"/> Readiness</div>
              <div className="mt-1 font-display text-3xl font-extrabold text-slate-900">{overall}%</div>
              <div className="text-xs text-slate-500">Overall interview readiness</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Card className="rounded-2xl border-rose-100/70" data-testid="card-today-practice">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-rose-700 font-semibold">Today's 5-minute practice</div>
                <h3 className="mt-2 font-display font-bold text-xl text-slate-900">Warm PD · Behavioral</h3>
                <p className="mt-1 text-sm text-slate-600">3 questions · natural follow-ups · SARR scoring.</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 grid place-items-center"><BookOpen className="w-5 h-5"/></div>
            </div>
            <Button data-testid="today-practice-start" onClick={() => navigate("/practice")} className="mt-5 rounded-full bg-slate-900 hover:bg-slate-800 text-white">Begin drill</Button>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-rose-100/70" data-testid="card-weakest">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-rose-700 font-semibold">Biggest opportunity</div>
                <h3 className="mt-2 font-display font-bold text-xl text-slate-900 capitalize">{(summary?.weakest || "content").replaceAll("_"," ")}</h3>
                <p className="mt-1 text-sm text-slate-600">Focus your next session here for the biggest score jump.</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 grid place-items-center"><TrendingUp className="w-5 h-5"/></div>
            </div>
            <Button data-testid="weakest-open-progress" onClick={() => navigate("/progress")} variant="outline" className="mt-5 rounded-full border-rose-200">Open progress</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid sm:grid-cols-3 gap-5 stagger">
        <Card className="rounded-2xl border-rose-100/70 hover-lift">
          <CardContent className="p-5">
            <div className="text-2xl font-bold text-slate-900 font-display">{summary?.sessions_count || 0}</div>
            <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Mocks completed</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-rose-100/70 hover-lift">
          <CardContent className="p-5">
            <div className="text-2xl font-bold text-slate-900 font-display">{summary?.programs_researched || 0}</div>
            <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Programs researched</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-rose-100/70 hover-lift">
          <CardContent className="p-5">
            <div className="text-2xl font-bold text-slate-900 font-display">{summary?.questions_mastered || 0}</div>
            <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Custom questions</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
