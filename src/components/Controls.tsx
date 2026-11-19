import { useId } from 'react'
import type { CompressionMethod } from '../core/compression'
import { METHODS, SLIDER_STEPS, getMethod } from '../lib/methods'
import { ERROR_GAIN } from '../lib/render'
import { Segmented } from './Segmented'

export type ViewMode = 'restored' | 'error' | 'coefficients'
export const ZOOM_LEVELS = [1, 2, 4, 8] as const
export type Zoom = (typeof ZOOM_LEVELS)[number]

interface ControlsProps {
  method: CompressionMethod
  value: number
  /** Позиція слайдера (див. valueToSlider). */
  position: number
  haarLevels: number
  maxHaarLevels: number
  view: ViewMode
  zoom: Zoom
  onMethodChange: (method: CompressionMethod) => void
  onPositionChange: (position: number) => void
  onHaarLevelsChange: (levels: number) => void
  onViewChange: (view: ViewMode) => void
  onZoomChange: (zoom: Zoom) => void
}

export function Controls(props: ControlsProps) {
  const config = getMethod(props.method)
  const sliderId = useId()
  const levelsId = useId()

  return (
    <section aria-label="Параметри стиснення" className="flex flex-col gap-4 border-b border-line pb-5">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <Field label="Спосіб стиснення">
          <Segmented
            label="Спосіб стиснення"
            value={props.method}
            onChange={props.onMethodChange}
            options={METHODS.map((m) => ({ value: m.id, label: m.label }))}
          />
        </Field>

        <div className="flex min-w-[280px] flex-1 flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={sliderId} className="text-[13px] text-ink-2">
              Рівень стиснення
            </label>
            <output htmlFor={sliderId} className="text-[15px] font-semibold tabular-nums" data-testid="level-value">
              {config.formatValue(props.value)}
            </output>
          </div>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={SLIDER_STEPS}
            step={1}
            value={props.position}
            onChange={(event) => props.onPositionChange(Number(event.target.value))}
            aria-valuetext={config.formatValue(props.value)}
            className="w-full"
          />
          <div className="flex justify-between text-[12px] text-ink-3">
            <span>слабше</span>
            <span>сильніше</span>
          </div>
        </div>

        <Field label="Рівні Хаара" htmlFor={levelsId}>
          <select
            id={levelsId}
            value={props.haarLevels}
            onChange={(event) => props.onHaarLevelsChange(Number(event.target.value))}
            className="h-9 rounded-md border border-line bg-panel px-2.5 text-[13px] tabular-nums"
          >
            {Array.from({ length: props.maxHaarLevels }, (_, i) => i + 1).map((levels) => (
              <option key={levels} value={levels}>
                {levels}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <Field label="Показати">
          <Segmented
            label="Що показувати"
            value={props.view}
            onChange={props.onViewChange}
            options={[
              { value: 'restored', label: 'Відновлене' },
              { value: 'error', label: `Похибка ×${ERROR_GAIN}` },
              { value: 'coefficients', label: 'Коефіцієнти' }
            ]}
          />
        </Field>
        <Field label="Збільшення">
          <Segmented
            label="Збільшення"
            value={props.zoom}
            onChange={props.onZoomChange}
            options={ZOOM_LEVELS.map((z) => ({ value: z, label: `${z}×` }))}
          />
        </Field>
        <p className="w-full max-w-[62ch] text-[13px] leading-relaxed text-ink-2 lg:w-auto lg:flex-1">{config.hint}</p>
      </div>
    </section>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-[13px] text-ink-2">
          {label}
        </label>
      ) : (
        <span className="text-[13px] text-ink-2">{label}</span>
      )}
      {children}
    </div>
  )
}
