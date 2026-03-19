import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import './App.css'
import { Toolbar } from './components/Toolbar'
import { WhiteboardCanvas } from './components/WhiteboardCanvas'
import { getFirestoreDb, isFirebaseConfigured } from './lib/firebase'
import { WhiteboardPeer } from './lib/webrtc'
import type {
  ConnectionStatus,
  DrawSegment,
  RoomRole,
  ToolMode,
  WhiteboardMessage,
} from './types/drawing'

function App() {
  const initialRoom = useMemo(
    () => new URLSearchParams(window.location.search).get('room') ?? '',
    [],
  )
  const [activeRoomId, setActiveRoomId] = useState(initialRoom)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [roomInput, setRoomInput] = useState(initialRoom)
  const [roomRole, setRoomRole] = useState<RoomRole | null>(null)
  const [segments, setSegments] = useState<DrawSegment[]>([])
  const [strokeColor, setStrokeColor] = useState('#2563eb')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [tool, setTool] = useState<ToolMode>('pen')

  const roomRoleRef = useRef<RoomRole | null>(roomRole)
  const segmentsRef = useRef<DrawSegment[]>(segments)
  const autoJoinAttemptedRef = useRef(false)
  const peerRef = useRef<WhiteboardPeer | null>(null)

  const db = useMemo(() => {
    if (!isFirebaseConfigured) {
      return null
    }

    return getFirestoreDb()
  }, [])

  useEffect(() => {
    roomRoleRef.current = roomRole
  }, [roomRole])

  useEffect(() => {
    segmentsRef.current = segments
  }, [segments])

  const handlePeerMessage = useCallback((message: WhiteboardMessage) => {
    switch (message.type) {
      case 'draw-segment':
        setSegments((currentSegments) => [...currentSegments, message.segment])
        break
      case 'clear-board':
        setSegments([])
        break
      case 'sync-state':
        setSegments(message.segments)
        break
      default:
        break
    }
  }, [])

  useEffect(() => {
    if (!db) {
      return
    }

    const peer = new WhiteboardPeer(db, {
      onError: (message) => {
        setErrorMessage(message)
      },
      onMessage: handlePeerMessage,
      onStatusChange: setConnectionStatus,
      onChannelOpen: () => {
        if (roomRoleRef.current === 'host') {
          peer.send({
            type: 'sync-state',
            segments: segmentsRef.current,
          })
        }
      },
    })

    peerRef.current = peer

    return () => {
      peer.destroy()
      peerRef.current = null
    }
  }, [db, handlePeerMessage])

  const updateRoomUrl = useCallback((roomId: string) => {
    const nextUrl = new URL(window.location.href)

    if (roomId) {
      nextUrl.searchParams.set('room', roomId)
    } else {
      nextUrl.searchParams.delete('room')
    }

    window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}`)
  }, [])

  const connectToRoom = useCallback(
    async (nextRoomId: string, nextRole: RoomRole) => {
      if (!db || !peerRef.current) {
        setErrorMessage(
          'Firebase is not configured yet. Copy .env.example to .env.local and add your Firestore settings.',
        )
        return
      }

      setErrorMessage('')
      setSegments([])
      setRoomRole(nextRole)
      setActiveRoomId(nextRoomId)
      setRoomInput(nextRoomId)
      updateRoomUrl(nextRoomId)

      if (nextRole === 'host') {
        await peerRef.current.hostRoom(nextRoomId)
        return
      }

      await peerRef.current.joinRoom(nextRoomId)
    },
    [db, updateRoomUrl],
  )

  const handleCreateRoom = useCallback(async () => {
    const nextRoomId = crypto.randomUUID().slice(0, 8)

    try {
      await connectToRoom(nextRoomId, 'host')
    } catch (error) {
      setConnectionStatus('error')
      setErrorMessage(getErrorMessage(error))
    }
  }, [connectToRoom])

  const handleJoinRoom = useCallback(
    async (preferredRoomId?: string) => {
      const nextRoomId = (preferredRoomId ?? roomInput).trim()

      if (!nextRoomId) {
        setErrorMessage('参加するルームIDを入力してください。')
        return
      }

      try {
        await connectToRoom(nextRoomId, 'guest')
      } catch (error) {
        setConnectionStatus('error')
        setErrorMessage(getErrorMessage(error))
      }
    },
    [connectToRoom, roomInput],
  )

  useEffect(() => {
    if (!initialRoom || !db || autoJoinAttemptedRef.current) {
      return
    }

    autoJoinAttemptedRef.current = true

    const timeoutId = window.setTimeout(() => {
      void handleJoinRoom(initialRoom)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [db, handleJoinRoom, initialRoom])

  const broadcastMessage = useCallback((message: WhiteboardMessage) => {
    peerRef.current?.send(message)
  }, [])

  const handleLocalDraw = useCallback(
    (segment: DrawSegment) => {
      setSegments((currentSegments) => [...currentSegments, segment])
      broadcastMessage({
        type: 'draw-segment',
        segment,
      })
    },
    [broadcastMessage],
  )

  const handleClearBoard = useCallback(() => {
    setSegments([])
    broadcastMessage({ type: 'clear-board' })
  }, [broadcastMessage])

  const canDraw = roomRole === 'host' || connectionStatus === 'connected'
  const shareUrl = activeRoomId
    ? `${window.location.origin}${window.location.pathname}?room=${activeRoomId}`
    : ''
  const statusLabel = getStatusLabel(connectionStatus, roomRole)

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="hero__eyebrow">React + WebRTC + Firestore signaling</p>
          <h1>P2P Whiteboard</h1>
          <p className="hero__description">
            1対1のリアルタイム描画を最小構成で試せるホワイトボードです。描画データは
            WebRTC DataChannel で同期し、Firestore は接続確立のためのシグナリングにだけ使います。
          </p>
        </div>

        <div className="room-card">
          <div className="room-card__status">
            <span className={`status-pill status-pill--${connectionStatus}`}>{statusLabel}</span>
            {roomRole ? <span className="room-card__role">{roomRole === 'host' ? 'Host' : 'Guest'}</span> : null}
          </div>

          <div className="room-card__actions">
            <button className="primary-button" onClick={() => void handleCreateRoom()} type="button">
              ルームを作成
            </button>

            <div className="join-controls">
              <input
                onChange={(event) => setRoomInput(event.target.value)}
                placeholder="room-id"
                type="text"
                value={roomInput}
              />
              <button className="secondary-button" onClick={() => void handleJoinRoom()} type="button">
                参加
              </button>
            </div>
          </div>

          <label className="share-field">
            <span>共有URL</span>
            <div className="share-field__row">
              <input readOnly type="text" value={shareUrl} />
              <button
                className="secondary-button"
                disabled={!shareUrl}
                onClick={() => void copyShareUrl(shareUrl, setErrorMessage)}
                type="button"
              >
                コピー
              </button>
            </div>
          </label>

          {!isFirebaseConfigured ? (
            <p className="notice">
              Firebase の設定が未入力です。`.env.example` を `.env.local` にコピーして値を設定してください。
            </p>
          ) : null}
          {errorMessage ? <p className="notice notice--error">{errorMessage}</p> : null}
        </div>
      </header>

      <Toolbar
        color={strokeColor}
        disabled={!canDraw}
        onClear={handleClearBoard}
        onColorChange={setStrokeColor}
        onToolChange={setTool}
        onWidthChange={setStrokeWidth}
        tool={tool}
        width={strokeWidth}
      />

      <WhiteboardCanvas
        disabled={!canDraw}
        onDrawSegment={handleLocalDraw}
        segments={segments}
        strokeStyle={{
          color: strokeColor,
          width: strokeWidth,
          tool,
        }}
      />
    </main>
  )
}

export default App

function getStatusLabel(status: ConnectionStatus, roomRole: RoomRole | null) {
  switch (status) {
    case 'connecting':
      return roomRole === 'host' ? '接続待機中' : '接続中'
    case 'connected':
      return '接続済み'
    case 'disconnected':
      return '切断'
    case 'error':
      return 'エラー'
    default:
      return '未接続'
  }
}

async function copyShareUrl(
  shareUrl: string,
  setErrorMessage: (message: string) => void,
) {
  if (!shareUrl) {
    return
  }

  try {
    await navigator.clipboard.writeText(shareUrl)
    setErrorMessage('')
  } catch {
    setErrorMessage('共有URLのコピーに失敗しました。')
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return '予期しないエラーが発生しました。'
}
