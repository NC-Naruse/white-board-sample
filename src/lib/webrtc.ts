import type { Firestore } from 'firebase/firestore'

import {
  addIceCandidate,
  createRoomOffer,
  getRoomOffer,
  listenForAnswer,
  listenForRemoteIceCandidates,
  setRoomAnswer,
} from './firestoreSignaling'
import type {
  ConnectionStatus,
  RoomRole,
  WhiteboardMessage,
} from '../types/drawing'

interface WhiteboardPeerCallbacks {
  onError: (message: string) => void
  onMessage: (message: WhiteboardMessage) => void
  onStatusChange: (status: ConnectionStatus) => void
  onChannelOpen?: () => void
}

const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    {
      urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
    },
  ],
}

export class WhiteboardPeer {
  private callbacks: WhiteboardPeerCallbacks
  private dataChannel: RTCDataChannel | null = null
  private db: Firestore
  private peerConnection: RTCPeerConnection | null = null
  private role: RoomRole | null = null
  private roomId: string | null = null
  private unsubscribers: Array<() => void> = []

  constructor(db: Firestore, callbacks: WhiteboardPeerCallbacks) {
    this.db = db
    this.callbacks = callbacks
  }

  async hostRoom(roomId: string) {
    this.reset()
    this.roomId = roomId
    this.role = 'host'
    this.callbacks.onStatusChange('connecting')

    const peerConnection = this.createPeerConnection()
    const dataChannel = peerConnection.createDataChannel('whiteboard', {
      ordered: true,
    })

    this.bindDataChannel(dataChannel)

    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    if (!peerConnection.localDescription) {
      throw new Error('Failed to create a local offer.')
    }

    await createRoomOffer(this.db, roomId, peerConnection.localDescription.toJSON())

    this.unsubscribers.push(
      listenForAnswer(this.db, roomId, (answer) => {
        if (peerConnection.currentRemoteDescription) {
          return
        }

        void peerConnection
          .setRemoteDescription(new RTCSessionDescription(answer))
          .catch((error: unknown) => {
            this.callbacks.onError(getErrorMessage(error))
            this.callbacks.onStatusChange('error')
          })
      }),
    )

    this.unsubscribers.push(
      listenForRemoteIceCandidates(this.db, roomId, 'host', (candidate) => {
        void peerConnection.addIceCandidate(candidate).catch((error: unknown) => {
          this.callbacks.onError(getErrorMessage(error))
        })
      }),
    )
  }

  async joinRoom(roomId: string) {
    this.reset()
    this.roomId = roomId
    this.role = 'guest'
    this.callbacks.onStatusChange('connecting')

    const peerConnection = this.createPeerConnection()

    peerConnection.ondatachannel = (event) => {
      this.bindDataChannel(event.channel)
    }

    const offer = await getRoomOffer(this.db, roomId)
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))

    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    if (!peerConnection.localDescription) {
      throw new Error('Failed to create a local answer.')
    }

    await setRoomAnswer(this.db, roomId, peerConnection.localDescription.toJSON())

    this.unsubscribers.push(
      listenForRemoteIceCandidates(this.db, roomId, 'guest', (candidate) => {
        void peerConnection.addIceCandidate(candidate).catch((error: unknown) => {
          this.callbacks.onError(getErrorMessage(error))
        })
      }),
    )
  }

  destroy() {
    this.reset()
    this.callbacks.onStatusChange('idle')
  }

  send(message: WhiteboardMessage) {
    if (this.dataChannel?.readyState !== 'open') {
      return false
    }

    this.dataChannel.send(JSON.stringify(message))
    return true
  }

  private bindDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel

    channel.onopen = () => {
      this.callbacks.onStatusChange('connected')
      this.callbacks.onChannelOpen?.()
    }

    channel.onclose = () => {
      this.callbacks.onStatusChange('disconnected')
    }

    channel.onerror = () => {
      this.callbacks.onError('The data channel ran into an unexpected error.')
      this.callbacks.onStatusChange('error')
    }

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WhiteboardMessage
        this.callbacks.onMessage(message)
      } catch {
        this.callbacks.onError('Received an unreadable message from the peer.')
      }
    }
  }

  private createPeerConnection() {
    const peerConnection = new RTCPeerConnection(rtcConfiguration)
    this.peerConnection = peerConnection

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !this.roomId || !this.role) {
        return
      }

      void addIceCandidate(this.db, this.roomId, this.role, event.candidate).catch(
        (error: unknown) => {
          this.callbacks.onError(getErrorMessage(error))
        },
      )
    }

    peerConnection.onconnectionstatechange = () => {
      switch (peerConnection.connectionState) {
        case 'connected':
          this.callbacks.onStatusChange('connected')
          break
        case 'connecting':
          this.callbacks.onStatusChange('connecting')
          break
        case 'disconnected':
        case 'closed':
          this.callbacks.onStatusChange('disconnected')
          break
        case 'failed':
          this.callbacks.onStatusChange('error')
          this.callbacks.onError('The peer connection failed.')
          break
        default:
          break
      }
    }

    return peerConnection
  }

  private reset() {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe())
    this.unsubscribers = []

    this.dataChannel?.close()
    this.dataChannel = null

    this.peerConnection?.close()
    this.peerConnection = null

    this.role = null
    this.roomId = null
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'An unexpected WebRTC error occurred.'
}
