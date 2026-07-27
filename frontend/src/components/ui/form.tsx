"use client";

import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  error,
  className,
  children
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block space-y-2", className)}>
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-slate-700">{label}</span>
        {hint ? <span className="text-[11px] text-slate-500">{hint}</span> : null}
      </span>
      {children}
      {error ? <span className="block text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "focus-ring h-12 w-full rounded-full border border-ink/15 bg-white px-4 text-sm text-ink shadow-sm placeholder:text-slate-400 transition focus:border-ink focus:outline-none focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "focus-ring min-h-32 w-full resize-y rounded-3xl border border-ink/15 bg-white px-4 py-3 text-sm leading-6 text-ink shadow-sm placeholder:text-slate-400 transition focus:border-ink focus:outline-none focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

type SelectOption = {
  value: string;
  label: string;
  disabled: boolean;
};

export type SelectChangeEvent = {
  target: { value: string; name?: string };
  currentTarget: { value: string; name?: string };
};

export type SelectProps = {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onChange?: (event: SelectChangeEvent) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

function optionText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      if (isValidElement<{ children?: ReactNode }>(child)) return optionText(child.props.children);
      return "";
    })
    .join("");
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      className,
      children,
      value,
      defaultValue = "",
      onChange,
      onBlur,
      name,
      id,
      disabled = false,
      required = false,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      "aria-invalid": ariaInvalid
    },
    ref
  ) => {
    const generatedId = useId();
    const listId = `${id || generatedId}-listbox`;
    const rootRef = useRef<HTMLSpanElement>(null);
    const [open, setOpen] = useState(false);
    const [internalValue, setInternalValue] = useState(String(defaultValue));
    const options = useMemo<SelectOption[]>(
      () =>
        Children.toArray(children).flatMap((child) => {
          if (!isValidElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>(child)) {
            return [];
          }
          const label = optionText(child.props.children);
          return [
            {
              value: String(child.props.value ?? label),
              label,
              disabled: Boolean(child.props.disabled)
            }
          ];
        }),
      [children]
    );
    const selectedValue = value === undefined ? internalValue : String(value);
    const selected = options.find((option) => option.value === selectedValue);
    const selectedIndex = Math.max(
      0,
      options.findIndex((option) => option.value === selectedValue)
    );
    const [activeIndex, setActiveIndex] = useState(selectedIndex);

    useEffect(() => {
      if (value === undefined) setInternalValue(String(defaultValue));
    }, [defaultValue, value]);

    useEffect(() => {
      function onPointerDown(event: PointerEvent) {
        if (!rootRef.current?.contains(event.target as Node)) {
          setOpen(false);
          onBlur?.();
        }
      }
      document.addEventListener("pointerdown", onPointerDown);
      return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [onBlur]);

    function selectOption(option: SelectOption) {
      if (option.disabled) return;
      if (value === undefined) setInternalValue(option.value);
      const changeEvent = {
        target: { value: option.value, name },
        currentTarget: { value: option.value, name }
      };
      onChange?.(changeEvent);
      setOpen(false);
      onBlur?.();
    }

    function moveActive(direction: 1 | -1) {
      if (!options.length) return;
      let next = activeIndex;
      do {
        next = (next + direction + options.length) % options.length;
      } while (options[next]?.disabled && next !== activeIndex);
      setActiveIndex(next);
    }

    return (
      <span ref={rootRef} className="relative block w-full">
        {name ? (
          <input
            type="hidden"
            name={name}
            value={selectedValue}
            disabled={disabled}
            readOnly
          />
        ) : null}
        <button
          ref={ref}
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => {
            setActiveIndex(selectedIndex);
            setOpen((current) => !current);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (!open) {
                setOpen(true);
                setActiveIndex(selectedIndex);
              } else {
                moveActive(event.key === "ArrowDown" ? 1 : -1);
              }
            } else if (event.key === "Home" && open) {
              event.preventDefault();
              setActiveIndex(0);
            } else if (event.key === "End" && open) {
              event.preventDefault();
              setActiveIndex(Math.max(0, options.length - 1));
            } else if ((event.key === "Enter" || event.key === " ") && open) {
              event.preventDefault();
              if (options[activeIndex]) selectOption(options[activeIndex]);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              setOpen(false);
            }
          }}
          className={cn(
            "focus-ring flex h-12 w-full items-center justify-between gap-3 rounded-full border border-ink/15 bg-white py-0 pl-4 pr-4 text-left text-sm text-ink shadow-sm",
            "transition-[border-color,box-shadow,background-color] hover:border-ink/40 focus:border-ink focus:outline-none focus:ring-2 focus:ring-amber-100",
            "disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500",
            ariaInvalid === true || ariaInvalid === "true"
              ? "border-red-400 ring-2 ring-red-100"
              : "",
            open && "border-ink ring-2 ring-amber-100",
            className
          )}
          role="combobox"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-controls={listId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
          aria-invalid={ariaInvalid}
          aria-required={required || undefined}
        >
          <span className={cn("min-w-0 flex-1 truncate", selected ? "" : "text-slate-400")}>
            {selected?.label || "Select an option"}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-400 transition-transform",
              open && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>

        {open ? (
          <span
            id={listId}
            role="listbox"
            className="absolute z-50 mt-2 block max-h-64 w-full min-w-[12rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lift"
          >
            {options.map((option, index) => (
              <button
                key={`${option.value}-${index}`}
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={option.value === selectedValue}
                disabled={option.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-slate-700 transition",
                  activeIndex === index ? "bg-slate-100 text-slate-950" : "hover:bg-slate-50",
                  option.disabled && "cursor-not-allowed opacity-45"
                )}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.value === selectedValue ? (
                  <Check className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                ) : null}
              </button>
            ))}
          </span>
        ) : null}
      </span>
    );
  }
);
Select.displayName = "Select";
