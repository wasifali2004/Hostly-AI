"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

export function TagInput({
  value,
  onChange,
  placeholder = "Type a value and press Enter",
  suggestions = [],
  maxItems = 20
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  maxItems?: number;
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const item = raw.trim();
    if (!item || value.length >= maxItems) {
      setDraft("");
      return;
    }
    if (!value.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
      onChange([...value, item]);
    }
    setDraft("");
  }

  function remove(item: string) {
    onChange(value.filter((existing) => existing !== item));
  }

  const availableSuggestions = suggestions.filter(
    (suggestion) =>
      !value.some((item) => item.toLowerCase() === suggestion.toLowerCase()) &&
      (!draft || suggestion.toLowerCase().includes(draft.toLowerCase()))
  );

  return (
    <div>
      <div className="focus-within:ring-blue-100 flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white p-1.5 shadow-sm transition focus-within:border-blue-500 focus-within:ring-2">
        {value.map((item) => (
          <span
            key={item}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-blue-100 bg-blue-50 pl-2.5 pr-1 text-[10px] font-semibold text-blue-800"
          >
            {item}
            <button
              type="button"
              onClick={() => remove(item)}
              className="focus-ring grid h-5 w-5 place-items-center rounded text-blue-500 transition hover:bg-blue-100 hover:text-blue-800"
              aria-label={`Remove ${item}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          disabled={value.length >= maxItems}
          onChange={(event) => setDraft(event.target.value.replace(/,/g, ""))}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add(draft);
            }
            if (event.key === "Backspace" && !draft && value.length) {
              remove(value[value.length - 1]);
            }
          }}
          onBlur={() => add(draft)}
          placeholder={value.length ? "Add another…" : placeholder}
          className="h-7 min-w-36 flex-1 bg-transparent px-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
        {draft ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => add(draft)}
            className="focus-ring grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            aria-label="Add value"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {availableSuggestions.length > 0 && value.length < maxItems ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {availableSuggestions.slice(0, 6).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(suggestion)}
              className="focus-ring rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-medium text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-1.5 text-[9px] text-slate-400">
        {value.length}/{maxItems} added
      </p>
    </div>
  );
}
