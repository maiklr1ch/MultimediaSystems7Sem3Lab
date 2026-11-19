/** Перетворення масивів значень у пікселі для показу на canvas. */

export function drawGray(canvas: HTMLCanvasElement, width: number, height: number, pixels: ArrayLike<number>): void {
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(width, height)
  const rgba = imageData.data
  for (let i = 0; i < width * height; i++) {
    const v = pixels[i]
    rgba[4 * i] = v
    rgba[4 * i + 1] = v
    rgba[4 * i + 2] = v
    rgba[4 * i + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
}

/**
 * Коефіцієнти в логарифмічній шкалі: log(1 + |c|) / log(1 + max|c|).
 * Без логарифма було б видно лише DC / LL — решта коефіцієнтів на порядки менші.
 * Обнулені коефіцієнти — чорні.
 */
export function coefficientView(coeffs: Float64Array, reference: Float64Array = coeffs): Uint8ClampedArray {
  let max = 0
  for (let i = 0; i < reference.length; i++) max = Math.max(max, Math.abs(reference[i]))
  const scale = max > 0 ? 255 / Math.log1p(max) : 0
  const out = new Uint8ClampedArray(coeffs.length)
  for (let i = 0; i < coeffs.length; i++) out[i] = Math.log1p(Math.abs(coeffs[i])) * scale
  return out
}

export const ERROR_GAIN = 4

/** Різниця з оригіналом, підсилена в ERROR_GAIN разів: сірий 128 — немає похибки. */
export function errorView(original: Float64Array, restored: ArrayLike<number>): Uint8ClampedArray {
  const out = new Uint8ClampedArray(original.length)
  for (let i = 0; i < original.length; i++) out[i] = 128 + ERROR_GAIN * (restored[i] - original[i])
  return out
}

/** Квадратний фрагмент size×size з центром у (cx, cy), обмежений межами зображення. */
export function crop(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  cx: number,
  cy: number,
  size: number
): Uint8ClampedArray {
  const x0 = Math.min(width - size, Math.max(0, Math.round(cx - size / 2)))
  const y0 = Math.min(height - size, Math.max(0, Math.round(cy - size / 2)))
  const out = new Uint8ClampedArray(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) out[y * size + x] = pixels[(y0 + y) * width + x0 + x]
  }
  return out
}

export function downloadPng(pixels: ArrayLike<number>, width: number, height: number, filename: string): void {
  const canvas = document.createElement('canvas')
  drawGray(canvas, width, height, pixels)
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}
