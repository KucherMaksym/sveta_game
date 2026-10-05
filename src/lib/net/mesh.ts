import type { SignalData } from '@/lib/game/types';

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

type Peer = { pc: RTCPeerConnection; stream: MediaStream; chain: Promise<void> };

/**
 * Full-mesh WebRTC between the three players. Every stream is sent to everyone;
 * who may see or hear whom is decided at playback time by the game rules.
 */
export class Mesh {
  private peers = new Map<string, Peer>();

  constructor(
    private local: MediaStream,
    private sendSignal: (to: string, data: SignalData) => void,
    private onChange: () => void,
  ) {}

  streams() {
    return Object.fromEntries([...this.peers].map(([id, p]) => [id, p.stream]));
  }

  connect(id: string) {
    this.create(id, true);
  }

  signal(from: string, data: SignalData) {
    const peer = this.peers.get(from) ?? this.create(from, false);
    const { pc } = peer;
    peer.chain = peer.chain.then(async () => {
      if (data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === 'offer') {
          // Added after the offer so the tracks reuse the offered transceivers.
          for (const track of this.local.getTracks()) pc.addTrack(track, this.local);
          await pc.setLocalDescription(await pc.createAnswer());
          this.sendSignal(from, { sdp: pc.localDescription!.toJSON() });
        }
      } else if (data.candidate) {
        await pc.addIceCandidate(data.candidate).catch(() => {});
      }
    }).catch(() => {});
  }

  remove(id: string) {
    this.peers.get(id)?.pc.close();
    this.peers.delete(id);
    this.onChange();
  }

  close() {
    for (const p of this.peers.values()) p.pc.close();
    this.peers.clear();
  }

  private create(id: string, initiator: boolean) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer: Peer = { pc, stream: new MediaStream(), chain: Promise.resolve() };
    this.peers.set(id, peer);

    pc.onicecandidate = (e) => e.candidate && this.sendSignal(id, { candidate: e.candidate.toJSON() });
    pc.ontrack = (e) => {
      peer.stream.addTrack(e.track);
      // A fresh MediaStream object makes React re-attach it to <video>/<audio>.
      peer.stream = new MediaStream(peer.stream.getTracks());
      this.onChange();
    };

    if (initiator) {
      // Always negotiate both kinds so the other side can send even if we have no camera/mic.
      for (const kind of ['audio', 'video'] as const) {
        const track = this.local.getTracks().find((t) => t.kind === kind);
        if (track) pc.addTrack(track, this.local);
        else pc.addTransceiver(kind);
      }
      peer.chain = peer.chain.then(async () => {
        await pc.setLocalDescription(await pc.createOffer());
        this.sendSignal(id, { sdp: pc.localDescription!.toJSON() });
      });
    }
    this.onChange();
    return peer;
  }
}
