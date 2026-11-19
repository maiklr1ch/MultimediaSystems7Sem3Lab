/**
 * Зменшення кількості значущих коефіцієнтів. Один і той самий код працює для DCT і для Хаара:
 * обидва перетворення ортонормовані, тому коефіцієнти мають однаковий масштаб.
 *
 * Чому це "стиснення": після перетворення енергія зображення зосереджена в невеликій кількості
 * коефіцієнтів (низькі частоти). Решта близькі до нуля — їх можна відкинути з малою похибкою.
 * Для ортонормованого перетворення похибка точно дорівнює енергії відкинутого (рівність Парсеваля):
 *   Σ (x − x̂)²  =  Σ (c − ĉ)²
 * Тому відкидання найменших за модулем коефіцієнтів — оптимальне за MSE для заданої їх кількості.
 */

export type CompressionMethod = 'topk' | 'threshold' | 'quantize'

export interface CompressionParams {
  method: CompressionMethod
  /**
   * topk      — частка коефіцієнтів, яку зберігаємо (0..1];
   * threshold — поріг T: обнуляємо всі |c| < T;
   * quantize  — крок рівномірного квантування Δ.
   */
  value: number
}

export interface CompressedCoefficients {
  coeffs: Float64Array
  /** Кількість ненульових коефіцієнтів після стиснення. */
  kept: number
  /**
   * Цілі числа, які записувались би у файл: для квантування — індекси round(c / Δ),
   * для інших методів — збережені коефіцієнти, округлені до цілих.
   */
  symbols: Int32Array
}

/**
 * @param sortedMagnitudes відсортовані за зростанням |c| — необов'язковий кеш для 'topk',
 *        щоб при русі слайдера не сортувати коефіцієнти щоразу заново.
 */
export function compress(
  coeffs: Float64Array,
  params: CompressionParams,
  sortedMagnitudes?: Float64Array
): CompressedCoefficients {
  switch (params.method) {
    case 'topk':
      return keepLargest(coeffs, params.value, sortedMagnitudes)
    case 'threshold':
      return hardThreshold(coeffs, params.value)
    case 'quantize':
      return quantize(coeffs, params.value)
  }
}

/** Зберігає рівно round(fraction · N) найбільших за модулем коефіцієнтів, решту обнуляє. */
export function keepLargest(
  coeffs: Float64Array,
  fraction: number,
  sortedMagnitudes: Float64Array = sortMagnitudes(coeffs)
): CompressedCoefficients {
  const n = coeffs.length
  const k = Math.min(n, Math.max(0, Math.round(fraction * n)))
  const out = new Float64Array(n)
  if (k === 0) return finish(out)

  // k-й найбільший модуль — це поріг.
  const threshold = sortedMagnitudes[n - k]

  // Коефіцієнти, рівні порогу, беремо лише стільки, щоб разом вийшло рівно k.
  let strictlyAbove = 0
  for (let i = 0; i < n; i++) if (Math.abs(coeffs[i]) > threshold) strictlyAbove++
  let equalAllowed = k - strictlyAbove

  for (let i = 0; i < n; i++) {
    const magnitude = Math.abs(coeffs[i])
    if (magnitude > threshold) {
      out[i] = coeffs[i]
    } else if (magnitude === threshold && equalAllowed > 0) {
      out[i] = coeffs[i]
      equalAllowed--
    }
  }
  return finish(out)
}

/** Модулі коефіцієнтів, відсортовані за зростанням. */
export function sortMagnitudes(coeffs: Float64Array): Float64Array {
  return Float64Array.from(coeffs, Math.abs).sort()
}

/** Жорсткий поріг: обнуляє всі коефіцієнти з |c| < T, решту залишає без змін. */
export function hardThreshold(coeffs: Float64Array, threshold: number): CompressedCoefficients {
  const out = new Float64Array(coeffs.length)
  for (let i = 0; i < coeffs.length; i++) {
    if (Math.abs(coeffs[i]) >= threshold) out[i] = coeffs[i]
  }
  return finish(out)
}

/**
 * Рівномірне квантування з кроком Δ: q = round(c / Δ), відновлене ĉ = q · Δ.
 * Коефіцієнти з |c| < Δ/2 стають нулями — саме так квантування зменшує кількість значущих коефіцієнтів.
 * Похибка кожного коефіцієнта не перевищує Δ/2.
 */
export function quantize(coeffs: Float64Array, step: number): CompressedCoefficients {
  if (!(step > 0)) throw new Error('Крок квантування має бути додатним')
  const out = new Float64Array(coeffs.length)
  const symbols = new Int32Array(coeffs.length)
  let kept = 0
  for (let i = 0; i < coeffs.length; i++) {
    const q = Math.round(coeffs[i] / step)
    symbols[i] = q
    out[i] = q * step
    if (q !== 0) kept++
  }
  return { coeffs: out, kept, symbols }
}

function finish(out: Float64Array): CompressedCoefficients {
  const symbols = new Int32Array(out.length)
  let kept = 0
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== 0) kept++
    symbols[i] = Math.round(out[i])
  }
  return { coeffs: out, kept, symbols }
}
