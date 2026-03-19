import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore'

import type { RoomRole } from '../types/drawing'

function getCandidateCollectionName(role: RoomRole) {
  return role === 'host' ? 'callerCandidates' : 'calleeCandidates'
}

function getRemoteCandidateCollectionName(role: RoomRole) {
  return role === 'host' ? 'calleeCandidates' : 'callerCandidates'
}

export async function createRoomOffer(
  db: Firestore,
  roomId: string,
  offer: RTCSessionDescriptionInit,
) {
  await setDoc(doc(db, 'rooms', roomId), {
    offer,
    status: 'waiting',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function getRoomOffer(db: Firestore, roomId: string) {
  const roomSnapshot = await getDoc(doc(db, 'rooms', roomId))

  if (!roomSnapshot.exists()) {
    throw new Error('The requested room does not exist.')
  }

  const roomData = roomSnapshot.data()
  const offer = roomData.offer as RTCSessionDescriptionInit | undefined

  if (!offer) {
    throw new Error('This room has no offer yet. Ask the host to recreate the room.')
  }

  return offer
}

export async function setRoomAnswer(
  db: Firestore,
  roomId: string,
  answer: RTCSessionDescriptionInit,
) {
  await updateDoc(doc(db, 'rooms', roomId), {
    answer,
    status: 'connected',
    updatedAt: serverTimestamp(),
  })
}

export function listenForAnswer(
  db: Firestore,
  roomId: string,
  onAnswer: (answer: RTCSessionDescriptionInit) => void,
) {
  return onSnapshot(doc(db, 'rooms', roomId), (snapshot) => {
    const data = snapshot.data()
    const answer = data?.answer as RTCSessionDescriptionInit | undefined

    if (answer) {
      onAnswer(answer)
    }
  })
}

export async function addIceCandidate(
  db: Firestore,
  roomId: string,
  role: RoomRole,
  candidate: RTCIceCandidate,
) {
  await addDoc(
    collection(db, 'rooms', roomId, getCandidateCollectionName(role)),
    candidate.toJSON(),
  )
}

export function listenForRemoteIceCandidates(
  db: Firestore,
  roomId: string,
  role: RoomRole,
  onCandidate: (candidate: RTCIceCandidate) => void,
) {
  return onSnapshot(
    collection(db, 'rooms', roomId, getRemoteCandidateCollectionName(role)),
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') {
          return
        }

        onCandidate(new RTCIceCandidate(change.doc.data()))
      })
    },
  )
}
