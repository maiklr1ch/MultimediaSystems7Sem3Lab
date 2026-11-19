import type { ExperimentRow } from '../hooks/useExperiments'
import type { MethodResult } from '../core/pipeline'
import { formatPercent, formatPsnr } from '../lib/format'
import type { MethodConfig } from '../lib/methods'

/**
 * PSNR залежно від частки збережених коефіцієнтів — класична крива "якість / обсяг даних".
 * Вісь X логарифмічна: різниця між 1 % і 2 % важить стільки ж, скільки між 10 % і 20 %.
 */
interface PsnrChartProps {
  config: MethodConfig
  rows: ExperimentRow[]
  current: { dct: MethodResult; dwt: MethodResult }
  hovered: number | null
  onHover: (index: number | null) => void
}

const W = 560
const H = 320
const M = { top: 16, right: 20, bottom: 44, left: 48 }
const X_TICKS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1]

interface Point {
  x: number
  y: number
}

export function PsnrChart({ config, rows, current, hovered, onHover }: PsnrChartProps) {
  if (rows.length === 0) {
    return <div className="flex aspect-[7/4] items-center justify-center text-[13px] text-ink-3">Рахую експерименти…</div>
  }

  const fraction = (r: MethodResult) => Math.max(r.kept, 1) / r.total
  const all = [...rows.flatMap((r) => [r.dct, r.dwt]), current.dct, current.dwt].filter((r) => Number.isFinite(r.psnr))
  const fractions = all.map(fraction)
  const psnrs = all.map((r) => r.psnr)

  const x0 = Math.log10(Math.min(...fractions) / 1.4)
  const x1 = Math.log10(Math.min(1, Math.max(...fractions) * 1.4))
  const y0 = Math.floor(Math.min(...psnrs) / 5) * 5
  const y1 = Math.ceil(Math.max(...psnrs) / 5) * 5

  const sx = (f: number) => M.left + ((Math.log10(f) - x0) / (x1 - x0)) * (W - M.left - M.right)
  const sy = (p: number) => H - M.bottom - ((p - y0) / (y1 - y0 || 1)) * (H - M.top - M.bottom)
  const point = (r: MethodResult): Point => ({ x: sx(fraction(r)), y: sy(r.psnr) })

  const yTicks: number[] = []
  for (let y = y0; y <= y1; y += 5) yTicks.push(y)
  const xTicks = X_TICKS.filter((t) => Math.log10(t) >= x0 - 1e-9 && Math.log10(t) <= x1 + 1e-9)

  const series = (kind: 'dct' | 'dwt') =>
    rows
      .map((row, index) => ({ index, p: point(row[kind]) }))
      .filter(({ index }) => Number.isFinite(rows[index][kind].psnr))
      .sort((a, b) => a.p.x - b.p.x)

  const dctPoints = series('dct')
  const dwtPoints = series('dwt')
  const path = (points: { p: Point }[]) => points.map(({ p }, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  const tooltipRow = hovered !== null ? rows[hovered] : null
  const tooltipAnchor = tooltipRow ? point(tooltipRow.dct) : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-ink-2" aria-hidden>
        <LegendItem series="dct" label="DCT 8×8" />
        <LegendItem series="dwt" label="DWT, Хаар" />
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          поточний рівень
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full overflow-visible"
          role="img"
          aria-label={`PSNR залежно від частки збережених коефіцієнтів, спосіб «${config.label}». Значення наведено в таблиці.`}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} className="stroke-line" strokeWidth={1} />
              <text x={M.left - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px]">
                {t}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={sx(t)} y={H - M.bottom + 18} textAnchor="middle" className="fill-ink-3 text-[11px]">
              {formatPercent(t)}
            </text>
          ))}
          <text x={(M.left + W - M.right) / 2} y={H - 6} textAnchor="middle" className="fill-ink-2 text-[12px]">
            Збережено коефіцієнтів (логарифмічна шкала)
          </text>
          <text
            transform={`translate(12 ${(M.top + H - M.bottom) / 2}) rotate(-90)`}
            textAnchor="middle"
            className="fill-ink-2 text-[12px]"
          >
            PSNR, дБ
          </text>

          <path d={path(dwtPoints)} fill="none" className="stroke-dwt" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={path(dctPoints)} fill="none" className="stroke-dct" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {dwtPoints.map(({ index, p }) => {
            const s = hovered === index ? 13 : 11
            return (
              <rect
                key={`dwt-${index}`}
                x={p.x - s / 2}
                y={p.y - s / 2}
                width={s}
                height={s}
                rx={1.5}
                className="fill-dwt stroke-page"
                strokeWidth={2}
              />
            )
          })}

          {/* DCT поверх: кола менші за квадрати, тож при збігу видно обидва маркери */}
          {dctPoints.map(({ index, p }) => (
            <circle
              key={`dct-${index}`}
              cx={p.x}
              cy={p.y}
              r={hovered === index ? 5 : 4}
              className="fill-dct stroke-page"
              strokeWidth={2}
            />
          ))}
          {(['dct', 'dwt'] as const).map((kind) => {
            const r = current[kind]
            if (!Number.isFinite(r.psnr)) return null
            const p = point(r)
            return (
              <circle
                key={`current-${kind}`}
                cx={p.x}
                cy={p.y}
                r={8}
                fill="none"
                className={kind === 'dct' ? 'stroke-dct' : 'stroke-dwt'}
                strokeWidth={2}
              />
            )
          })}

          {/* зони наведення більші за маркери */}
          {rows.map((row, index) =>
            (['dct', 'dwt'] as const)
              .filter((kind) => Number.isFinite(row[kind].psnr))
              .map((kind) => {
                const p = point(row[kind])
                return (
                  <circle
                    key={`hit-${kind}-${index}`}
                    cx={p.x}
                    cy={p.y}
                    r={14}
                    fill="transparent"
                    onPointerEnter={() => onHover(index)}
                    onPointerLeave={() => onHover(null)}
                  />
                )
              })
          )}
        </svg>

        {tooltipRow && tooltipAnchor && (
          <div
            className="pointer-events-none absolute z-10 w-max -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-md border border-line bg-panel px-3 py-2 text-[12.5px] shadow-lg"
            style={{
              left: `${Math.min(80, Math.max(20, (tooltipAnchor.x / W) * 100))}%`,
              top: `${(Math.min(tooltipAnchor.y, point(tooltipRow.dwt).y) / H) * 100}%`
            }}
          >
            <p className="font-semibold">{config.presetLabel(tooltipRow.value)}</p>
            <TooltipLine series="dct" label="DCT" result={tooltipRow.dct} />
            <TooltipLine series="dwt" label="DWT" result={tooltipRow.dwt} />
          </div>
        )}
      </div>
    </div>
  )
}

function LegendItem({ series, label }: { series: 'dct' | 'dwt'; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="22" height="12" viewBox="0 0 22 12">
        <line x1="1" x2="21" y1="6" y2="6" className={series === 'dct' ? 'stroke-dct' : 'stroke-dwt'} strokeWidth="2" />
        {series === 'dct' ? (
          <circle cx="11" cy="6" r="4" className="fill-dct" />
        ) : (
          <rect x="7" y="2" width="8" height="8" rx="1.5" className="fill-dwt" />
        )}
      </svg>
      {label}
    </span>
  )
}

function TooltipLine({ series, label, result }: { series: 'dct' | 'dwt'; label: string; result: MethodResult }) {
  return (
    <p className="mt-1 flex items-center gap-2 tabular-nums">
      <span aria-hidden className={`h-[3px] w-3 rounded-full ${series === 'dct' ? 'bg-dct' : 'bg-dwt'}`} />
      <span className="w-9 text-ink-2">{label}</span>
      <span className="font-semibold">{formatPsnr(result.psnr)}</span>
      <span className="text-ink-3">{formatPercent(result.kept / result.total)} коеф.</span>
    </p>
  )
}
