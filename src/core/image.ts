/**
 * Зображення у відтінках сірого. Значення пікселів — дійсні числа (0..255 для вхідних даних),
 * зберігаються рядок за рядком: піксель (x, y) має індекс y * width + x.
 */
export interface GrayImage {
  width: number
  height: number
  data: Float64Array
}

export function createImage(width: number, height: number, data?: Float64Array): GrayImage {
  const size = width * height
  if (data && data.length !== size) {
    throw new Error(`Розмір даних ${data.length} не відповідає ${width}×${height}`)
  }
  return { width, height, data: data ?? new Float64Array(size) }
}

export function cloneImage(image: GrayImage): GrayImage {
  return { width: image.width, height: image.height, data: image.data.slice() }
}

/** Яскравість за ITU-R BT.601 — стандартне перетворення RGB → відтінки сірого. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** Обрізання до 0..255 і округлення до цілого — так зображення зберігається у 8-бітному файлі. */
export function toUint8(image: GrayImage): Uint8ClampedArray {
  const out = new Uint8ClampedArray(image.data.length)
  for (let i = 0; i < image.data.length; i++) out[i] = Math.round(image.data[i])
  return out
}

/** Зсув рівня (як у JPEG): значення 0..255 → −128..127, щоб коефіцієнти були симетричні відносно нуля. */
export const LEVEL_SHIFT = 128

export function shiftLevel(image: GrayImage, delta: number): GrayImage {
  const data = new Float64Array(image.data.length)
  for (let i = 0; i < data.length; i++) data[i] = image.data[i] + delta
  return { width: image.width, height: image.height, data }
}
