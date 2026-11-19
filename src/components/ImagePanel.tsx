import type { ReactNode } from 'react'
import { GrayCanvas } from './GrayCanvas'
import type { Zoom } from './Controls'

export interface FocusPoint {
  /** Координати 0..1 відносно ширини та висоти зображення. */
  x: number
  y: number
}

interface ImagePanelProps {
  title: string
  /** Колір-ідентифікатор методу (смужка біля назви), або нічого для оригіналу. */
  series?: 'dct' | 'dwt'
  caption: string
  pixels: ArrayLike<number>
  width: number
  height: number
  zoom: Zoom
  /** Спільна для всіх панелей точка збільшення — так усі три показують ту саму ділянку. */
  zoomOrigin: FocusPoint
  onPointer: (point: FocusPoint) => void
  onSelect: (point: FocusPoint) => void
  /** Квадрат фрагмента для таблиці експериментів (частка розміру зображення). */
  marker?: { point: FocusPoint; size: number }
  action?: ReactNode
  children: ReactNode
}

export function ImagePanel(props: ImagePanelProps) {
  const toPoint = (event: React.MouseEvent<HTMLDivElement>): FocusPoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    }
  }

  const zoomed = props.zoom > 1

  return (
    <figure className="flex min-w-0 flex-col gap-3" data-testid={`panel-${props.series ?? 'original'}`}>
      <figcaption className="flex min-h-9 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {props.series && (
            <span
              aria-hidden
              className={`h-[3px] w-4 shrink-0 rounded-full ${props.series === 'dct' ? 'bg-dct' : 'bg-dwt'}`}
            />
          )}
          <div className="min-w-0">
            <h2 className="text-[17px] leading-tight font-semibold">{props.title}</h2>
            <p className="truncate text-[12.5px] text-ink-3">{props.caption}</p>
          </div>
        </div>
        {props.action}
      </figcaption>

      <div
        className={`relative aspect-square overflow-hidden bg-well ${zoomed ? 'cursor-zoom-in' : 'cursor-crosshair'}`}
        onPointerMove={(event) => props.onPointer(toPoint(event))}
        onClick={(event) => props.onSelect(toPoint(event))}
      >
        <GrayCanvas
          pixels={props.pixels}
          width={props.width}
          height={props.height}
          label={`${props.title}: ${props.caption}`}
          className="block h-full w-full"
          style={{
            imageRendering: zoomed ? 'pixelated' : 'auto',
            transform: zoomed ? `scale(${props.zoom})` : undefined,
            transformOrigin: `${props.zoomOrigin.x * 100}% ${props.zoomOrigin.y * 100}%`
          }}
        />
        {props.marker && !zoomed && (
          <div
            aria-hidden
            className="pointer-events-none absolute border border-white mix-blend-difference"
            style={{
              width: `${props.marker.size * 100}%`,
              height: `${props.marker.size * 100}%`,
              left: `${clampMarker(props.marker.point.x, props.marker.size) * 100}%`,
              top: `${clampMarker(props.marker.point.y, props.marker.size) * 100}%`
            }}
          />
        )}
      </div>

      {props.children}
    </figure>
  )
}

function clampMarker(center: number, size: number): number {
  return Math.min(1 - size, Math.max(0, center - size / 2))
}
