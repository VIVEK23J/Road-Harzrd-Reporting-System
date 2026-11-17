import { Link, useNavigate } from "@tanstack/react-router";
import { Map, Camera, ListChecks, ShieldCheck, LogIn, LogOut, TriangleAlert, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { PWAInstallButton } from "./PWAInstallButton";

const navCls =
  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-asphalt-foreground/75 hover:text-asphalt-foreground transition-colors";
const activeCls = { className: "!text-primary font-bold" };

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-[1000] bg-asphalt text-asphalt-foreground border-b border-border/20 shadow-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
            <span
              className="grid size-8 place-items-center bg-primary text-primary-foreground shadow"
              style={{ clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)" }}
            >
              <TriangleAlert className="size-4" />
            </span>
            <div className="flex flex-col">
              <span className="leading-tight">RoadWatch</span>
              <span className="text-[9px] font-mono font-normal uppercase text-primary tracking-wider">Tool Portal</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            <Link to="/" className={navCls} activeProps={activeCls} activeOptions={{ exact: true }}>
              <Wrench className="size-4" /> Hazard Tool
            </Link>
            <Link to="/map" className={navCls} activeProps={activeCls}>
              <Map className="size-4" /> Live Map
            </Link>
            {user && (
              <Link to="/my-reports" className={navCls} activeProps={activeCls}>
                <ListChecks className="size-4" /> My Reports
              </Link>
            )}

            {/* Admin tab ONLY shown to verified Real Admin */}
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary/20 text-primary border border-primary/40 rounded hover:bg-primary/30 transition-all ml-2"
                activeProps={{ className: "!bg-primary !text-primary-foreground" }}
              >
                <ShieldCheck className="size-4" /> Admin Console
              </Link>
            )}
          </nav>

          {/* Actions & PWA Install & Auth */}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {/* Direct PWA App Install Button */}
            <PWAInstallButton />

            <Button asChild variant="signal" size="sm" className="hidden sm:inline-flex shadow-sm">
              <Link to="/report">
                <Camera className="size-4 mr-1.5" /> Report Hazard
              </Link>
            </Button>

            {user ? (
              <div className="flex items-center gap-2">
                <span className="hidden lg:inline text-xs font-mono text-asphalt-foreground/75 truncate max-w-[140px]">
                  {user.name}
                </span>
                <button
                  className={`${navCls} text-destructive/90 hover:text-destructive cursor-pointer`}
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  title="Sign out of RoadWatch"
                >
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline text-xs">Sign out</span>
                </button>
              </div>
            ) : (
              <Button asChild variant="ghost" size="sm" className="text-asphalt-foreground hover:bg-white/10">
                <Link to="/auth">
                  <LogIn className="size-4 mr-1.5" /> Sign in
                </Link>
              </Button>
            )}
          </div>
        </div>
        <div className="road-dash h-[3px]" />
      </header>

      <main className="flex-1 pb-20 md:pb-0">{children}</main>

      <footer className="hidden border-t border-border bg-muted/40 md:block">
        <div className="mx-auto flex max-w-7xl justify-between px-4 py-4 text-xs font-mono text-muted-foreground">
          <span>RoadWatch Tool — MongoDB Atlas Powered</span>
          <span>PWA Ready · OpenStreetMap</span>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav className={`fixed inset-x-0 bottom-0 z-[1000] grid ${isAdmin ? "grid-cols-5" : "grid-cols-4"} border-t-2 border-foreground bg-asphalt text-asphalt-foreground md:hidden`}>
        <Tab to="/" icon={<Wrench className="size-5" />} label="Tool" exact />
        <Tab to="/map" icon={<Map className="size-5" />} label="Map" />
        <Link to="/report" className="-mt-5 flex flex-col items-center gap-1 text-[11px] font-medium">
          <span className="grid size-14 place-items-center rounded-full border-4 border-asphalt bg-primary text-primary-foreground shadow-lg">
            <Camera className="size-6" />
          </span>
          Report
        </Link>
        <Tab to="/my-reports" icon={<ListChecks className="size-5" />} label="Mine" />
        {/* Strictly show Admin tab on mobile ONLY if verified admin */}
        {isAdmin && <Tab to="/admin" icon={<ShieldCheck className="size-5" />} label="Admin" />}
      </nav>
    </div>
  );
}

function Tab({
  to,
  icon,
  label,
  exact,
}: {
  to: "/" | "/map" | "/my-reports" | "/admin" | "/auth";
  icon: ReactNode;
  label: string;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: !!exact }}
      className="flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-asphalt-foreground/60 transition-colors"
      activeProps={{ className: "!text-primary font-bold" }}
    >
      {icon}
      {label}
    </Link>
  );
}
