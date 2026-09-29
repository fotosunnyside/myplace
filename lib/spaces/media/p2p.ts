import { DeviceMediaProvider } from './device'
import type { ConnectOptions, MediaParticipant, SignalChannel } from './types'
import type { RoomSignal } from '../types'

/**
 * Person-to-person video and audio (WebRTC), no media service needed.
 *
 * Your camera and mic work exactly as on-device; on top of that you connect straight to the people near
 * you in the room (the room session decides who with `setPeers`). Browsers introduce themselves through
 * the room's signal channel — Supabase in the cloud, a BroadcastChannel between tabs in the preview.
 * Media goes browser to browser; nothing is recorded or relayed by PLACES.
 *
 * STUN finds a direct route for most networks. Some strict networks need a TURN relay: add it with
 * NEXT_PUBLIC_ICE_SERVERS (a JSON list of RTCIceServer), e.g. from a TURN provider.
 */

const ICE_SERVERS: RTCIceServer[] = (() => {
  try {
    const custom = process.env.NEXT_PUBLIC_ICE_SERVERS
    if (custom) return JSON.parse(custom) as RTCIceServer[]
  } catch {}
  return [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
})()

/** If a call hasn't connected by then, hang up and try again. */
const CONNECT_TIMEOUT_MS = 15_000
const RETRY_MS = 4_000

interface Peer {
  id: string
  pc: RTCPeerConnection
  initiator: boolean
  video: MediaStreamTrack | null
  audio: MediaStreamTrack | null
  videoStream: MediaStream | null
  audioStream: MediaStream | null
  pendingIce: RTCIceCandidateInit[]
  timeout: ReturnType<typeof setTimeout> | null
  speaking: boolean
}

export class P2PMediaProvider extends DeviceMediaProvider {
  readonly name: string = 'p2p'

  private me = ''
  private signals: SignalChannel | null = null
  private unsubscribe: (() => void) | null = null
  private peers = new Map<string, Peer>()
  private wanted = new Set<string>()
  private retries = new Map<string, ReturnType<typeof setTimeout>>()
  private meters = new Map<string, { ctx: AudioContext; timer: ReturnType<typeof setInterval> }>()

  async connectToRoom(o: ConnectOptions) {
    await super.connectToRoom(o)
    this.me = o.identity
    this.signals = o.signals ?? null
    this.carriesRemoteMedia = !!this.signals && typeof RTCPeerConnection !== 'undefined'
    if (this.carriesRemoteMedia) this.unsubscribe = this.signals!.subscribe((s) => void this.onSignal(s))
    this.emit()
  }

  async disconnectFromRoom() {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.wanted.clear()
    for (const id of [...this.peers.keys()]) this.hangUp(id, true)
    this.retries.forEach(clearTimeout)
    this.retries.clear()
    this.signals = null
    await super.disconnectFromRoom()
  }

  setPeers(ids: string[]) {
    if (!this.carriesRemoteMedia) return
    this.wanted = new Set(ids)
    for (const id of ids) if (!this.peers.has(id) && this.me < id) void this.call(id)
    for (const id of [...this.peers.keys()]) if (!this.wanted.has(id)) this.hangUp(id, true)
  }

  async enableCamera() {
    await super.enableCamera()
    this.syncSenders()
  }
  async disableCamera() {
    await super.disableCamera()
    this.syncSenders()
  }
  async unmuteMicrophone() {
    await super.unmuteMicrophone()
    this.syncSenders()
  }
  async muteMicrophone() {
    await super.muteMicrophone()
    this.syncSenders()
  }

  /* ---------------------------------------------------------------- */

  private send(to: string, kind: RoomSignal['kind'], payload: unknown) {
    return this.signals?.send(to, kind, payload).catch(() => {})
  }

  /** Point every connection at your current camera and mic (null when off) — no renegotiation needed. */
  private syncSenders() {
    for (const peer of this.peers.values()) {
      for (const t of peer.pc.getTransceivers()) {
        const kind = t.receiver.track?.kind
        if (!t.sender || t.currentDirection === 'stopped') continue
        t.sender.replaceTrack(kind === 'video' ? this.video : kind === 'audio' ? this.audio : null).catch(() => {})
      }
    }
  }

  private newPeer(id: string, initiator: boolean): Peer {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const peer: Peer = { id, pc, initiator, video: null, audio: null, videoStream: null, audioStream: null, pendingIce: [], timeout: null, speaking: false }
    pc.onicecandidate = (e) => e.candidate && void this.send(id, 'ice', e.candidate.toJSON())
    pc.ontrack = (e) => {
      const track = e.track
      const update = () => this.publish()
      if (track.kind === 'video') {
        peer.video = track
        peer.videoStream = new MediaStream([track])
      } else {
        peer.audio = track
        peer.audioStream = new MediaStream([track])
        this.watchSpeaking(peer)
      }
      track.onmute = update
      track.onunmute = update
      track.onended = update
      update()
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected' && peer.timeout) {
        clearTimeout(peer.timeout)
        peer.timeout = null
      }
      if (pc.connectionState === 'failed') {
        this.hangUp(id, false)
        this.retryLater(id)
      }
      this.publish()
    }
    peer.timeout = setTimeout(() => {
      if (pc.connectionState === 'connected') return
      this.hangUp(id, true)
      this.retryLater(id)
    }, CONNECT_TIMEOUT_MS)
    this.peers.set(id, peer)
    return peer
  }

  private retryLater(id: string) {
    if (this.retries.has(id)) return
    this.retries.set(
      id,
      setTimeout(() => {
        this.retries.delete(id)
        if (this.wanted.has(id) && !this.peers.has(id) && this.me < id) void this.call(id)
      }, RETRY_MS),
    )
  }

  /** The person with the smaller id starts the call, so two people never call each other at once. */
  private async call(id: string) {
    const peer = this.newPeer(id, true)
    const pc = peer.pc
    try {
      pc.addTransceiver('audio', { direction: 'sendrecv' }).sender.replaceTrack(this.audio)
      pc.addTransceiver('video', { direction: 'sendrecv' }).sender.replaceTrack(this.video)
      await pc.setLocalDescription(await pc.createOffer())
      if (this.peers.get(id) !== peer) return
      await this.send(id, 'offer', pc.localDescription?.toJSON())
    } catch {
      this.hangUp(id, false)
      this.retryLater(id)
    }
  }

  private async onSignal(s: RoomSignal) {
    const payload = s.payload as (RTCSessionDescriptionInit & RTCIceCandidateInit) | null
    try {
      if (s.kind === 'offer' && payload) {
        // A fresh call replaces any half-open one (they reloaded, or the last try stalled).
        if (this.peers.has(s.from)) this.hangUp(s.from, false)
        const peer = this.newPeer(s.from, false)
        await peer.pc.setRemoteDescription(payload)
        for (const t of peer.pc.getTransceivers()) {
          t.direction = 'sendrecv'
          const kind = t.receiver.track?.kind
          await t.sender.replaceTrack(kind === 'video' ? this.video : kind === 'audio' ? this.audio : null)
        }
        await peer.pc.setLocalDescription(await peer.pc.createAnswer())
        await this.flushIce(peer)
        await this.send(s.from, 'answer', peer.pc.localDescription?.toJSON())
      } else if (s.kind === 'answer' && payload) {
        const peer = this.peers.get(s.from)
        if (!peer || peer.pc.signalingState !== 'have-local-offer') return
        await peer.pc.setRemoteDescription(payload)
        await this.flushIce(peer)
      } else if (s.kind === 'ice' && payload) {
        const peer = this.peers.get(s.from)
        if (!peer) return
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(payload).catch(() => {})
        else peer.pendingIce.push(payload)
      } else if (s.kind === 'bye') {
        this.hangUp(s.from, false)
        this.retryLater(s.from)
      }
    } catch {
      this.hangUp(s.from, false)
      this.retryLater(s.from)
    }
  }

  private async flushIce(peer: Peer) {
    const list = peer.pendingIce.splice(0)
    for (const c of list) await peer.pc.addIceCandidate(c).catch(() => {})
  }

  private hangUp(id: string, tell: boolean) {
    const peer = this.peers.get(id)
    if (!peer) return
    this.peers.delete(id)
    if (peer.timeout) clearTimeout(peer.timeout)
    const m = this.meters.get(id)
    if (m) {
      clearInterval(m.timer)
      m.ctx.close().catch(() => {})
      this.meters.delete(id)
    }
    peer.pc.onicecandidate = peer.pc.ontrack = peer.pc.onconnectionstatechange = null
    peer.pc.close()
    if (tell) void this.send(id, 'bye', {})
    this.publish()
  }

  /** Lights their circle while they talk. */
  private watchSpeaking(peer: Peer) {
    if (!peer.audioStream || this.meters.has(peer.id)) return
    try {
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(peer.audioStream).connect(analyser)
      const buf = new Uint8Array(analyser.fftSize)
      const timer = setInterval(() => {
        analyser.getByteTimeDomainData(buf)
        let peak = 0
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
        const speaking = peak > 18
        if (speaking !== peer.speaking) {
          peer.speaking = speaking
          this.publish()
        }
      }, 200)
      this.meters.set(peer.id, { ctx, timer })
    } catch {}
  }

  private publish() {
    this.remoteParticipants = [...this.peers.values()]
      .filter((p) => p.pc.connectionState === 'connected' || p.video || p.audio)
      .map<MediaParticipant>((p) => ({
        identity: p.id,
        name: '',
        isLocal: false,
        cameraOn: !!p.video && !p.video.muted && p.video.readyState === 'live',
        micOn: !!p.audio && !p.audio.muted && p.audio.readyState === 'live',
        speaking: p.speaking,
        videoStream: p.video && !p.video.muted ? p.videoStream : null,
        audioStream: p.audioStream,
      }))
    this.emit()
  }
}
