import { useMemo } from 'react'
import type { GrayImage } from '../core/image'
import type { ExperimentRow } from '../hooks/useExperiments'
import { formatBpp, formatPercent, formatPsnr } from '../lib/format'
import type { MethodConfig } from '../lib/methods'
import { crop } from '../lib/render'
import { GrayCanvas } from './GrayCanvas'
import type { FocusPoint } from './ImagePanel'

export const CROP_SIZE = 48

interface ExperimentsTableProps {
  config: MethodConfig
  rows: ExperimentRow[]
  original: GrayImage
  focus: FocusPoint
  currentValue: number
  hovered: number | null
  onHover: (index: number | null) => void
  onPick: (value: number) => void
}

export function ExperimentsTable(props: ExperimentsTableProps) {
  const { original, focus } = props
  const center = { x: focus.x * original.width, y: focus.y * original.height }
  const originalCrop = useMemo(
    () => crop(original.data, original.width, original.height, center.x, center.y, CROP_SIZE),
    [original, center.x, center.y]
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[13px] tabular-nums" data-testid="experiments">
        <thead className="text-ink-2">
          <tr className="text-left">
            <th rowSpan={2} className="pr-4 pb-2 align-bottom font-medium">
              Рівень
            </th>
            <th colSpan={3} className="border-b border-line px-3 pb-1.5 font-medium">
              <SeriesKey series="dct" /> DCT 8×8
            </th>
            <th colSpan={3} className="border-b border-line px-3 pb-1.5 font-medium">
              <SeriesKey series="dwt" /> DWT, Хаар
            </th>
            <th rowSpan={2} className="pb-2 pl-4 align-bottom font-medium">
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] text-ink-3">оригінал</span>
                  <Crop pixels={originalCrop} label="Фрагмент оригіналу" />
                </div>
              </div>
            </th>
          </tr>
          <tr className="text-right text-[12px] text-ink-3">
            {['збережено', 'PSNR', 'біт/пікс', 'збережено', 'PSNR', 'біт/пікс'].map((label, i) => (
              <th key={i} className="px-3 pt-1.5 pb-2 font-normal">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, index) => {
            const active = row.value === props.currentValue
            const dctBetter = row.dct.psnr > row.dwt.psnr
            return (
              <tr
                key={row.value}
                tabIndex={0}
                aria-selected={active}
                onClick={() => props.onPick(row.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    props.onPick(row.value)
                  }
                }}
                onPointerEnter={() => props.onHover(index)}
                onPointerLeave={() => props.onHover(null)}
                onFocus={() => props.onHover(index)}
                onBlur={() => props.onHover(null)}
                className={`cursor-pointer border-t border-line transition-colors ${
                  active ? 'bg-panel' : props.hovered === index ? 'bg-panel/60' : ''
                }`}
              >
                <td className="py-2 pr-4 text-left font-semibold whitespace-nowrap">
                  {active && <span className="sr-only">поточний рівень: </span>}
                  {props.config.presetLabel(row.value)}
                </td>
                <td className="px-3 text-right">{formatPercent(row.dct.kept / row.dct.total)}</td>
                <td className={`px-3 text-right ${dctBetter ? 'font-semibold' : 'text-ink-2'}`}>{formatPsnr(row.dct.psnr)}</td>
                <td className="px-3 text-right text-ink-2">{formatBpp(row.dctSize.bitsPerPixel)}</td>
                <td className="px-3 text-right">{formatPercent(row.dwt.kept / row.dwt.total)}</td>
                <td className={`px-3 text-right ${dctBetter ? 'text-ink-2' : 'font-semibold'}`}>{formatPsnr(row.dwt.psnr)}</td>
                <td className="px-3 text-right text-ink-2">{formatBpp(row.dwtSize.bitsPerPixel)}</td>
                <td className="py-2 pl-4">
                  <div className="flex gap-2">
                    <RowCrop row={row} kind="dct" center={center} />
                    <RowCrop row={row} kind="dwt" center={center} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RowCrop({ row, kind, center }: { row: ExperimentRow; kind: 'dct' | 'dwt'; center: { x: number; y: number } }) {
  const result = row[kind]
  const size = Math.round(Math.sqrt(result.total))
  const pixels = useMemo(
    () => crop(result.pixels, size, size, center.x, center.y, CROP_SIZE),
    [result, size, center.x, center.y]
  )
  return <Crop pixels={pixels} label={`Фрагмент ${kind === 'dct' ? 'DCT' : 'DWT'}`} />
}

function Crop({ pixels, label }: { pixels: ArrayLike<number>; label: string }) {
  return (
    <GrayCanvas
      pixels={pixels}
      width={CROP_SIZE}
      height={CROP_SIZE}
      label={label}
      className="block h-24 w-24 bg-well"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

export function SeriesKey({ series }: { series: 'dct' | 'dwt' }) {
  return (
    <span
      aria-hidden
      className={`mr-1 inline-block h-[3px] w-3.5 rounded-full align-middle ${series === 'dct' ? 'bg-dct' : 'bg-dwt'}`}
    />
  )
}
