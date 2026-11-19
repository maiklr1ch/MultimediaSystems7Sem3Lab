/**
 * Оцінка реального розміру закодованих даних.
 *
 * Кількість ненульових коефіцієнтів — не розмір файлу: потрібно ще зберегти, ДЕ стоять ці коефіцієнти,
 * а самі значення займають різну кількість біт. Тому, крім "коефіцієнта стиснення за коефіцієнтами",
 * рахуємо приблизний розмір потоку:
 *
 *   1. цілі символи (див. CompressedCoefficients.symbols) обходимо в порядку від низьких частот до
 *      високих (DCT — зигзаг у кожному блоці, Хаар — від LL до найдрібніших деталей),
 *      щоб нулі йшли довгими серіями;
 *   2. кожне число записуємо як zigzag-varint (малі за модулем числа займають 1 байт);
 *   3. потік стискаємо DEFLATE (стандартний CompressionStream браузера / Node.js).
 *
 * Це груба модель кодера (до JPEG чи JPEG 2000 їй далеко), але вона чесно враховує і позиції,
 * і значення коефіцієнтів. Оригінал вважаємо нестисненим: 1 байт на піксель.
 */

/** Записує цілі числа у вказаному порядку як zigzag-varint. */
export function serializeSymbols(symbols: Int32Array, order: ArrayLike<number>): Uint8Array {
  const bytes = new Uint8Array(symbols.length * 5)
  let p = 0
  for (let i = 0; i < order.length; i++) {
    const v = symbols[order[i]]
    // zigzag: 0, −1, 1, −2, 2… → 0, 1, 2, 3, 4…
    let z = ((v << 1) ^ (v >> 31)) >>> 0
    while (z >= 0x80) {
      bytes[p++] = (z & 0x7f) | 0x80
      z >>>= 7
    }
    bytes[p++] = z
  }
  return bytes.subarray(0, p)
}

export async function deflateSize(bytes: Uint8Array): Promise<number> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('deflate'))
  const compressed = await new Response(stream).arrayBuffer()
  return compressed.byteLength
}

export async function estimateEncodedBytes(symbols: Int32Array, order: ArrayLike<number>): Promise<number> {
  return deflateSize(serializeSymbols(symbols, order))
}
