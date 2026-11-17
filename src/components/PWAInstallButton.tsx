import { useState, useEffect } from "react";
import { Download, Check, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PWAInstallButton({ className = "", variant = "outline" }: { className?: string; variant?: "signal" | "outline" | "ghost" }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast.success("RoadWatch App installed successfully!");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          toast.success("Thank you for installing RoadWatch!");
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error("Install prompt error:", err);
      }
    } else {
      // Guide user on how to install if browser does not support or already dismissed
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        toast.info("To install on iOS: tap the Share button in Safari, then tap 'Add to Home Screen'.", {
          duration: 6000,
        });
      } else {
        toast.info("To install: click the Install icon in your browser's address bar or menu.", {
          duration: 5000,
        });
      }
    }
  };

  if (isInstalled) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-500 bg-emerald-500/10 rounded-md ${className}`}>
        <Check className="size-3.5" /> App Installed
      </span>
    );
  }

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleInstallClick}
      className={`gap-1.5 font-semibold transition-all ${className}`}
      title="Install RoadWatch as a Desktop or Mobile App"
    >
      <Download className="size-4 text-primary" />
      <span>Install App</span>
    </Button>
  );
}
