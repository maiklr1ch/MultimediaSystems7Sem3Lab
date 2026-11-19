import { describe, expect, test } from 'vitest'
import { hardThreshold, keepLargest, quantize } from '../src/core/compression'
import { BLOCK, dctMatrix, forwardDct, forwardDctBlock, inverseDct, zigzagOrder } from '../src/core/dct'
import { deflateSize, serializeSymbols } from '../src/core/encoding'
import { forwardHaar, inverseHaar, maxHaarLevels, subbandOrder } from '../src/core/haar'
import { createImage, type GrayImage } from '../src/core/image'
import { identity, maxAbsDiff, multiply, transpose } from '../src/core/matrix'
import { mse, psnr } from '../src/core/metrics'
import { dctScanOrder, prepareDct, prepareHaar, runMethod } from '../src/core/pipeline'

/** Детермінований генератор псевдовипадкових чисел (mulberry32), щоб тести були відтворювані. */
function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomImage(width: number, height: number, seed = 1): GrayImage {
  const random = rng(seed)
  const image = createImage(width, height)
  for (let i = 0; i < image.data.length; i++) image.data[i] = Math.floor(random() * 256)
  return image
}

const energy = (data: ArrayLike<number>): number => {
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
  return sum
}

describe('DCT', () => {
  test('матриця C ортонормована: C · Cᵀ = I', () => {
    const c = dctMatrix(BLOCK)
    expect(maxAbsDiff(multiply(c, transpose(c, BLOCK), BLOCK), identity(BLOCK))).toBeLessThan(1e-12)
  })

  test('матричне C·B·Cᵀ збігається з формулою DCT-II у вигляді подвійної суми', () => {
    const random = rng(7)
    const block = Float64Array.from({ length: 64 }, () => random() * 255 - 128)
    const fast = forwardDctBlock(block)
    const alpha = (k: number) => (k === 0 ? Math.sqrt(1 / 8) : Math.sqrt(2 / 8))
    for (let u = 0; u < 8; u++) {
      for (let v = 0; v < 8; v++) {
        let sum = 0
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            sum +=
              block[y * 8 + x] * Math.cos(((2 * y + 1) * u * Math.PI) / 16) * Math.cos(((2 * x + 1) * v * Math.PI) / 16)
          }
        }
        expect(fast[u * 8 + v]).toBeCloseTo(alpha(u) * alpha(v) * sum, 9)
      }
    }
  })

  test('сталий блок має лише DC-коефіцієнт, рівний 8 · значення', () => {
    const coeffs = forwardDctBlock(new Float64Array(64).fill(10))
    expect(coeffs[0]).toBeCloseTo(80, 10)
    for (let i = 1; i < 64; i++) expect(Math.abs(coeffs[i])).toBeLessThan(1e-12)
  })

  test('обернене DCT точно відновлює зображення', () => {
    const image = randomImage(64, 48)
    expect(maxAbsDiff(inverseDct(forwardDct(image)).data, image.data)).toBeLessThan(1e-9)
  })

  test('розміри, не кратні 8, відхиляються', () => {
    expect(() => forwardDct(createImage(20, 16))).toThrow()
  })

  test('зигзаг-порядок збігається з JPEG', () => {
    expect(zigzagOrder().slice(0, 16)).toEqual([0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5])
    expect(new Set(zigzagOrder()).size).toBe(64)
  })
})

describe('Хаар', () => {
  test('один рівень на 2×2: LL, HL, LH, HH за формулами', () => {
    const [a, b, c, d] = [10, 4, 6, 2]
    const out = forwardHaar(createImage(2, 2, Float64Array.from([a, b, c, d])), 1).data
    expect(out[0]).toBeCloseTo((a + b + c + d) / 2, 12) // LL
    expect(out[1]).toBeCloseTo((a - b + c - d) / 2, 12) // HL
    expect(out[2]).toBeCloseTo((a + b - c - d) / 2, 12) // LH
    expect(out[3]).toBeCloseTo((a - b - c + d) / 2, 12) // HH
  })

  test('обернене перетворення точно відновлює зображення на всіх рівнях', () => {
    const image = randomImage(64, 32, 3)
    for (let levels = 1; levels <= maxHaarLevels(64, 32); levels++) {
      expect(maxAbsDiff(inverseHaar(forwardHaar(image, levels), levels).data, image.data)).toBeLessThan(1e-9)
    }
  })

  test('кількість рівнів обмежена розміром', () => {
    expect(maxHaarLevels(512, 512)).toBe(9)
    expect(maxHaarLevels(96, 64)).toBe(5)
    expect(() => forwardHaar(createImage(8, 8), 4)).toThrow()
  })

  test('порядок підсмуг — перестановка всіх коефіцієнтів', () => {
    const order = subbandOrder(32, 16, 3)
    expect(order.length).toBe(512)
    expect(new Set(order).size).toBe(512)
    expect(order[0]).toBe(0)
  })
})

