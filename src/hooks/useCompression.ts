import { useEffect, useMemo, useState } from 'react'
import type { CompressionParams } from '../core/compression'
import type { GrayImage } from '../core/image'
import {
  estimateSize,
  prepareDct,
  prepareHaar,
  runMethod,
  type MethodResult,
  type PreparedTransform,
  type SizeEstimate
} from '../core/pipeline'

export interface ComparisonState {
  dct: PreparedTransform
  dwt: PreparedTransform
  dctResult: MethodResult
  dwtResult: MethodResult
  /** Оцінки розміру рахуються асинхронно (DEFLATE), тому можуть ще бути відсутні. */
  dctSize?: SizeEstimate
  dwtSize?: SizeEstimate
}

/**
 * Пряме перетворення залежить лише від зображення (і кількості рівнів Хаара),
 * тому кешується; при зміні рівня стиснення перераховуються лише стиснення та обернене перетворення.
 */
export function useCompression(image: GrayImage, haarLevels: number, params: CompressionParams): ComparisonState {
  const dct = useMemo(() => prepareDct(image), [image])
  const dwt = useMemo(() => prepareHaar(image, haarLevels), [image, haarLevels])

  const dctResult = useMemo(() => runMethod(dct, image, params), [dct, image, params])
  const dwtResult = useMemo(() => runMethod(dwt, image, params), [dwt, image, params])

  const [sizes, setSizes] = useState<{ for: [MethodResult, MethodResult]; dct: SizeEstimate; dwt: SizeEstimate }>()

  useEffect(() => {
    let cancelled = false
    // невелика затримка: під час перетягування слайдера не стискаємо кожне проміжне значення
    const timer = setTimeout(async () => {
      const [dctSize, dwtSize] = await Promise.all([estimateSize(dctResult), estimateSize(dwtResult)])
      if (!cancelled) setSizes({ for: [dctResult, dwtResult], dct: dctSize, dwt: dwtSize })
    }, 120)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [dctResult, dwtResult])

  const fresh = sizes && sizes.for[0] === dctResult && sizes.for[1] === dwtResult

  return {
    dct,
    dwt,
    dctResult,
    dwtResult,
    dctSize: fresh ? sizes.dct : undefined,
    dwtSize: fresh ? sizes.dwt : undefined
  }
}
