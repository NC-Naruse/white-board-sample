import type { ToolMode } from '../types/drawing'

interface ToolbarProps {
  color: string
  disabled?: boolean
  onClear: () => void
  onColorChange: (color: string) => void
  onToolChange: (tool: ToolMode) => void
  onWidthChange: (width: number) => void
  tool: ToolMode
  width: number
}

export function Toolbar({
  color,
  disabled = false,
  onClear,
  onColorChange,
  onToolChange,
  onWidthChange,
  tool,
  width,
}: ToolbarProps) {
  return (
    <section className="toolbar" aria-label="Drawing tools">
      <div className="toolbar__group">
        <button
          className={tool === 'pen' ? 'toolbar__button is-active' : 'toolbar__button'}
          onClick={() => onToolChange('pen')}
          type="button"
        >
          ペン
        </button>
        <button
          className={tool === 'eraser' ? 'toolbar__button is-active' : 'toolbar__button'}
          onClick={() => onToolChange('eraser')}
          type="button"
        >
          消しゴム
        </button>
      </div>

      <label className="toolbar__field">
        <span>色</span>
        <input
          aria-label="Stroke color"
          disabled={disabled}
          onChange={(event) => onColorChange(event.target.value)}
          type="color"
          value={color}
        />
      </label>

      <label className="toolbar__field toolbar__field--grow">
        <span>線幅 {width}px</span>
        <input
          aria-label="Stroke width"
          disabled={disabled}
          max={24}
          min={2}
          onChange={(event) => onWidthChange(Number(event.target.value))}
          type="range"
          value={width}
        />
      </label>

      <button className="toolbar__button toolbar__button--danger" onClick={onClear} type="button">
        全消し
      </button>
    </section>
  )
}
