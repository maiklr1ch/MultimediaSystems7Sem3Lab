import { cloneImage, type GrayImage } from './image'

/**
 * Дискретне вейвлет-перетворення Хаара (ортонормоване), двовимірне, багаторівневе.
 *
 * Один крок для пари сусідніх значень (a, b):
 *   апроксимація  s = (a + b) / √2      — "середнє", низькі частоти
 *   деталь        d = (a − b) / √2      — "різниця", високі частоти
 * Обернений крок:  a = (s + d) / √2,  b = (s − d) / √2.
 *
 * Множник 1/√2 робить перетворення ортонормованим (матриця Хаара H: H · Hᵀ = I),
 * тому, як і для DCT, енергія зберігається (рівність Парсеваля), і коефіцієнти обох методів
 * мають однаковий масштаб — їх можна чесно порівнювати одним порогом чи кроком квантування.
 *
 * Рівень 2D: спершу перетворюємо кожен рядок, потім кожен стовпець області.
 * Результат — розкладка Маллата:
 *   ┌────┬────┐
 *   │ LL │ HL │   LL — зменшена копія зображення (на ній робиться наступний рівень)
 *   ├────┼────┤   HL, LH, HH — деталі: вертикальні межі, горизонтальні межі, діагоналі
 *   │ LH │ HH │
 *   └────┴────┘
 */
const INV_SQRT2 = 1 / Math.SQRT2

/** Один крок 1D для `length` елементів, що йдуть із кроком `stride` починаючи з `offset`. */
function forwardStep(data: Float64Array, offset: number, stride: number, length: number, tmp: Float64Array): void {
  const half = length / 2
  for (let i = 0; i < half; i++) {
    const a = data[offset + 2 * i * stride]
    const b = data[offset + (2 * i + 1) * stride]
    tmp[i] = (a + b) * INV_SQRT2
    tmp[half + i] = (a - b) * INV_SQRT2
  }
  for (let i = 0; i < length; i++) data[offset + i * stride] = tmp[i]
}

function inverseStep(data: Float64Array, offset: number, stride: number, length: number, tmp: Float64Array): void {
  const half = length / 2
  for (let i = 0; i < half; i++) {
    const s = data[offset + i * stride]
    const d = data[offset + (half + i) * stride]
    tmp[2 * i] = (s + d) * INV_SQRT2
    tmp[2 * i + 1] = (s - d) * INV_SQRT2
  }
  for (let i = 0; i < length; i++) data[offset + i * stride] = tmp[i]
}

/** Скільки рівнів можна зробити для цього розміру: кожна сторона має ділитися на 2^levels. */
export function maxHaarLevels(width: number, height: number): number {
  let levels = 0
  while (width % 2 === 0 && height % 2 === 0 && width > 1 && height > 1) {
    width /= 2
    height /= 2
    levels++
  }
  return levels
}

function assertLevels(image: GrayImage, levels: number): void {
  const max = maxHaarLevels(image.width, image.height)
  if (!Number.isInteger(levels) || levels < 1 || levels > max) {
    throw new Error(`Для ${image.width}×${image.height} можна від 1 до ${max} рівнів Хаара, отримано ${levels}`)
  }
}

export function forwardHaar(image: GrayImage, levels: number): GrayImage {
  assertLevels(image, levels)
  const result = cloneImage(image)
  const { width, data } = result
  const tmp = new Float64Array(Math.max(image.width, image.height))

  let w = image.width
  let h = image.height
  for (let level = 0; level < levels; level++) {
    for (let y = 0; y < h; y++) forwardStep(data, y * width, 1, w, tmp) // рядки
    for (let x = 0; x < w; x++) forwardStep(data, x, width, h, tmp) // стовпці
    w /= 2
    h /= 2
  }
  return result
}

export function inverseHaar(coeffs: GrayImage, levels: number): GrayImage {
  assertLevels(coeffs, levels)
  const result = cloneImage(coeffs)
  const { width, data } = result
  const tmp = new Float64Array(Math.max(coeffs.width, coeffs.height))

  // від найгрубшого рівня до найдрібнішого, у зворотному порядку: спершу стовпці, потім рядки
  for (let level = levels - 1; level >= 0; level--) {
    const w = coeffs.width >> level
    const h = coeffs.height >> level
    for (let x = 0; x < w; x++) inverseStep(data, x, width, h, tmp)
    for (let y = 0; y < h; y++) inverseStep(data, y * width, 1, w, tmp)
  }
  return result
}

/**
 * Порядок обходу коефіцієнтів від грубих до дрібних: LL, потім HL/LH/HH найглибшого рівня, …,
 * HL/LH/HH першого рівня. Використовується для серіалізації при оцінці розміру файлу.
 */
export function subbandOrder(width: number, height: number, levels: number): number[] {
  const order: number[] = []
  const pushRect = (x0: number, y0: number, w: number, h: number): void => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) order.push(y * width + x)
  }
  const lw = width >> levels
  const lh = height >> levels
  pushRect(0, 0, lw, lh)
  for (let level = levels; level >= 1; level--) {
    const w = width >> level
    const h = height >> level
    pushRect(w, 0, w, h) // HL
    pushRect(0, h, w, h) // LH
    pushRect(w, h, w, h) // HH
  }
  return order
}
