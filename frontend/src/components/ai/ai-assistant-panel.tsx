"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CalendarClock,
  Check,
  LoaderCircle,
  Send,
  ShieldCheck,
  Sparkles,
  X
} from "lucide-react";
import { aiAssistantApi } from "@/lib/api-client";
import type {
  AiAssistantResponse,
  AiEventProposal,
  EventDetail
} from "@/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatEventDate } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  response?: AiAssistantResponse;
  createdEvent?: EventDetail;
};

const prompts = [
  "How many registrations does my next event have?",
  "Which rooms are free tomorrow?",
  "Create a product launch next Friday at 6pm for 100 people"
];

export function AiAssistantPanel({
  organizationId,
  orgSlug
}: {
  organizationId: string;
  orgSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState("");
  const [insightsLoaded, setInsightsLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open || insightsLoaded) return;
    setInsightsLoaded(true);
    aiAssistantApi
      .insights(organizationId)
      .then((result) => {
        setMessages([
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: result.insights.join("\n")
          }
        ]);
      })
      .catch(() => {
        setMessages([
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              "I could not load workspace insights just now, but you can still ask a question."
          }
        ]);
      });
  }, [insightsLoaded, open, organizationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [loading, messages]);

  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim();
    if (!message || loading) return;
    setInput("");
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: message }
    ]);
    setLoading(true);
    try {
      const response = await aiAssistantApi.chat(organizationId, message);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.message,
          response
        }
      ]);
    } catch (error) {
      const friendly =
        "The assistant is temporarily unavailable. Your workspace data is safe and no changes were made.";
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: friendly }
      ]);
      toast.error("AI assistant unavailable", {
        description: error instanceof Error ? error.message : friendly
      });
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  async function confirmProposal(
    messageId: string,
    proposal: AiEventProposal
  ) {
    setConfirming(messageId);
    try {
      const result = await aiAssistantApi.confirm(
        organizationId,
        proposal.confirmationToken
      );
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                content: result.message,
                response: message.response
                  ? { ...message.response, proposal: undefined }
                  : undefined,
                createdEvent: result.event
              }
            : message
        )
      );
      toast.success("Event draft created", {
        description: `${result.event.title} is ready to review.`
      });
    } catch (error) {
      toast.error("Draft was not created", {
        description:
          error instanceof Error
            ? error.message
            : "Ask the assistant to prepare the event again."
      });
    } finally {
      setConfirming("");
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open AI assistant"
        onClick={() => setOpen(true)}
        className="button-polish focus-ring fixed bottom-5 right-5 z-40 inline-flex h-12 items-center gap-2 rounded-xl border border-blue-700 bg-blue-600 px-4 text-xs font-semibold text-white shadow-lift transition-[background-color,box-shadow] hover:bg-blue-700 hover:shadow-glow"
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">AI Assistant</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-[2px]">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close AI assistant"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Hostly AI assistant"
            className="relative flex h-full w-full max-w-[28rem] flex-col border-l border-slate-200 bg-white shadow-lift"
          >
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 px-4">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white">
                <Bot className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-950">
                  Hostly AI Assistant
                </h2>
                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  Grounded in this workspace
                </p>
              </div>
              <button
                type="button"
                aria-label="Close assistant panel"
                onClick={() => setOpen(false)}
                className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-5">
              <div className="space-y-4">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`max-w-[92%] ${
                      message.role === "user" ? "ml-auto" : ""
                    }`}
                  >
                    <div
                      className={`whitespace-pre-line rounded-xl px-4 py-3 text-xs leading-5 shadow-sm ${
                        message.role === "user"
                          ? "bg-slate-950 text-white"
                          : "border border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {message.content}
                    </div>

                    {message.response?.proposal ? (
                      <ProposalCard
                        proposal={message.response.proposal}
                        loading={confirming === message.id}
                        onConfirm={() =>
                          void confirmProposal(
                            message.id,
                            message.response!.proposal!
                          )
                        }
                      />
                    ) : null}

                    {message.createdEvent ? (
                      <Link
                        href={`/org/${encodeURIComponent(
                          orgSlug
                        )}/events/${message.createdEvent.id}/edit`}
                        onClick={() => setOpen(false)}
                        className="mt-2 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Review event draft
                      </Link>
                    ) : null}

                    {message.response?.sources?.length ? (
                      <p className="mt-1.5 px-1 text-[9px] text-slate-400">
                        Sources:{" "}
                        {message.response.sources
                          .map((source) =>
                            typeof source === "string"
                              ? source
                              : source.label || source.type || "workspace record"
                          )
                          .join(", ")}
                      </p>
                    ) : null}
                  </article>
                ))}
                {loading ? (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
                    <LoaderCircle className="h-4 w-4 animate-spin text-blue-600" />
                    Checking workspace data…
                  </div>
                ) : null}
                <div ref={bottomRef} />
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white p-4">
              {messages.length <= 1 ? (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  {prompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              ) : null}
              <form onSubmit={submit} className="flex items-end gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Message Hostly AI</span>
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage(input);
                      }
                    }}
                    rows={2}
                    maxLength={2000}
                    placeholder="Ask about events, rooms, or registrations…"
                    className="focus-ring min-h-12 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs leading-5 text-slate-900 placeholder:text-slate-400"
                  />
                </label>
                <Button
                  type="submit"
                  size="icon"
                  variant="coral"
                  disabled={!input.trim() || loading}
                  aria-label="Send message"
                  className="h-12 w-12 rounded-xl"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
              <p className="mt-2 text-center text-[9px] text-slate-400">
                Actions always require your confirmation.
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ProposalCard({
  proposal,
  loading,
  onConfirm
}: {
  proposal: AiEventProposal;
  loading: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
      <div className="border-b border-blue-100 bg-blue-50 px-4 py-3">
        <p className="text-[9px] font-semibold uppercase tracking-[.12em] text-blue-700">
          Requires confirmation
        </p>
        <h3 className="mt-1 text-sm font-semibold text-slate-950">
          {proposal.event.title}
        </h3>
      </div>
      <div className="space-y-2 px-4 py-3 text-[10px] text-slate-600">
        <p className="flex items-center gap-2">
          <CalendarClock className="h-3.5 w-3.5 text-blue-600" />
          {formatEventDate(proposal.event.startsAt, {
            timeZone: proposal.event.timezone,
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
          })}
        </p>
        <p>
          {proposal.event.capacity} places · {proposal.event.venueType.toLowerCase()} ·{" "}
          {proposal.event.category}
        </p>
        <p className="line-clamp-3 leading-4 text-slate-500">
          {proposal.event.description}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
        <span className="text-[9px] text-slate-400">Creates a draft only</span>
        <Button
          size="sm"
          variant="coral"
          loading={loading}
          loadingLabel="Creating…"
          onClick={onConfirm}
        >
          Confirm & create
        </Button>
      </div>
    </div>
  );
}
