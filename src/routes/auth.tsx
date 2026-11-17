import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock, Mail, User, ShieldCheck, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string | undefined } => {
    const n = s["next"];
    return { next: typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : undefined };
  },
  head: () => ({
    meta: [
      { title: "Sign in & Register — RoadWatch Tool" },
      { name: "description", content: "Sign in or create an account to report road hazards and track repairs." },
      { property: "og:title", content: "Sign in & Register — RoadWatch Tool" },
      { property: "og:description", content: "Sign in or create an account to report road hazards and track repairs." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const go = () => navigate({ to: next ?? "/" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      if (mode === "in") {
        const data = await api.signIn({ email, password });
        setBusy(false);
        if (data.user.role === "admin") {
          toast.success(`Welcome Administrator (${data.user.name})!`);
        } else {
          toast.success(`Welcome back, ${data.user.name}!`);
        }
        go();
      } else {
        const data = await api.signUp({ email, password, name });
        setBusy(false);
        toast.success(`Account created! Welcome, ${data.user.name}`);
        go();
      }
    } catch (err: any) {
      setBusy(false);
      toast.error(err.message || "Authentication failed");
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-3.5rem)] md:grid-cols-2">
      <div className="relative hidden flex-col justify-end overflow-hidden bg-asphalt p-10 text-asphalt-foreground md:flex">
        <div className="grid-paper absolute inset-0 opacity-30" />
        <div className="hazard-tape absolute inset-x-0 top-0 h-3" />
        <p className="eyebrow relative !text-primary">Citizen Road Hazard Tool</p>
        <h1 className="relative mt-3 text-5xl font-bold leading-[0.95]">
          Inspect.<br />Report.<br />Fix Roads.
        </h1>
        <div className="relative mt-8 rounded-lg border border-border/40 bg-background/10 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <ShieldCheck className="size-4" /> Secure JWT Authentication
          </div>
          <p className="mt-1 text-xs text-asphalt-foreground/75 leading-relaxed">
            All user profiles and hazard reports are stored securely in MongoDB Atlas with encrypted credentials.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          {/* Tab buttons for Sign In / Sign Up */}
          <div className="mb-6 grid grid-cols-2 rounded-lg border border-border bg-muted p-1">
            <button
              type="button"
              className={`rounded-md py-2 text-sm font-semibold transition-all ${
                mode === "in" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMode("in")}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`rounded-md py-2 text-sm font-semibold transition-all ${
                mode === "up" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMode("up")}
            >
              Sign Up
            </button>
          </div>

          <h2 className="text-3xl font-bold">
            {mode === "in" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "in"
              ? "Sign in with your email and password to access the tool."
              : "Register to submit hazard reports and follow repair updates."}
          </p>

          <form onSubmit={submit} className="mt-6 grid gap-4">
            {mode === "up" && (
              <div className="grid gap-1.5">
                <Label htmlFor="n" className="flex items-center gap-1.5">
                  <User className="size-3.5 text-muted-foreground" /> Full Name
                </Label>
                <Input
                  id="n"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="e" className="flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted-foreground" /> Email Address
              </Label>
              <Input
                id="e"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="p" className="flex items-center gap-1.5">
                <Lock className="size-3.5 text-muted-foreground" /> Password
              </Label>
              <Input
                id="p"
                type="password"
                placeholder="••••••••"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" variant="signal" size="lg" className="mt-2 w-full" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Processing…
                </>
              ) : (
                <>
                  {mode === "in" ? "Sign In" : "Create Account"} <ArrowRight className="ml-2 size-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
              onClick={() => setMode(mode === "in" ? "up" : "in")}
            >
              {mode === "in" ? "Need an account? Sign up here" : "Already have an account? Sign in here"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
