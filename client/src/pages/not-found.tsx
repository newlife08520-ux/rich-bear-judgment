import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-slate-200 bg-white shadow-md dark:border-border dark:bg-card">
        <CardContent className="pt-6 pb-6">
          <div className="flex mb-4 gap-3 items-start">
            <AlertCircle className="h-8 w-8 text-indigo-600 shrink-0 dark:text-indigo-400" />
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-foreground">頁面不存在</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-muted-foreground leading-relaxed">
                找不到您要的頁面，請確認網址或返回首頁。
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-indigo-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-indigo-700 transition-colors dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            返回首頁
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
