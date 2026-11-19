interface SegmentedProps<T extends string | number> {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/** Група взаємовиключних кнопок (radiogroup). */
export function Segmented<T extends string | number>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-panel p-0.5">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`h-8 rounded-[5px] px-3 text-[13px] whitespace-nowrap transition-colors ${
              selected ? 'bg-ink font-semibold text-page' : 'text-ink-2 hover:bg-line/60 hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
