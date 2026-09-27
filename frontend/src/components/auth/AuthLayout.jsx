import { Link } from "react-router-dom";
import { Stethoscope } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function AuthLayout({ title, description, children }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 px-6 py-12">
      <div className="mx-auto max-w-lg">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-xl font-extrabold text-slate-900">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white"><Stethoscope className="h-5 w-5" /></span>
          MatchPrep <span className="text-rose-600">AI</span>
        </Link>
        <Card className="rounded-3xl border-rose-100 shadow-xl shadow-rose-500/5">
          <CardContent className="p-6 sm:p-8">
            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
            <p className="mb-6 mt-2 text-sm text-slate-600">{description}</p>
            {children}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
