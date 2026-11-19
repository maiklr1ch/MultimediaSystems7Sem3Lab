/** Пікове значення для 8-бітних зображень. */
export const PEAK = 255

/** Середньоквадратична похибка між оригіналом і відновленим 8-бітним зображенням. */
export function mse(original: ArrayLike<number>, restored: ArrayLike<number>): number {
  if (original.length !== restored.length) throw new Error('Зображення різного розміру')
  let sum = 0
  for (let i = 0; i < original.length; i++) {
    const d = original[i] - restored[i]
    sum += d * d
  }
  return sum / original.length
}

/**
 * PSNR = 10 · log₁₀(255² / MSE), у децибелах.
 * Для однакових зображень MSE = 0, і PSNR = +∞.
 * Орієнтири для 8-бітних зображень: > 40 дБ — різницю майже не видно, 30–40 — помітна при збільшенні,
 * < 25 — артефакти очевидні.
 */
export function psnr(mseValue: number): number {
  return mseValue === 0 ? Number.POSITIVE_INFINITY : 10 * Math.log10((PEAK * PEAK) / mseValue)
}
