import { useEffect, useState } from 'react'
import type { CompressionMethod } from '../core/compression'
import type { GrayImage } from '../core/image'
import { estimateSize, runMethod, type MethodResult, type PreparedTransform, type SizeEstimate } from '../core/pipeline'

export interface ExperimentRow {
  value: number
  dct: MethodResult
  dwt: MethodResult
  dctSize: SizeEstimate
  dwtSize: SizeEstimate
}

/**
 * Серія експериментів для обраного способу стиснення: кожен рівень із presets — обидва методи.
 * Рядки рахуються по одному з паузою між ними, щоб інтерфейс не завмирав.
 */
export function useExperiments(
  image: GrayImage,
  dct: PreparedTransform,
  dwt: PreparedTransform,
  method: CompressionMethod,
  presets: number[]
): { rows: ExperimentRow[]; done: boolean } {
  const [state, setState] = useState<{ key: unknown[]; rows: ExperimentRow[]; done: boolean }>({
    key: [],
    rows: [],
    done: false
  })
  const key = [image, dct, dwt, method, presets]

  useEffect(() => {
    let cancelled = false
    const rows: ExperimentRow[] = []
    setState({ key, rows: [], done: false })

    void (async () => {
      for (const value of presets) {
        await new Promise((resolve) => setTimeout(resolve, 0))
        if (cancelled) return
        const params = { method, value }
        const dctResult = runMethod(dct, image, params)
        const dwtResult = runMethod(dwt, image, params)
        const [dctSize, dwtSize] = await Promise.all([estimateSize(dctResult), estimateSize(dwtResult)])
        if (cancelled) return
        rows.push({ value, dct: dctResult, dwt: dwtResult, dctSize, dwtSize })
        setState({ key, rows: [...rows], done: rows.length === presets.length })
      }
    })()

    return () => {
      cancelled = true
    }
  }, key) // key містить усі залежності ефекту

  const fresh = state.key.length === key.length && state.key.every((item, i) => item === key[i])
  return fresh ? { rows: state.rows, done: state.done } : { rows: [], done: false }
}
