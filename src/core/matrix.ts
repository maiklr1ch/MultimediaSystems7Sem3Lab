/**
 * Мінімальні операції з квадратними матрицями n×n, які зберігаються в Float64Array по рядках:
 * елемент (i, j) має індекс i * n + j.
 *
 * Умова лабораторної дозволяє бібліотеки для множення матриць, але для 8×8 простіше і прозоріше
 * написати його самому — так видно кожну операцію перетворення.
 */
export type Matrix = Float64Array

export function identity(n: number): Matrix {
  const m = new Float64Array(n * n)
  for (let i = 0; i < n; i++) m[i * n + i] = 1
  return m
}

export function transpose(a: Matrix, n: number): Matrix {
  const t = new Float64Array(n * n)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) t[j * n + i] = a[i * n + j]
  }
  return t
}

/** C = A · B. Якщо передано `out`, результат записується в нього (без виділення пам'яті). */
export function multiply(a: Matrix, b: Matrix, n: number, out: Matrix = new Float64Array(n * n)): Matrix {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0
      for (let k = 0; k < n; k++) sum += a[i * n + k] * b[k * n + j]
      out[i * n + j] = sum
    }
  }
  return out
}

/** Максимальна різниця між елементами двох матриць — для тестів. */
export function maxAbsDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let max = 0
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i]))
  return max
}
