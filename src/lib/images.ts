import { createImage, luma, type GrayImage } from '../core/image'
import brickUrl from '../samples/brick.png'
import cameraUrl from '../samples/camera.png'
import gravelUrl from '../samples/gravel.png'

/** Робочий розмір: 512×512 ділиться і на 8 (блоки DCT), і на 2⁹ (рівні Хаара). */
export const WORK_SIZE = 512

export interface SourceImage {
  id: string
  name: string
  image: GrayImage
  /** Що зроблено із завантаженим файлом, щоб привести його до робочого розміру. */
  note?: string
}

export interface SampleDefinition {
  id: string
  name: string
  load: () => Promise<GrayImage>
}

export const SAMPLES: SampleDefinition[] = [
  { id: 'camera', name: 'Фотограф', load: () => loadFromUrl(cameraUrl) },
  { id: 'brick', name: 'Цегла', load: () => loadFromUrl(brickUrl) },
  { id: 'gravel', name: 'Гравій', load: () => loadFromUrl(gravelUrl) },
  { id: 'pattern', name: 'Тестова таблиця', load: async () => testPattern(WORK_SIZE) }
]

async function loadFromUrl(url: string): Promise<GrayImage> {
  const response = await fetch(url)
  const bitmap = await createImageBitmap(await response.blob())
  return bitmapToGray(bitmap).image
}

/**
 * Будь-яке зображення → відтінки сірого 512×512:
 * центральний квадрат, масштабування (якщо потрібно), яскравість за BT.601, округлення до 8 біт.
 */
export function bitmapToGray(bitmap: ImageBitmap): { image: GrayImage; note?: string } {
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = Math.floor((bitmap.width - side) / 2)
  const sy = Math.floor((bitmap.height - side) / 2)

  const canvas = document.createElement('canvas')
  canvas.width = WORK_SIZE
  canvas.height = WORK_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, WORK_SIZE, WORK_SIZE)

  const rgba = ctx.getImageData(0, 0, WORK_SIZE, WORK_SIZE).data
  const image = createImage(WORK_SIZE, WORK_SIZE)
  for (let i = 0; i < image.data.length; i++) {
    image.data[i] = Math.round(luma(rgba[4 * i], rgba[4 * i + 1], rgba[4 * i + 2]))
  }

  const notes: string[] = []
  if (bitmap.width !== bitmap.height) notes.push(`обрізано до квадрата ${side}×${side}`)
  if (side !== WORK_SIZE) notes.push(`масштабовано до ${WORK_SIZE}×${WORK_SIZE}`)
  return { image, note: notes.length > 0 ? `Оригінал ${bitmap.width}×${bitmap.height}: ${notes.join(', ')}.` : undefined }
}

export async function loadFile(file: File): Promise<SourceImage> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(`Не вдалося прочитати «${file.name}». Оберіть файл PNG, JPEG, WebP, BMP або GIF.`)
  }
  const { image, note } = bitmapToGray(bitmap)
  bitmap.close()
  return { id: `file:${file.name}:${file.lastModified}`, name: file.name, image, note }
}

/**
 * Синтетична тестова таблиця: плавний градієнт, коло й квадрат з різкими межами
 * (межі квадрата навмисно не збігаються з сіткою 8×8), смуги зі зростаючою частотою
 * і тонка діагональ. На ній добре видно, чим відрізняються артефакти двох методів.
 */
export function testPattern(size: number): GrayImage {
  const image = createImage(size, size)
  const s = size / 512
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 50 + (150 * x) / (size - 1)

      const dx = x - 150 * s
      const dy = y - 150 * s
      if (dx * dx + dy * dy < (95 * s) ** 2) v = 235

      if (x >= 301 * s && x < 459 * s && y >= 61 * s && y < 219 * s) {
        v = 20
        // шахова дошка 6×6 px усередині квадрата
        if (x >= 341 * s && x < 419 * s && y >= 101 * s && y < 179 * s) {
          v = (Math.floor((x - 341 * s) / (6 * s)) + Math.floor((y - 101 * s) / (6 * s))) % 2 === 0 ? 20 : 220
        }
      }

      if (y >= 290 * s && y < 470 * s) {
        // чирп: частота зростає зліва направо
        const t = x / size
        v = 128 + 100 * Math.sin(2 * Math.PI * 48 * t * t)
      }

      if (Math.abs(y - (500 * s - 0.45 * x)) < 0.75 && y < 290 * s) v = 255

      image.data[y * size + x] = Math.round(Math.min(255, Math.max(0, v)))
    }
  }
  return image
}
