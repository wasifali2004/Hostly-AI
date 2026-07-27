"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject
} from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChoiceOption = {
  value: string;
  label: string;
  description?: string;
  keywords?: string[];
  disabled?: boolean;
};

function matches(option: ChoiceOption, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [option.label, option.description, ...(option.keywords || [])]
    .filter(Boolean)
    .some((text) => text!.toLocaleLowerCase().includes(normalized));
}

function useOutsideClose(
  rootRef: RefObject<HTMLDivElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClose, rootRef]);
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search options",
  emptyMessage = "No options found.",
  disabled = false,
  clearable = false,
  className,
  "aria-label": ariaLabel
}: {
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(
    () => options.filter((option) => matches(option, query)),
    [options, query]
  );

  useOutsideClose(rootRef, () => {
    setOpen(false);
    setQuery("");
  });

  function openMenu() {
    if (disabled) return;
    setOpen(true);
    setActiveIndex(Math.max(0, filtered.findIndex((option) => option.value === value)));
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function choose(option: ChoiceOption) {
    if (option.disabled) return;
    onChange(option.value);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        if (!filtered.length) return 0;
        return (current + direction + filtered.length) % filtered.length;
      });
      return;
    }
    if (event.key === "Enter" && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex]);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        disabled={disabled}
        className={cn(
          "focus-ring flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 text-left text-sm shadow-sm",
          "transition-[border-color,box-shadow,background-color] hover:border-slate-400",
          "disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500",
          open && "border-blue-500 ring-2 ring-blue-100",
          clearable && selected && "pr-16"
        )}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
      >
        <span className={cn("truncate", selected ? "text-slate-900" : "text-slate-400")}>
          {selected?.label || placeholder}
        </span>
        <span className="flex shrink-0 items-center">
          <ChevronsUpDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
        </span>
      </button>
      {clearable && selected && !disabled ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="focus-ring absolute right-8 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Clear selection"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}

      {open ? (
        <div className="absolute z-50 mt-2 w-full min-w-[14rem] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lift">
          <label className="flex h-9 items-center gap-2 border-b border-slate-100 px-2">
            <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span className="sr-only">{searchPlaceholder}</span>
            <input
              ref={inputRef}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listId}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
          <div id={listId} role="listbox" className="mt-1 max-h-64 overflow-y-auto">
            {filtered.length ? (
              filtered.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  disabled={option.disabled}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition",
                    index === activeIndex ? "bg-slate-100" : "hover:bg-slate-50",
                    option.disabled && "cursor-not-allowed opacity-45"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-slate-800">{option.label}</span>
                    {option.description ? (
                      <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {option.value === value ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                  ) : null}
                </button>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-xs text-slate-500">{emptyMessage}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MultiSelect({
  options,
  values,
  onChange,
  placeholder = "Select options",
  searchPlaceholder = "Search options",
  emptyMessage = "No options found.",
  disabled = false,
  className,
  "aria-label": ariaLabel
}: {
  options: ChoiceOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = options.filter((option) => values.includes(option.value));
  const filtered = useMemo(
    () => options.filter((option) => matches(option, query)),
    [options, query]
  );

  useOutsideClose(rootRef, () => {
    setOpen(false);
    setQuery("");
  });

  function toggle(option: ChoiceOption) {
    if (option.disabled) return;
    onChange(
      values.includes(option.value)
        ? values.filter((value) => value !== option.value)
        : [...values, option.value]
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        if (!filtered.length) return 0;
        return (current + direction + filtered.length) % filtered.length;
      });
      return;
    }
    if (event.key === "Enter" && filtered[activeIndex]) {
      event.preventDefault();
      toggle(filtered[activeIndex]);
    }
    if (event.key === "Backspace" && !query && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div
        className={cn(
          "focus-within:ring-blue-100 flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 shadow-sm",
          "transition-[border-color,box-shadow] focus-within:border-blue-500 focus-within:ring-2",
          disabled && "cursor-not-allowed border-slate-200 bg-slate-100"
        )}
      >
        {selected.map((option) => (
          <span
            key={option.value}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-slate-100 pl-2 pr-1 text-[11px] font-medium text-slate-700"
          >
            {option.label}
            <button
              type="button"
              disabled={disabled}
              onClick={() => toggle(option)}
              className="grid h-5 w-5 place-items-center rounded text-slate-400 hover:bg-white hover:text-slate-700"
              aria-label={`Remove ${option.label}`}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          role="combobox"
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={selected.length ? searchPlaceholder : placeholder}
          className="h-7 min-w-[7rem] flex-1 bg-transparent px-1 text-xs text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen((current) => !current);
            window.requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none"
          aria-label={open ? "Close options" : "Open options"}
        >
          <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-50 mt-2 max-h-72 w-full min-w-[14rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lift"
        >
          {filtered.length ? (
            filtered.map((option, index) => {
              const isSelected = values.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => toggle(option)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition",
                    index === activeIndex ? "bg-slate-100" : "hover:bg-slate-50",
                    option.disabled && "cursor-not-allowed opacity-45"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border",
                      isSelected
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 bg-white"
                    )}
                  >
                    {isSelected ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-slate-800">{option.label}</span>
                    {option.description ? (
                      <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-3 py-6 text-center text-xs text-slate-500">{emptyMessage}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
