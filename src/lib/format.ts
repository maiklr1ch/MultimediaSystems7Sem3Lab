const locale = 'uk-UA'

const fixed = (digits: number) =>
  new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })

const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })

export function formatPsnr(value: number): string {
  return Number.isFinite(value) ? `${fixed(2).format(value)} дБ` : '∞ дБ'
}

/** Частка 0..1 як відсоток із розумною кількістю знаків: 50 %, 2,5 %, 0,25 %. */
export function formatPercent(fraction: number): string {
  const percent = fraction * 100
  const digits = percent >= 10 ? 1 : percent >= 1 ? 2 : 3
  const text = new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(percent)
  return `${text} %`
}

export function formatInteger(value: number): string {
  return integer.format(value)
}

export function formatRatio(value: number): string {
  if (!Number.isFinite(value)) return '∞ : 1'
  return `${fixed(value >= 100 ? 0 : 1).format(value)} : 1`
}

export function formatBpp(value: number): string {
  return fixed(2).format(value)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${integer.format(bytes)} Б`
  return `${fixed(1).format(bytes / 1024)} КБ`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
}
