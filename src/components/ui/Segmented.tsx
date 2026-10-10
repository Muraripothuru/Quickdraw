"use client";

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-xl border border-line bg-panel2/70 p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold transition ${
              active
                ? "bg-accent text-white shadow-[0_6px_18px_-8px_rgba(99,102,241,0.9)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
