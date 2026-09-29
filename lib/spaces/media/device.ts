import { MediaDeviceError, deviceErrorKind, type ConnectOptions, type MediaConnectionState, type MediaParticipant, type MediaProvider } from './types'

/**
 * On-device media: real camera and microphone, no network.
 *
 * Used until a live video provider is connected. You see and control your own bubble; other people
 * appear through presence (name, camera/mic status) but their video and audio can't reach you, and
 * yours can't reach them. The room says so plainly.
 */
export class DeviceMediaProvider implements MediaProvider {
  readonly name: string = 'device'
  carriesRemoteMedia = false
  readonly needsToken: boolean = false

  state: MediaConnectionState = 'disconnected'
  localParticipant: MediaParticipant | null = null
  remoteParticipants: MediaParticipant[] = []

  protected video: MediaStreamTrack | null = null
  protected videoStream: MediaStream | null = null
  protected audio: MediaStreamTrack | null = null
  private listeners = new Set<() => void>()
  protected meter: { ctx: AudioContext; timer: ReturnType<typeof setInterval> } | null = null

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  protected emit() {
    if (this.localParticipant) {
      this.localParticipant = {
        ...this.localParticipant,
        cameraOn: !!this.video && this.video.readyState === 'live',
        micOn: !!this.audio && this.audio.enabled && this.audio.readyState === 'live',
        videoStream: this.video ? this.videoStream : null,
      }
    }
    this.listeners.forEach((l) => l())
  }

  async connectToRoom(o: ConnectOptions) {
    this.state = 'connecting'
    this.emit()
    this.localParticipant = { identity: o.identity, name: o.name, isLocal: true, cameraOn: false, micOn: false, speaking: false, videoStream: null, audioStream: null }
    this.state = 'connected'
    this.emit()
  }

  async disconnectFromRoom() {
    this.stopMeter()
    this.video?.stop()
    this.audio?.stop()
    this.video = this.audio = null
    this.videoStream = null
    this.localParticipant = null
    this.state = 'disconnected'
    this.emit()
  }

  private async capture(kind: 'camera' | 'microphone') {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) throw new MediaDeviceError(kind, 'insecure')
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === 'camera'
          ? { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } } }
          : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } },
      )
      return stream.getTracks()[0]
    } catch (e) {
      throw new MediaDeviceError(kind, deviceErrorKind(e))
    }
  }

  async enableCamera() {
    if (this.video?.readyState === 'live') return
    const track = await this.capture('camera')
    if (this.state !== 'connected') return track.stop() // left while the prompt was open
    track.addEventListener('ended', () => {
      this.video = null
      this.emit()
    })
    this.video = track
    this.videoStream = new MediaStream([track])
    this.emit()
  }

  async disableCamera() {
    // Stopping (not just disabling) the track turns the camera light off.
    this.video?.stop()
    this.video = null
    this.videoStream = null
    this.emit()
  }

  async unmuteMicrophone() {
    if (!this.audio || this.audio.readyState !== 'live') {
      const track = await this.capture('microphone')
      if (this.state !== 'connected') return track.stop()
      track.addEventListener('ended', () => {
        this.audio = null
        this.stopMeter()
        this.emit()
      })
      this.audio = track
      this.startMeter(track)
    }
    this.audio.enabled = true
    this.emit()
  }

  async muteMicrophone() {
    this.audio?.stop()
    this.audio = null
    this.stopMeter()
    this.emit()
  }

  /** Lights your bubble while you talk. */
  private startMeter(track: MediaStreamTrack) {
    this.stopMeter()
    try {
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser)
      const buf = new Uint8Array(analyser.fftSize)
      const timer = setInterval(() => {
        analyser.getByteTimeDomainData(buf)
        let peak = 0
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
        const speaking = peak > 18 && !!this.audio?.enabled
        if (this.localParticipant && speaking !== this.localParticipant.speaking) {
          this.localParticipant = { ...this.localParticipant, speaking }
          this.listeners.forEach((l) => l())
        }
      }, 180)
      this.meter = { ctx, timer }
    } catch {
      // Speaking indicator is a nicety; rooms work without it.
    }
  }

  private stopMeter() {
    if (!this.meter) return
    clearInterval(this.meter.timer)
    this.meter.ctx.close().catch(() => {})
    this.meter = null
    if (this.localParticipant?.speaking) this.localParticipant = { ...this.localParticipant, speaking: false }
  }
}
