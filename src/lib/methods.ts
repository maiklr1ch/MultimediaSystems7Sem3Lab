import type { CompressionMethod } from '../core/compression'
import { formatNumber, formatPercent } from './format'

/**
 * Налаштування способів стиснення для інтерфейсу: діапазон слайдера, рівні для експериментів,
 * підписи. Слайдер логарифмічний — так однаково зручно обирати і 0,5 %, і 50 %.
 */
export interface MethodConfig {
  id: CompressionMethod
  label: string
  /** Короткий опис принципу — показується під перемикачем. */
  hint: string
  min: number
  max: number
  defaultValue: number
  /** Рівні стиснення для таблиці експериментів (від слабкого до сильного). */
  presets: number[]
  /** Значення параметра: "10 %", "T = 20", "Δ = 16". */
  formatValue: (value: number) => string
  /** Підпис рядка в таблиці експериментів. */
  presetLabel: (value: number) => string
  /** Менше значення = сильніше стиснення (для частки коефіцієнтів). Слайдер тоді інвертується. */
  smallerIsStronger?: boolean
}

export const METHODS: MethodConfig[] = [
  {
    id: 'topk',
    label: 'Частка найбільших',
    hint: 'Зберігається задана частка коефіцієнтів із найбільшим модулем, решта обнуляється. Обидва методи отримують однакову кількість коефіцієнтів.',
    min: 0.001,
    max: 1,
    defaultValue: 0.05,
    presets: [0.5, 0.2, 0.1, 0.05, 0.02, 0.01],
    formatValue: (value) => formatPercent(value),
    presetLabel: (value) => formatPercent(value),
    smallerIsStronger: true
  },
  {
    id: 'threshold',
    label: 'Поріг',
    hint: 'Обнуляються всі коефіцієнти з |c| < T. Скільки коефіцієнтів залишиться, залежить від зображення.',
    min: 1,
    max: 400,
    defaultValue: 20,
    presets: [5, 10, 20, 40, 80, 160],
    formatValue: (value) => `T = ${formatNumber(value)}`,
    presetLabel: (value) => `T = ${formatNumber(value)}`
  },
  {
    id: 'quantize',
    label: 'Квантування',
    hint: 'Рівномірне квантування з кроком Δ: ĉ = Δ · round(c / Δ). Коефіцієнти з |c| < Δ/2 стають нулями.',
    min: 1,
    max: 256,
    defaultValue: 16,
    presets: [4, 8, 16, 32, 64, 128],
    formatValue: (value) => `Δ = ${formatNumber(value)}`,
    presetLabel: (value) => `Δ = ${formatNumber(value)}`
  }
]

export function getMethod(id: CompressionMethod): MethodConfig {
  return METHODS.find((method) => method.id === id)!
}

export const SLIDER_STEPS = 1000

/**
 * Позиція слайдера 0..SLIDER_STEPS, де праворуч завжди сильніше стиснення.
 * Позицію зберігаємо окремо від значення: значення округлюється до двох значущих цифр,
 * і якби позиція виводилась з округленого значення, крок клавішею ←/→ "відскакував" би назад.
 */
export function valueToSlider(config: MethodConfig, value: number): number {
  const t = Math.log(value / config.min) / Math.log(config.max / config.min)
  const position = Math.round(Math.min(1, Math.max(0, t)) * SLIDER_STEPS)
  return config.smallerIsStronger ? SLIDER_STEPS - position : position
}

/** Позиція слайдера → значення, округлене до двох значущих цифр (щоб не показувати 17,3829…). */
export function sliderToValue(config: MethodConfig, position: number): number {
  const p = config.smallerIsStronger ? SLIDER_STEPS - position : position
  const raw = config.min * Math.pow(config.max / config.min, p / SLIDER_STEPS)
  const rounded = Number(raw.toPrecision(2))
  return Math.min(config.max, Math.max(config.min, rounded))
}
