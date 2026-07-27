"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Check,
  CircleAlert,
  Keyboard,
  LoaderCircle,
  RotateCcw,
  ScanLine,
  TicketCheck,
  UserRoundCheck
} from "lucide-react";
import { checkInApi } from "@/lib/api-client";
import type { CheckInStats, EventDetail, Registration } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { percent } from "@/lib/utils";

type DetectorResult = { rawValue: string };
type Detector = { detect: (source: CanvasImageSource) => Promise<DetectorResult[]> };
type DetectorConstructor = new (options?: { formats?: string[] }) => Detector;

function extractCode(raw: string) {
  const value = raw.trim();
  try {
    const object = JSON.parse(value) as { code?: string; checkInCode?: string };
    if (object.code || object.checkInCode) return object.code || object.checkInCode || value;
  } catch {
    // Not JSON; QR passes may contain the code directly.
  }
  try {
    const url = new URL(value);
    return url.searchParams.get("code") || url.pathname.split("/").filter(Boolean).pop() || value;
  } catch {
    return value;
  }
}

export function CheckInScanner({
  event,
  organizationId
}: {
  event: EventDetail;
  organizationId?: string;
}) {
  const { selectedMembership } = useAuth();
  const toast = useToast();
  const targetOrganizationId = organizationId || selectedMembership?.organizationId;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const processingRef = useRef(false);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [pending, setPending] = useState(false);
  const [stats, setStats] = useState<CheckInStats | null>(null);
  const [result, setResult] = useState<{
    tone: "success" | "warning" | "error";
    title: string;
    message: string;
    registration?: Registration;
  } | null>(null);

  const loadStats = useCallback(async () => {
    if (!targetOrganizationId) return;
    try {
      setStats(await checkInApi.stats(targetOrganizationId, event.id));
    } catch {
      // The scanner remains usable if only the aggregate endpoint is temporarily unavailable.
    }
  }, [event.id, targetOrganizationId]);

  useEffect(() => {
    void loadStats();
    const interval = window.setInterval(() => void loadStats(), 5000);
    return () => window.clearInterval(interval);
  }, [loadStats]);

  const stopCamera = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const validate = useCallback(
    async (rawCode: string) => {
      if (!targetOrganizationId || processingRef.current) return;
      const code = extractCode(rawCode);
      if (!code) return;
      if (
        lastCodeRef.current?.code === code &&
        Date.now() - lastCodeRef.current.at < 5000
      ) {
        return;
      }
      lastCodeRef.current = { code, at: Date.now() };
      processingRef.current = true;
      setPending(true);
      setResult(null);
      try {
        const response = await checkInApi.validate(
          targetOrganizationId,
          event.id,
          code
        );
        setResult({
          tone: response.alreadyCheckedIn ? "warning" : "success",
          title: response.alreadyCheckedIn ? "Already checked in" : "Guest checked in",
          message: response.alreadyCheckedIn
            ? "This pass was scanned previously. No duplicate check-in was recorded."
            : "The pass is valid and attendance has been recorded.",
          registration: response.registration
        });
        if (response.alreadyCheckedIn) {
          toast.info("Already checked in", {
            description: `${response.registration.attendeeName}'s pass was scanned previously.`
          });
        } else {
          toast.success("Guest checked in", {
            description: `${response.registration.attendeeName} · ${response.registration.ticketTier.name}`
          });
        }
        if (!response.alreadyCheckedIn && "vibrate" in navigator) navigator.vibrate(100);
        setManualCode("");
        await loadStats();
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "This code could not be validated for this event.";
        setResult({
          tone: "error",
          title: "Pass not accepted",
          message
        });
        toast.error("Pass not accepted", {
          description: message
        });
      } finally {
        setPending(false);
        window.setTimeout(() => {
          processingRef.current = false;
        }, 1200);
      }
    },
    [event.id, loadStats, targetOrganizationId, toast]
  );

  const scanFrame = useCallback(async () => {
    if (!videoRef.current || !detectorRef.current || !streamRef.current) return;
    if (videoRef.current.readyState >= 2 && !processingRef.current) {
      try {
        const results = await detectorRef.current.detect(videoRef.current);
        if (results[0]?.rawValue) await validate(results[0].rawValue);
      } catch {
        // A frame can be unreadable; the next animation frame retries.
      }
    }
    frameRef.current = requestAnimationFrame(() => void scanFrame());
  }, [validate]);

  async function startCamera() {
    setCameraError("");
    setResult(null);
    try {
      const DetectorClass = (
        window as typeof window & { BarcodeDetector?: DetectorConstructor }
      ).BarcodeDetector;
      if (!DetectorClass) {
        throw new Error(
          "Automatic QR detection is not available in this browser. Use manual entry below."
        );
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false
      });
      streamRef.current = stream;
      detectorRef.current = new DetectorClass({ formats: ["qr_code"] });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      frameRef.current = requestAnimationFrame(() => void scanFrame());
    } catch (requestError) {
      stopCamera();
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Camera access was not available.";
      setCameraError(message);
      toast.error("Camera unavailable", { description: message });
    }
  }

  const checkedIn = stats?.checkedIn || 0;
  const registered = stats?.registered || 0;
  const rate = stats?.checkInRate ?? percent(checkedIn, registered);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(20rem,.85fr)_minmax(19rem,.55fr)]">
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-white shadow-lift">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-blue-300" />
            <span className="text-xs font-semibold">QR scanner</span>
          </div>
          <span
            className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] ${
              cameraActive ? "text-emerald-300" : "text-white/35"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${cameraActive ? "bg-emerald-300" : "bg-white/25"}`} />
            {cameraActive ? "Camera live" : "Camera off"}
          </span>
        </div>
        <div className="relative aspect-[4/3] min-h-[20rem] bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`absolute inset-0 h-full w-full object-cover ${cameraActive ? "block" : "hidden"}`}
          />
          {!cameraActive ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-xl border border-white/10 bg-white/[0.05]">
                <CameraOff className="h-6 w-6 text-white/35" />
              </span>
              <h3 className="mt-5 font-display text-2xl font-semibold">Ready to scan</h3>
              <p className="mt-2 max-w-xs text-xs leading-5 text-white/38">
                Use the rear camera and hold a guest’s QR pass inside the frame.
              </p>
              <Button variant="inverse" size="sm" className="mt-5" onClick={() => void startCamera()}>
                <Camera className="h-3.5 w-3.5" />
                Start camera
              </Button>
            </div>
          ) : (
            <>
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2">
                <span className="absolute left-0 top-0 h-9 w-9 rounded-tl-xl border-l-2 border-t-2 border-white" />
                <span className="absolute right-0 top-0 h-9 w-9 rounded-tr-xl border-r-2 border-t-2 border-white" />
                <span className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-xl border-b-2 border-l-2 border-white" />
                <span className="absolute bottom-0 right-0 h-9 w-9 rounded-br-xl border-b-2 border-r-2 border-white" />
                <span className="scanline absolute inset-x-2 top-0 h-px bg-blue-400 shadow-[0_0_8px_#60a5fa]" />
              </div>
              <Button
                type="button"
                variant="inverse"
                size="sm"
                onClick={stopCamera}
                className="absolute bottom-4 left-1/2 h-9 -translate-x-1/2 border-white/10 bg-black/60 text-[10px] text-white backdrop-blur hover:bg-black/75"
              >
                Stop camera
              </Button>
            </>
          )}
          {pending ? (
            <div className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-sm">
              <div className="text-center">
                <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-white" />
                <p className="mt-3 text-xs font-bold">Validating pass…</p>
              </div>
            </div>
          ) : null}
        </div>
        {cameraError ? (
          <p className="border-t border-amber-400/15 bg-amber-400/10 px-5 py-3 text-[10px] leading-5 text-amber-100">
            {cameraError}
          </p>
        ) : null}
        <form
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            void validate(manualCode);
          }}
          className="border-t border-white/10 p-4"
        >
          <label className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-white/34">
            <Keyboard className="h-3 w-3" />
            Manual code
          </label>
          <div className="flex gap-2">
            <Input
              value={manualCode}
              onChange={(input) => setManualCode(input.target.value.toUpperCase())}
              placeholder="HST-XXXXXX"
              className="border-white/10 bg-white/[0.07] font-mono text-white placeholder:text-white/20 focus:border-white/30"
            />
            <Button type="submit" variant="inverse" disabled={!manualCode.trim() || pending}>
              Check in
            </Button>
          </div>
        </form>
      </section>

      <aside className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Live door count
          </p>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-4xl font-semibold tracking-[-0.05em] text-slate-950">{checkedIn}</p>
              <p className="mt-1 text-[10px] font-semibold text-ink/38">
                of {registered} registered
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-emerald-700">{rate}%</p>
              <p className="mt-1 text-[9px] text-ink/35">checked in</p>
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-ink/[0.07]">
            <div
              className="h-full rounded-full bg-sage transition-all duration-500"
              style={{ width: `${rate}%` }}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void loadStats()}
            className="mt-3 -ml-3 h-8 text-[10px] text-ink/50"
          >
            <RotateCcw className="h-3 w-3" />
            Refresh count
          </Button>
        </section>

        {result ? (
          <section
            aria-live="assertive"
            className={`rounded-xl border p-5 ${
              result.tone === "success"
                ? "border-emerald-200 bg-emerald-50"
                : result.tone === "warning"
                  ? "border-amber-200 bg-amber-50"
                  : "border-red-200 bg-red-50"
            }`}
          >
            <span
              className={`grid h-11 w-11 place-items-center rounded-lg ${
                result.tone === "success"
                  ? "bg-emerald-600 text-white"
                  : result.tone === "warning"
                    ? "bg-amber-500 text-white"
                    : "bg-red-600 text-white"
              }`}
            >
              {result.tone === "success" ? (
                <Check className="h-5 w-5" strokeWidth={3} />
              ) : (
                <CircleAlert className="h-5 w-5" />
              )}
            </span>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">{result.title}</h3>
            <p className="mt-1 text-[10px] leading-5 text-ink/55">{result.message}</p>
            {result.registration ? (
              <div className="mt-4 border-t border-current/10 pt-4">
                <p className="text-lg font-semibold text-slate-950">{result.registration.attendeeName}</p>
                <p className="mt-1 text-[10px] text-ink/45">
                  {result.registration.ticketTier.name} · {result.registration.attendeeEmail}
                </p>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <UserRoundCheck className="mx-auto h-5 w-5 text-ink/25" />
            <p className="mt-3 text-xs font-bold text-ink/48">Scan result appears here</p>
            <p className="mt-1 text-[10px] leading-4 text-ink/32">
              Valid passes show the guest and ticket tier.
            </p>
          </section>
        )}

        <section className="rounded-xl border border-blue-100 bg-blue-50 p-5">
          <TicketCheck className="h-4 w-4 text-blue-700" />
          <p className="mt-3 text-xs font-semibold text-slate-900">Door note</p>
          <p className="mt-1 text-[10px] leading-5 text-ink/50">
            Keep manual entry available as a fallback. A valid pass can only check into this
            event once.
          </p>
        </section>
      </aside>
    </div>
  );
}
