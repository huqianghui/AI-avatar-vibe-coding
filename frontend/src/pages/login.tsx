import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Checkbox,
} from "@/components/ui";
import { useLogin } from "@/hooks/use-auth";

export default function LoginPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const loginMutation = useLogin();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { username, password },
      {
        onSuccess: (user) => {
          if (user.role === "admin") {
            navigate("/admin/dashboard");
          } else {
            navigate("/");
          }
        },
      }
    );
  };

  return (
    <Card className="w-full max-w-[480px] rounded-2xl bg-card shadow-xl">
      <CardHeader className="items-center space-y-2 p-8 pb-4">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground transition-colors duration-150">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
        </div>
        <CardTitle className="text-2xl font-medium text-foreground">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="p-8 pt-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">{t("email")}</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              disabled={loginMutation.isPending}
              placeholder={t("emailPlaceholder")}
              className="transition-colors duration-150"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loginMutation.isPending}
                className="pr-10 transition-colors duration-150"
                placeholder={t("passwordPlaceholder")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 transition-colors duration-150 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? t("ariaHidePassword") : t("ariaShowPassword")}
              >
                {showPassword ? (
                  <EyeOff className="size-4 text-muted-foreground" />
                ) : (
                  <Eye className="size-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            <Label htmlFor="remember" className="text-sm font-normal">
              {t("rememberMe")}
            </Label>
          </div>

          {loginMutation.isError && (
            <p className="text-sm text-destructive">{t("loginFailed")}</p>
          )}

          <Button
            type="submit"
            className="w-full transition-colors duration-150"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("signingIn")}
              </>
            ) : (
              t("signIn")
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
