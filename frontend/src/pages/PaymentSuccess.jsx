import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { paymentStatus } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function PaymentSuccess() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState("pending");
  const timer = useRef(null);
  const tries = useRef(0);

  useEffect(() => {
    const sid = new URLSearchParams(loc.search).get("session_id");
    if (!sid) return;
    const poll = async () => {
      try {
        const r = await paymentStatus(sid);
        setStatus(r.payment_status);
        if (r.payment_status === "paid" || tries.current > 10) return;
      } catch {}
      tries.current += 1;
      timer.current = setTimeout(poll, 2000);
    };
    poll();
    return () => timer.current && clearTimeout(timer.current);
  }, [loc.search]);

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-rose-50 to-pink-50 p-6">
      <Card className="max-w-lg w-full rounded-2xl">
        <CardContent className="p-8 text-center" data-testid="payment-success-view">
          {status === "paid" ? (
            <>
              <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto"/>
              <h1 className="mt-4 text-3xl font-extrabold text-slate-900">Welcome to Pro</h1>
              <p className="mt-2 text-slate-600">Unlimited mocks, coaching, and program prep unlocked.</p>
              <Button data-testid="open-dashboard-after-pay" onClick={() => navigate("/dashboard")} className="mt-6 rounded-full bg-gradient-to-r from-rose-600 to-pink-600">Open dashboard</Button>
            </>
          ) : (
            <>
              <Loader2 className="w-10 h-10 text-rose-600 mx-auto animate-spin"/>
              <p className="mt-4 text-slate-700">Confirming your subscription…</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
