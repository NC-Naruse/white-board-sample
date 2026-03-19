import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'

import type { DrawSegment, StrokeStyle } from '../types/drawing'

interface WhiteboardCanvasProps {
  disabled?: boolean
  onDrawSegment: (segment: DrawSegment) => void
  segments: DrawSegment[]
  strokeStyle: StrokeStyle
}

interface ActiveStrokeState {
  isDrawing: boolean
  lastPoint: { x: number; y: number } | null
}

export function WhiteboardCanvas({
  disabled = false,
  onDrawSegment,
  segments,
  strokeStyle,
}: WhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const activeStrokeRef = useRef<ActiveStrokeState>({
    isDrawing: false,
    lastPoint: null,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current

    if (!canvas || !container) {
      return
    }

    const resizeCanvas = () => {
      const context = canvas.getContext('2d')

      if (!context) {
        return
      }

      const ratio = window.devicePixelRatio || 1
      const { width, height } = container.getBoundingClientRect()

      canvas.width = width * ratio
      canvas.height = height * ratio
      context.setTransform(ratio, 0, 0, ratio, 0, 0)

      redrawCanvas(canvas, segments)
    }

    resizeCanvas()

    const observer = new ResizeObserver(resizeCanvas)
    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [segments])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    redrawCanvas(canvas, segments)
  }, [segments])

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled) {
      return
    }

    const point = getCanvasPoint(event)
    activeStrokeRef.current = {
      isDrawing: true,
      lastPoint: point,
    }

    event.currentTarget.setPointerCapture(event.pointerId)

    onDrawSegment({
      from: point,
      to: point,
      style: { ...strokeStyle },
    })
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled || !activeStrokeRef.current.isDrawing || !activeStrokeRef.current.lastPoint) {
      return
    }

    const point = getCanvasPoint(event)
    const segment: DrawSegment = {
      from: activeStrokeRef.current.lastPoint,
      to: point,
      style: { ...strokeStyle },
    }

    activeStrokeRef.current.lastPoint = point
    onDrawSegment(segment)
  }

  const stopDrawing = () => {
    activeStrokeRef.current = {
      isDrawing: false,
      lastPoint: null,
    }
  }

  return (
    <div className={disabled ? 'board board--disabled' : 'board'} ref={containerRef}>
      <canvas
        className="board__canvas"
        onPointerCancel={stopDrawing}
        onPointerDown={handlePointerDown}
        onPointerLeave={stopDrawing}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrawing}
        ref={canvasRef}
      />
      {disabled ? (
        <div className="board__overlay">
          <p>接続が完了すると描画できます。</p>
        </div>
      ) : null}
    </div>
  )
}

function redrawCanvas(canvas: HTMLCanvasElement, segments: DrawSegment[]) {
  const context = canvas.getContext('2d')

  if (!context) {
    return
  }

  const ratio = window.devicePixelRatio || 1
  const width = canvas.width / ratio
  const height = canvas.height / ratio

  context.clearRect(0, 0, width, height)

  segments.forEach((segment) => {
    drawSegment(context, segment)
  })
}

function drawSegment(context: CanvasRenderingContext2D, segment: DrawSegment) {
  context.save()
  context.beginPath()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = segment.style.width
  context.strokeStyle = segment.style.color
  context.globalCompositeOperation =
    segment.style.tool === 'eraser' ? 'destination-out' : 'source-over'
  context.moveTo(segment.from.x, segment.from.y)
  context.lineTo(segment.to.x, segment.to.y)
  context.stroke()
  context.restore()
}

function getCanvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
  const rect = event.currentTarget.getBoundingClientRect()

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}
