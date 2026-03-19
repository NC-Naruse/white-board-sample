export type ToolMode = 'pen' | 'eraser'

export type RoomRole = 'host' | 'guest'

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'

export interface Point {
  x: number
  y: number
}

export interface StrokeStyle {
  color: string
  width: number
  tool: ToolMode
}

export interface DrawSegment {
  from: Point
  to: Point
  style: StrokeStyle
}

export interface DrawSegmentMessage {
  type: 'draw-segment'
  segment: DrawSegment
}

export interface ClearBoardMessage {
  type: 'clear-board'
}

export interface SyncStateMessage {
  type: 'sync-state'
  segments: DrawSegment[]
}

export type WhiteboardMessage =
  | DrawSegmentMessage
  | ClearBoardMessage
  | SyncStateMessage
