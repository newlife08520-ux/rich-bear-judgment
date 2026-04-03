import { useState } from "react";
import { motion } from "framer-motion";
import { Scale, Eye, EyeOff, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("請輸入帳號與密碼");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("401")) setError("帳號或密碼錯誤");
      else if (msg.includes("400")) setError("請輸入有效的帳號與密碼");
      else if (msg.includes("500") || msg.includes("500:")) setError("伺服器錯誤，請稍後再試");
      else if (msg.includes("fetch") || msg.includes("Network") || msg.includes("Failed")) setError("無法連線，請確認服務是否已啟動（npm run dev）");
      else setError("登入失敗，請稍後再試");
    } finally {
      setIsLoading(false);
    }
  };

  const fillCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.06)_0%,_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(245,158,11,0.04)_0%,_transparent_50%)]" />

      <div className="absolute top-20 left-1/3 w-[500px] h-[500px] rounded-full bg-primary/[0.03] blur-[100px]" />
      <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] rounded-full bg-amber-400/[0.04] blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[420px] px-6"
      >
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-5">
            <Scale className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            AI 行銷總監
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            數據戰情室 &middot; 鍊金分析平台
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          <Card className="shadow-lg">
            <CardContent className="pt-6 pb-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm"
                    data-testid="text-login-error"
                  >
                    {error}
                  </motion.div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm text-foreground">
                    帳號
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="輸入帳號"
                    autoComplete="username"
                    data-testid="input-username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm text-foreground">
                    密碼
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="輸入密碼"
                      className="pr-10"
                      autoComplete="current-password"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      tabIndex={-1}
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      驗證中...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      進入戰情室
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-5 rounded-md border border-dashed border-border bg-muted/50 p-4"
        >
          <p className="text-xs text-muted-foreground mb-3 font-medium">
            測試帳號 (點擊快速填入)
          </p>
          <div className="space-y-1.5">
            {[
              { label: "Admin (系統管理員)", u: "admin", p: "admin123" },
              { label: "Manager (行銷總監)", u: "manager", p: "manager123" },
              { label: "User (行銷專員)", u: "user", p: "user123" },
            ].map((acc) => (
              <button
                key={acc.u}
                type="button"
                onClick={() => fillCredentials(acc.u, acc.p)}
                className="w-full text-left text-xs text-muted-foreground py-1.5 px-2 rounded-md hover-elevate active-elevate-2"
                data-testid={`button-fill-${acc.u}`}
              >
                <span className="text-foreground/70 font-medium">{acc.label}</span>
                <span className="float-right font-mono text-muted-foreground">
                  {acc.u} / {acc.p}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
