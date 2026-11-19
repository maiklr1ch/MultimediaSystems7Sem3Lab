import { createImage, type GrayImage } from './image'
import { multiply, transpose, type Matrix } from './matrix'

/**
 * Дискретне косинусне перетворення (DCT-II) у матричному поданні.
 *
 * Матриця C розміру N×N:
 *   C[k][n] = α(k) · cos( π(2n + 1)k / 2N ),   α(0) = √(1/N),  α(k) = √(2/N) для k > 0
 *
 * C ортонормована (C · Cᵀ = I), тому для блока B:
 *   пряме:     F = C · B · Cᵀ
 *   обернене:  B = Cᵀ · F · C
 *
 * Рядок k матриці — косинус частоти k, тож F[u][v] показує, скільки в блоці
 * "вертикальної частоти u" і "горизонтальної частоти v". F[0][0] — DC, середнє значення блока × N.
 */
export const BLOCK = 8

export function dctMatrix(n: number = BLOCK): Matrix {
  const c = new Float64Array(n * n)
  for (let k = 0; k < n; k++) {
    const alpha = k === 0 ? Math.sqrt(1 / n) : Math.sqrt(2 / n)
    for (let x = 0; x < n; x++) {
      c[k * n + x] = alpha * Math.cos((Math.PI * (2 * x + 1) * k) / (2 * n))
    }
  }
  return c
}

const C = dctMatrix(BLOCK)
const CT = transpose(C, BLOCK)

/** F = C · B · Cᵀ для одного блока 8×8. */
export function forwardDctBlock(block: Matrix, out: Matrix = new Float64Array(BLOCK * BLOCK)): Matrix {
  const tmp = multiply(C, block, BLOCK)
  return multiply(tmp, CT, BLOCK, out)
}

/** B = Cᵀ · F · C для одного блока 8×8. */
export function inverseDctBlock(coeffs: Matrix, out: Matrix = new Float64Array(BLOCK * BLOCK)): Matrix {
  const tmp = multiply(CT, coeffs, BLOCK)
  return multiply(tmp, C, BLOCK, out)
}

export function assertBlockAligned(image: GrayImage): void {
  if (image.width % BLOCK !== 0 || image.height % BLOCK !== 0) {
    throw new Error(`Розміри зображення мають бути кратні ${BLOCK}, отримано ${image.width}×${image.height}`)
  }
}

/**
 * Застосовує перетворення до кожного блока 8×8.
 * Результат має ту саму розкладку, що й зображення: коефіцієнти блока лежать на місці його пікселів.
 */
function mapBlocks(image: GrayImage, transform: (block: Matrix, out: Matrix) => Matrix): GrayImage {
  assertBlockAligned(image)
  const { width, height, data } = image
  const result = createImage(width, height)
  const block = new Float64Array(BLOCK * BLOCK)
  const transformed = new Float64Array(BLOCK * BLOCK)

  for (let by = 0; by < height; by += BLOCK) {
    for (let bx = 0; bx < width; bx += BLOCK) {
      for (let y = 0; y < BLOCK; y++) {
        for (let x = 0; x < BLOCK; x++) block[y * BLOCK + x] = data[(by + y) * width + bx + x]
      }
      transform(block, transformed)
      for (let y = 0; y < BLOCK; y++) {
        for (let x = 0; x < BLOCK; x++) result.data[(by + y) * width + bx + x] = transformed[y * BLOCK + x]
      }
    }
  }
  return result
}

export function forwardDct(image: GrayImage): GrayImage {
  return mapBlocks(image, forwardDctBlock)
}

export function inverseDct(coeffs: GrayImage): GrayImage {
  return mapBlocks(coeffs, inverseDctBlock)
}

/**
 * Зигзаг-порядок (як у JPEG): від низьких частот до високих.
 * Використовується для серіалізації коефіцієнтів блока при оцінці розміру файлу —
 * нулі високих частот опиняються в кінці і добре стискаються.
 */
export function zigzagOrder(n: number = BLOCK): number[] {
  const order: number[] = []
  for (let s = 0; s < 2 * n - 1; s++) {
    const cells: number[] = []
    for (let y = 0; y < n; y++) {
      const x = s - y
      if (x >= 0 && x < n) cells.push(y * n + x)
    }
    // на парних діагоналях рух знизу вгору, на непарних — згори вниз
    order.push(...(s % 2 === 0 ? cells.reverse() : cells))
  }
  return order
}
