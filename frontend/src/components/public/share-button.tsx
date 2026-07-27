"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        toast.success("Event shared");
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success("Event link copied");
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          toast.success("Event link copied");
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          toast.error("Could not copy the event link", {
            description: "Copy the URL from your browser address bar instead."
          });
        }
      }
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => void share()}
      className="h-10"
      aria-live="polite"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-[#167c5a]" /> : <Share2 className="h-3.5 w-3.5" />}
      {copied ? "Link copied" : "Share event"}
    </Button>
  );
}
