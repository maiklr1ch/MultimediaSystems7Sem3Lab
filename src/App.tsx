import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { CompressionMethod, CompressionParams } from './core/compression'
import { maxHaarLevels } from './core/haar'
import { Controls, type ViewMode, type Zoom } from './components/Controls'
import { CROP_SIZE, ExperimentsTable } from './components/ExperimentsTable'
import { ImagePanel, type FocusPoint } from './components/ImagePanel'
import { ImagePicker } from './components/ImagePicker'
import { MethodMetrics, OriginalMetrics } from './components/Metrics'
import { PsnrChart } from './components/PsnrChart'
import { useCompression } from './hooks/useCompression'
import { useExperiments } from './hooks/useExperiments'
import { SAMPLES, loadFile, type SourceImage } from './lib/images'
import { METHODS, getMethod, sliderToValue, valueToSlider } from './lib/methods'
import { coefficientView, downloadPng, errorView } from './lib/render'

/** Точка, на яку за замовчуванням дивляться фрагменти в таблиці: щось із дрібними деталями. */
const DEFAULT_FOCUS: Record<string, FocusPoint> = {
  camera: { x: 0.57, y: 0.32 },
  pattern: { x: 0.48, y: 0.29 } // права межа кола на градієнті
}
const CENTER: FocusPoint = { x: 0.5, y: 0.5 }

const DEFAULT_HAAR_LEVELS = 5

export function App() {
  const [images, setImages] = useState<SourceImage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all(SAMPLES.map(async (s) => ({ id: s.id, name: s.name, image: await s.load() })))
      .then((loaded) => {
        if (cancelled) return
        setImages(loaded)
        setSelectedId((id) => id ?? loaded[0].id)
      })
      .catch(() => setLoadError('Не вдалося завантажити тестові зображення.'))
    return () => {
      cancelled = true
    }
  }, [])

  async function handleUpload(file: File) {
    try {
      const source = await loadFile(file)
      setImages((list) => [...list.filter((item) => item.id !== source.id), source])
      setSelectedId(source.id)
      setFocus(CENTER)
      setLoadError(null)
    } catch (error) {
      setLoadError((error as Error).message)
    }
  }

  const source = images.find((item) => item.id === selectedId)

  const [focus, setFocus] = useState<FocusPoint>(DEFAULT_FOCUS.camera)

  return (
    <div className="mx-auto flex max-w-[1640px] flex-col gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div className="max-w-[64ch]">
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.01em]">Стиснення зображень: DCT і DWT</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
            DCT на блоках 8×8 у матричній формі та вейвлет Хаара, обидва реалізовані власноруч. Оберіть зображення й
            рівень стиснення та порівняйте відновлені результати з оригіналом.
          </p>
        </div>
        <ImagePicker
          images={images}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id)
            setFocus(DEFAULT_FOCUS[id] ?? CENTER)
          }}
          onUpload={handleUpload}
        />
      </header>

      {loadError && (
        <p role="alert" className="rounded-md border border-line bg-panel px-4 py-2.5 text-[13px]" data-testid="load-error">
          {loadError}
        </p>
      )}

      {source ? (
        <Workbench key={source.id} source={source} focus={focus} onFocusChange={setFocus} />
      ) : (
        <p className="py-24 text-center text-[14px] text-ink-3">Завантажую зображення…</p>
      )}
    </div>
  )
}

interface WorkbenchProps {
  source: SourceImage
  focus: FocusPoint
  onFocusChange: (point: FocusPoint) => void
}

