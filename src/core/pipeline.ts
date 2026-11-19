import { compress, sortMagnitudes, type CompressionParams } from './compression'
import { BLOCK, forwardDct, inverseDct, zigzagOrder } from './dct'
import { estimateEncodedBytes } from './encoding'
import { forwardHaar, inverseHaar, subbandOrder } from './haar'
import { LEVEL_SHIFT, shiftLevel, toUint8, type GrayImage } from './image'
import { mse, psnr } from './metrics'

/**
 * Повний цикл для одного методу:
 *   зсув рівня → пряме перетворення → стиснення коефіцієнтів → обернене перетворення
 *   → зворотний зсув → 8-бітне зображення → MSE / PSNR.
 *
 * Пряме перетворення не залежить від рівня стиснення, тому рахується один раз (prepare*),
 * а при русі слайдера виконуються лише стиснення та обернене перетворення.
 */

export type TransformKind = 'dct' | 'dwt'

export interface PreparedTransform {
  kind: TransformKind
  width: number
  height: number
  /** Коефіцієнти до стиснення. */
  coefficients: GrayImage
  /** Порядок обходу від низьких частот до високих — для оцінки розміру файлу. */
  scanOrder: Int32Array
  inverse: (coeffs: GrayImage) => GrayImage
  /** Кеш відсортованих |c| для методу 'topk' (рахується при першому зверненні). */
  sortedMagnitudes?: Float64Array
}

export function prepareDct(image: GrayImage): PreparedTransform {
  return {
    kind: 'dct',
    width: image.width,
    height: image.height,
    coefficients: forwardDct(shiftLevel(image, -LEVEL_SHIFT)),
    scanOrder: dctScanOrder(image.width, image.height),
    inverse: inverseDct
  }
}

export function prepareHaar(image: GrayImage, levels: number): PreparedTransform {
  return {
    kind: 'dwt',
    width: image.width,
    height: image.height,
    coefficients: forwardHaar(shiftLevel(image, -LEVEL_SHIFT), levels),
    scanOrder: Int32Array.from(subbandOrder(image.width, image.height, levels)),
    inverse: (coeffs) => inverseHaar(coeffs, levels)
  }
}

export interface MethodResult {
  kind: TransformKind
  params: CompressionParams
  /** Коефіцієнти після стиснення. */
  coefficients: GrayImage
  /** Відновлене зображення, 8 біт (те, що показується і зберігається). */
  pixels: Uint8ClampedArray
  kept: number
  total: number
  mse: number
  psnr: number
  symbols: Int32Array
  scanOrder: Int32Array
}

export function runMethod(prepared: PreparedTransform, original: GrayImage, params: CompressionParams): MethodResult {
  if (params.method === 'topk') prepared.sortedMagnitudes ??= sortMagnitudes(prepared.coefficients.data)
  const { coeffs, kept, symbols } = compress(prepared.coefficients.data, params, prepared.sortedMagnitudes)
  const coefficients: GrayImage = { width: prepared.width, height: prepared.height, data: coeffs }
  const restored = shiftLevel(prepared.inverse(coefficients), LEVEL_SHIFT)
  const pixels = toUint8(restored)
  const error = mse(original.data, pixels)

  return {
    kind: prepared.kind,
    params,
    coefficients,
    pixels,
    kept,
    total: coeffs.length,
    mse: error,
    psnr: psnr(error),
    symbols,
    scanOrder: prepared.scanOrder
  }
}

export interface SizeEstimate {
  bytes: number
  /** Біт на піксель; оригінал — 8. */
  bitsPerPixel: number
  /** Розмір оригіналу (1 байт на піксель) / оцінений розмір. */
  ratio: number
}

export async function estimateSize(result: MethodResult): Promise<SizeEstimate> {
  const bytes = await estimateEncodedBytes(result.symbols, result.scanOrder)
  return { bytes, bitsPerPixel: (8 * bytes) / result.total, ratio: result.total / bytes }
}

/** Коефіцієнт стиснення за кількістю коефіцієнтів: N / (кількість ненульових). */
export function coefficientRatio(result: Pick<MethodResult, 'kept' | 'total'>): number {
  return result.kept === 0 ? Number.POSITIVE_INFINITY : result.total / result.kept
}

/** Блок за блоком (по рядках), усередині блока — зигзаг. */
export function dctScanOrder(width: number, height: number): Int32Array {
  const zigzag = zigzagOrder(BLOCK)
  const order = new Int32Array(width * height)
  let p = 0
  for (let by = 0; by < height; by += BLOCK) {
    for (let bx = 0; bx < width; bx += BLOCK) {
      for (const cell of zigzag) {
        const y = Math.floor(cell / BLOCK)
        const x = cell % BLOCK
        order[p++] = (by + y) * width + bx + x
      }
    }
  }
  return order
}