describe('Рівність Парсеваля', () => {
  const image = randomImage(64, 64, 11)

  test('обидва перетворення зберігають енергію', () => {
    expect(energy(forwardDct(image).data) / energy(image.data)).toBeCloseTo(1, 10)
    expect(energy(forwardHaar(image, 4).data) / energy(image.data)).toBeCloseTo(1, 10)
  })

  test('похибка відновлення = енергія відкинутих коефіцієнтів', () => {
    const cases = [
      { forward: forwardDct, inverse: inverseDct },
      { forward: (i: GrayImage) => forwardHaar(i, 4), inverse: (c: GrayImage) => inverseHaar(c, 4) }
    ]
    for (const { forward, inverse } of cases) {
      const coeffs = forward(image)
      const kept = keepLargest(coeffs.data, 0.1)
      const restored = inverse(createImage(64, 64, kept.coeffs))
      let dropped = 0
      for (let i = 0; i < coeffs.data.length; i++) dropped += (coeffs.data[i] - kept.coeffs[i]) ** 2
      let pixelError = 0
      for (let i = 0; i < image.data.length; i++) pixelError += (image.data[i] - restored.data[i]) ** 2
      expect(pixelError / dropped).toBeCloseTo(1, 9)
    }
  })
})

describe('Стиснення коефіцієнтів', () => {
  test('частка найбільших: рівно k коефіцієнтів, навіть за однакових модулів', () => {
    const coeffs = Float64Array.from([3, -3, 3, 1, 0, 2])
    const { coeffs: out, kept } = keepLargest(coeffs, 0.5)
    expect(kept).toBe(3)
    expect(Array.from(out)).toEqual([3, -3, 3, 0, 0, 0])
    expect(keepLargest(coeffs, 0).kept).toBe(0)
    expect(keepLargest(coeffs, 1).kept).toBe(5) // нуль лишається нулем
  })

  test('поріг: обнуляються |c| < T', () => {
    const { coeffs, kept } = hardThreshold(Float64Array.from([5, -2, 1.5, -7]), 2)
    expect(Array.from(coeffs)).toEqual([5, -2, 0, -7])
    expect(kept).toBe(3)
  })

  test('квантування: q = round(c / Δ), ĉ = q · Δ', () => {
    const { coeffs, symbols, kept } = quantize(Float64Array.from([9, -26, 4, 0.4]), 10)
    expect(Array.from(symbols)).toEqual([1, -3, 0, 0])
    expect(Array.from(coeffs)).toEqual([10, -30, 0, 0])
    expect(kept).toBe(2)
    expect(() => quantize(new Float64Array(1), 0)).toThrow()
  })
})

describe('Метрики та повний цикл', () => {
  test('PSNR', () => {
    expect(psnr(0)).toBe(Number.POSITIVE_INFINITY)
    expect(psnr(1)).toBeCloseTo(48.1308, 4)
    expect(psnr(mse([0, 0], [255, 255]))).toBeCloseTo(0, 10)
  })

  test('без відкидання коефіцієнтів обидва методи відновлюють оригінал точно (PSNR = ∞)', () => {
    const image = randomImage(64, 64, 5)
    const params = { method: 'topk' as const, value: 1 }
    expect(runMethod(prepareDct(image), image, params).psnr).toBe(Number.POSITIVE_INFINITY)
    expect(runMethod(prepareHaar(image, 3), image, params).psnr).toBe(Number.POSITIVE_INFINITY)
  })

  test('сильніше стиснення → менше коефіцієнтів і нижчий PSNR', () => {
    const image = randomImage(64, 64, 9)
    const prepared = prepareDct(image)
    const mild = runMethod(prepared, image, { method: 'topk', value: 0.5 })
    const strong = runMethod(prepared, image, { method: 'topk', value: 0.05 })
    expect(strong.kept).toBeLessThan(mild.kept)
    expect(strong.psnr).toBeLessThan(mild.psnr)
  })

  test('порядок обходу DCT — перестановка, що починається з DC першого блока', () => {
    const order = dctScanOrder(16, 8)
    expect(new Set(order).size).toBe(128)
    expect(Array.from(order.slice(0, 3))).toEqual([0, 1, 16])
  })
})

describe('Оцінка розміру', () => {
  test('zigzag-varint: малі числа займають 1 байт', () => {
    const bytes = serializeSymbols(Int32Array.from([0, -1, 1, 63, -64, 64]), [0, 1, 2, 3, 4, 5])
    expect(Array.from(bytes)).toEqual([0, 1, 2, 126, 127, 128, 1])
  })

  test('нулі стискаються майже до нуля, шум — ні', async () => {
    const zeros = await deflateSize(new Uint8Array(100_000))
    const random = rng(1)
    const noise = await deflateSize(Uint8Array.from({ length: 100_000 }, () => Math.floor(random() * 256)))
    expect(zeros).toBeLessThan(200)
    expect(noise).toBeGreaterThan(99_000)
  })
})