function Workbench({ source, focus, onFocusChange }: WorkbenchProps) {
  const { image } = source
  const maxLevels = Math.min(9, maxHaarLevels(image.width, image.height))

  const [method, setMethod] = useState<CompressionMethod>('topk')
  // рівень пам'ятається окремо для кожного способу
  const [levels, setLevels] = useState<Record<CompressionMethod, { value: number; position: number }>>(
    () =>
      Object.fromEntries(
        METHODS.map((m) => [m.id, { value: m.defaultValue, position: valueToSlider(m, m.defaultValue) }])
      ) as Record<CompressionMethod, { value: number; position: number }>
  )
  const [haarLevels, setHaarLevels] = useState(Math.min(DEFAULT_HAAR_LEVELS, maxLevels))
  const [view, setView] = useState<ViewMode>('restored')
  const [zoom, setZoom] = useState<Zoom>(1)
  const [zoomOrigin, setZoomOrigin] = useState<FocusPoint>(focus)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  const config = getMethod(method)
  const params = useMemo<CompressionParams>(() => ({ method, value: levels[method].value }), [method, levels])
  // Слайдер оновлюється одразу, а перерахунок іде з низьким пріоритетом.
  const deferredParams = useDeferredValue(params)

  const state = useCompression(image, haarLevels, deferredParams)
  const { rows } = useExperiments(image, state.dct, state.dwt, method, config.presets)

  const setPosition = (position: number) =>
    setLevels((prev) => ({ ...prev, [method]: { position, value: sliderToValue(config, position) } }))
  const setPreset = (value: number) =>
    setLevels((prev) => ({ ...prev, [method]: { value, position: valueToSlider(config, value) } }))

  const displayed = useMemo(() => {
    switch (view) {
      case 'restored':
        return { dct: state.dctResult.pixels, dwt: state.dwtResult.pixels }
      case 'error':
        return {
          dct: errorView(image.data, state.dctResult.pixels),
          dwt: errorView(image.data, state.dwtResult.pixels)
        }
      case 'coefficients':
        return {
          dct: coefficientView(state.dctResult.coefficients.data, state.dct.coefficients.data),
          dwt: coefficientView(state.dwtResult.coefficients.data, state.dwt.coefficients.data)
        }
    }
  }, [view, image, state])

  const captions: Record<ViewMode, { dct: string; dwt: string }> = {
    restored: { dct: 'Блоки 8×8, F = C·B·Cᵀ', dwt: `Хаар, ${levelsLabel(haarLevels)}` },
    error: { dct: 'Різниця з оригіналом ×4, сірий — без похибки', dwt: 'Різниця з оригіналом ×4, сірий — без похибки' },
    coefficients: { dct: 'log(1 + |c|) у кожному блоці, обнулені чорні', dwt: 'Розкладка Маллата, log(1 + |c|), обнулені чорні' }
  }

  const fileBase = `${source.id.replace(/^file:/, '').replace(/[^\p{L}\p{N}._-]+/gu, '_')}-${method}-${params.value}`

  const panelProps = {
    width: image.width,
    height: image.height,
    zoom,
    zoomOrigin,
    onPointer: setZoomOrigin,
    onSelect: onFocusChange
  }

  return (
    <>
      <Controls
        method={method}
        value={params.value}
        position={levels[method].position}
        haarLevels={haarLevels}
        maxHaarLevels={maxLevels}
        view={view}
        zoom={zoom}
        onMethodChange={setMethod}
        onPositionChange={setPosition}
        onHaarLevelsChange={setHaarLevels}
        onViewChange={setView}
        onZoomChange={(z) => {
          setZoom(z)
          setZoomOrigin(focus)
        }}
      />

      <section aria-label="Порівняння" className="grid gap-x-6 gap-y-8 md:grid-cols-3">
        <ImagePanel
          {...panelProps}
          title="Original"
          caption={source.name}
          pixels={image.data}
          marker={{ point: focus, size: CROP_SIZE / image.width }}
        >
          <OriginalMetrics width={image.width} height={image.height} note={source.note} />
        </ImagePanel>

        <ImagePanel
          {...panelProps}
          title="DCT"
          series="dct"
          caption={captions[view].dct}
          pixels={displayed.dct}
          action={<SaveButton onClick={() => downloadPng(state.dctResult.pixels, image.width, image.height, `${fileBase}-dct.png`)} />}
        >
          <MethodMetrics result={state.dctResult} size={state.dctSize} otherPsnr={state.dwtResult.psnr} />
        </ImagePanel>

        <ImagePanel
          {...panelProps}
          title="DWT"
          series="dwt"
          caption={captions[view].dwt}
          pixels={displayed.dwt}
          action={<SaveButton onClick={() => downloadPng(state.dwtResult.pixels, image.width, image.height, `${fileBase}-dwt.png`)} />}
        >
          <MethodMetrics result={state.dwtResult} size={state.dwtSize} otherPsnr={state.dctResult.psnr} />
        </ImagePanel>
      </section>

      <p className="-mt-2 text-[12.5px] text-ink-3">
        Наведіть курсор на будь-яке зображення: при збільшенні всі три показують ту саму ділянку. Клік обирає фрагмент для
        таблиці експериментів.
      </p>

      <section aria-labelledby="experiments-title" className="flex flex-col gap-4 border-t border-line pt-6">
        <div className="max-w-[72ch]">
          <h2 id="experiments-title" className="text-[20px] font-semibold">
            Експерименти: {config.label.toLowerCase()}
          </h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
            Шість рівнів стиснення для обох методів на цьому зображенні. Клік по рядку переносить рівень у порівняння
            вгорі. Вищий PSNR у рядку виділено жирним.
          </p>
        </div>

        <div className="grid items-start gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {rows.length > 0 ? (
            <ExperimentsTable
              config={config}
              rows={rows}
              original={image}
              focus={focus}
              currentValue={params.value}
              hovered={hoveredRow}
              onHover={setHoveredRow}
              onPick={setPreset}
            />
          ) : (
            <p className="py-10 text-[13px] text-ink-3">Рахую експерименти…</p>
          )}
          <PsnrChart
            config={config}
            rows={rows}
            current={{ dct: state.dctResult, dwt: state.dwtResult }}
            hovered={hoveredRow}
            onHover={setHoveredRow}
          />
        </div>

        <details className="max-w-[80ch] text-[13px] leading-relaxed text-ink-2">
          <summary className="cursor-pointer text-ink">Як рахується коефіцієнт стиснення</summary>
          <div className="mt-2 flex flex-col gap-2">
            <p>
              <b className="font-semibold text-ink">CR за коефіцієнтами</b> = N / кількість ненульових коефіцієнтів. Це
              верхня оцінка: вона не враховує, що треба зберегти ще й положення кожного коефіцієнта, а самі значення
              займають різну кількість біт.
            </p>
            <p>
              <b className="font-semibold text-ink">CR за розміром</b>: коефіцієнти округлюються до цілих (для квантування
              — індекси round(c / Δ)), обходяться від низьких частот до високих (DCT — зигзагом у кожному блоці, Хаар — від
              LL до найдрібніших деталей), записуються як zigzag-varint і стискаються DEFLATE. Оригінал вважається
              нестисненим: 1 байт на піксель, тобто 8 біт/пікс.
            </p>
          </div>
        </details>
      </section>
    </>
  )
}

function SaveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Зберегти відновлене зображення у PNG"
      className="h-8 shrink-0 rounded-md border border-line px-2.5 text-[12.5px] text-ink-2 hover:border-ink-3 hover:text-ink"
    >
      Зберегти PNG
    </button>
  )
}

function levelsLabel(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} рівень`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} рівні`
  return `${n} рівнів`
}
