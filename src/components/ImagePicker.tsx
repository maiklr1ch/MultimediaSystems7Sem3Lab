import { useRef } from 'react'
import type { SourceImage } from '../lib/images'
import { GrayCanvas } from './GrayCanvas'

interface ImagePickerProps {
  images: SourceImage[]
  selectedId: string | null
  onSelect: (id: string) => void
  onUpload: (file: File) => void
}

export function ImagePicker({ images, selectedId, onSelect, onUpload }: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Зображення">
      {images.map((item) => {
        const selected = item.id === selectedId
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(item.id)}
            title={item.name}
            className={`flex h-11 max-w-[180px] items-center gap-2 rounded-md border py-1 pr-3 pl-1 text-[13px] transition-colors ${
              selected ? 'border-ink bg-panel font-semibold' : 'border-line text-ink-2 hover:border-ink-3 hover:text-ink'
            }`}
          >
            <GrayCanvas
              pixels={item.image.data}
              width={item.image.width}
              height={item.image.height}
              className="h-9 w-9 shrink-0 rounded-[3px]"
            />
            <span className="truncate">{item.name}</span>
          </button>
        )
      })}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="h-11 rounded-md border border-dashed border-ink-3 px-3.5 text-[13px] text-ink-2 hover:border-ink hover:text-ink"
      >
        Завантажити своє
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="upload"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onUpload(file)
          event.target.value = ''
        }}
      />
    </div>
  )
}
