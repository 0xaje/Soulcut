import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4 dark:bg-[#060608]">
      <Card className="w-full max-w-lg mx-4 shadow-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#101014]">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-red-100 rounded-full animate-pulse dark:bg-red-900/30" />
              <AlertCircle className="relative h-16 w-16 text-red-500" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-slate-900 mb-2 dark:text-white">404</h1>

          <h2 className="text-xl font-semibold text-slate-700 mb-4 dark:text-white/80">
            Page Not Found
          </h2>

          <p className="text-slate-600 mb-8 leading-relaxed dark:text-white/60">
            Sorry, the page you are looking for doesn't exist.
            <br />
            It may have been moved or deleted.
          </p>

          <div
            id="not-found-button-group"
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              onClick={handleGoHome}
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-full transition-all duration-200 shadow-md hover:shadow-lg dark:bg-[#e9ffe2] dark:text-[#111710] dark:hover:bg-[#c7ff4b]"
            >
              <Home className="w-4 h-4 mr-2" />
              Back to SoulCut
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
