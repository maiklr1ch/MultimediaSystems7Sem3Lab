import type { ReactNode } from 'react'
import { coefficientRatio, type MethodResult, type SizeEstimate } from '../core/pipeline'
import {
  formatBpp,
  formatBytes,
  formatInteger,
  formatNumber,
  formatPercent,
  formatPsnr,
  formatRatio
} from '../lib/format'

interface MethodMetricsProps {
  result: MethodResult
  size?: SizeEstimate
  /** PSNR іншого методу — щоб підписати, який із двох кращий. */
  otherPsnr: number
}

export function MethodMetrics({ result, size, otherPsnr }: MethodMetricsProps) {
  const diff = result.psnr - otherPsnr
  const better = Number.isFinite(diff) ? diff > 0.005 : result.psnr === Infinity && otherPsnr !== Infinity

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <span className="text-[13px] text-ink-2">PSNR</span>
        <span className="text-[28px] leading-none font-semibold tabular-nums" data-testid="psnr">
          {formatPsnr(result.psnr)}
        </span>
        {better && (
          <span className="text-[12.5px] text-ink-2">
            {Number.isFinite(diff) ? `на ${formatNumber(diff)} дБ вище` : 'вище'}
          </span>
        )}
      </div>

      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[13px]">
        <Row label="Збережено коефіцієнтів" testId="kept">
          {formatInteger(result.kept)} <span className="text-ink-3">({formatPercent(result.kept / result.total)})</span>
        </Row>
        <Row label="MSE">{formatNumber(result.mse)}</Row>
        <Row label="CR за коефіцієнтами" hint="N / кількість ненульових коефіцієнтів">
          {formatRatio(coefficientRatio(result))}
        </Row>
        <Row label="Оцінка розміру" hint="Цілі коефіцієнти у порядку частот → varint → DEFLATE">
          {size ? (
            <>
              {formatBytes(size.bytes)} <span className="text-ink-3">({formatBpp(size.bitsPerPixel)} біт/пікс)</span>
            </>
          ) : (
            <Pending />
          )}
        </Row>
        <Row label="CR за розміром" hint="Розмір без стиснення (1 байт на піксель) / оцінка розміру">
          {size ? formatRatio(size.ratio) : <Pending />}
        </Row>
      </dl>
    </div>
  )
}

export function OriginalMetrics({ width, height, note }: { width: number; height: number; note?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <span className="text-[13px] text-ink-2">Еталон</span>
        <span className="text-[28px] leading-none font-semibold tabular-nums">
          {width}×{height}
        </span>
      </div>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[13px]">
        <Row label="Пікселів">{formatInteger(width * height)}</Row>
        <Row label="Глибина">8 біт, відтінки сірого</Row>
        <Row label="Без стиснення">{formatBytes(width * height)}</Row>
      </dl>
      {note && <p className="text-[12.5px] leading-relaxed text-ink-3">{note}</p>}
    </div>
  )
}

function Row({ label, hint, testId, children }: { label: string; hint?: string; testId?: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-2" title={hint}>
        {label}
      </dt>
      <dd className="text-right tabular-nums" data-testid={testId}>
        {children}
      </dd>
    </>
  )
}

function Pending() {
  return <span className="text-ink-3">рахую…</span>
}
