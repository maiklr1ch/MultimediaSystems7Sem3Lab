import { useEffect, useRef, type CSSProperties } from 'react'
import { drawGray } from '../lib/render'

interface GrayCanvasProps {
  pixels: ArrayLike<number>
  width: number
  height: number
  className?: string
  style?: CSSProperties
  label?: string
}

export function GrayCanvas({ pixels, width, height, className, style, label }: GrayCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (ref.current) drawGray(ref.current, width, height, pixels)
  }, [pixels, width, height])

  return <canvas ref={ref} width={width} height={height} className={className} style={style} role="img" aria-label={label} />
}
