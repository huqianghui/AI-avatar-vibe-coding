import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  GraduationCap,
  History,
  BarChart,
  Menu,
  Bell,
  LogOut,
  Mic,
} from "lucide-react";
import {
  Button,
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemePicker } from "@/components/shared/theme-picker";
import { PageTransition } from "@/components/shared/page-transition";
import { useAuthStore } from "@/stores/auth-store";
import { useLogout } from "@/hooks/use-auth";
import { useConfig } from "@/contexts/config-context";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/user/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { path: "/user/training", labelKey: "training", icon: GraduationCap },
  { path: "/user/history", labelKey: "history", icon: History },
  { path: "/user/reports", labelKey: "reports", icon: BarChart },
] as const;

export function UserLayout() {
  const { t } = useTranslation("nav");
  const { t: tCommon } = useTranslation("common");
  const { user } = useAuthStore();
  const logout = useLogout();
  const { voice_enabled: voiceEnabled, legacy_coach_nav_enabled } = useConfig();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userInitials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top navigation bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center border-b bg-background shadow-sm">
        <div className="flex w-full items-center px-4 lg:px-6">
          {/* Mobile hamburger */}
          {legacy_coach_nav_enabled && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
          )}

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
            </div>
            <span className="hidden font-semibold sm:inline">AI Coach</span>
          </div>

          {/* Desktop nav links */}
          {legacy_coach_nav_enabled && (
            <nav className="ml-8 hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "relative flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-150",
                      isActive
                        ? "text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <item.icon className="size-4" />
                    {t(item.labelKey)}
                    {item.labelKey === "training" && voiceEnabled && (
                      <Mic className="size-3 text-success-600" />
                    )}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                    )}
                  </NavLink>
                );
              })}
            </nav>
          )}

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            <ThemePicker />
            <LanguageSwitcher />
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="size-5" />
            </Button>

            {/* User avatar dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 px-2"
                >
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm md:inline">
                    {user?.full_name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>{tCommon("profile")}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="size-4" />
                  {tCommon("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile navigation sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64">
          <SheetHeader>
            <SheetTitle>AI Coach</SheetTitle>
          </SheetHeader>
          {legacy_coach_nav_enabled && (
            <nav className="mt-4 flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <item.icon className="size-5" />
                    {t(item.labelKey)}
                  </NavLink>
                );
              })}
            </nav>
          )}
        </SheetContent>
      </Sheet>

      {/* Page content */}
      <main className="flex-1 bg-muted p-4 lg:p-6">
        <PageTransition />
      </main>

      {/* Footer */}
      <footer className="border-t bg-background py-3 text-center text-xs text-muted-foreground">
        2026 AI Coach Platform
      </footer>
    </div>
  );
}
