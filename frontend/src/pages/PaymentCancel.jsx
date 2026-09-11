import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PaymentCancel() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-rose-50 to-pink-50 p-6">
      <Card className="max-w-lg w-full rounded-2xl">
        <CardContent className="p-8 text-center" data-testid="payment-cancel-view">
          <XCircle className="w-14 h-14 text-rose-500 mx-auto"/>
          <h1 className="mt-4 text-3xl font-extrabold text-slate-900">Checkout canceled</h1>
          <p className="mt-2 text-slate-600">No worries — you can subscribe anytime.</p>
          <Button data-testid="back-to-dashboard-cancel" onClick={() => navigate("/dashboard")} className="mt-6 rounded-full">Back to dashboard</Button>
        </CardContent>
      </Card>
    </div>
  );
}
