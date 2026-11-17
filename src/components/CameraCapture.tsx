import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RotateCcw, SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { value: Blob | null; onChange: (b: Blob | null) => void };

export function CameraCapture({ value, onChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [live, setLive] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!value) { setPreview(null); return; }
    const u = URL.createObjectURL(value);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [value]);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  };
  useEffect(() => stop, []);

  const start = async (mode = facing) => {
    setErr(null);
    try {
      stop();
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode, width: { ideal: 1920 } }, audio: false });
      streamRef.current = s;
      setLive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); }
      });
    } catch {
      setErr("Camera not available. Allow camera access or upload a photo instead.");
    }
  };

  const snap = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    const scale = Math.min(1, 1600 / v.videoWidth);
    c.width = v.videoWidth * scale;
    c.height = v.videoHeight * scale;
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((b) => { if (b) { onChange(b); stop(); } }, "image/jpeg", 0.85);
  };

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-asphalt text-asphalt-foreground">
      {preview && !live && <img src={preview} alt="Hazard photo" className="h-full w-full object-cover" />}
      {live && <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />}

      {!preview && !live && (
        <div className="grid-paper flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <Camera className="size-10 text-primary" />
          <p className="max-w-xs text-sm opacity-80">Take a clear photo of the hazard. Include nearby landmarks if you can.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button type="button" variant="signal" onClick={() => start()}><Camera /> Open camera</Button>
            <Button type="button" variant="outline" className="border-asphalt-foreground/30 bg-transparent text-asphalt-foreground hover:bg-asphalt-foreground/10 hover:text-asphalt-foreground" onClick={() => fileRef.current?.click()}><ImagePlus /> Upload</Button>
          </div>
          {err && <p className="text-xs text-primary">{err}</p>}
        </div>
      )}

      {live && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4">
          <Button type="button" size="icon" variant="ink" onClick={stop} aria-label="Close camera"><X /></Button>
          <button type="button" onClick={snap} aria-label="Take photo" className="size-16 rounded-full border-4 border-asphalt-foreground bg-primary transition-transform active:scale-90" />
          <Button type="button" size="icon" variant="ink" aria-label="Switch camera" onClick={() => { const n = facing === "environment" ? "user" : "environment"; setFacing(n); start(n); }}><SwitchCamera /></Button>
        </div>
      )}

      {preview && !live && (
        <div className="absolute bottom-3 right-3 flex gap-2">
          <Button type="button" size="sm" variant="ink" onClick={() => { onChange(null); start(); }}><RotateCcw /> Retake</Button>
          <Button type="button" size="sm" variant="ink" onClick={() => fileRef.current?.click()}><ImagePlus /> Replace</Button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); e.target.value = ""; }} />
    </div>
  );
}
