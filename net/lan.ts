/**
 * LAN multiplayer transport for Gambit Vanguard.
 *
 * Two devices on the same local network (for example the same Wi-Fi)
 * connect directly with WebRTC. There is no server of any kind: the
 * peers exchange one pairing code each, by hand or by QR code, and
 * the data channel then runs device-to-device over the local
 * network. ICE is restricted to host candidates, so traffic never
 * leaves the LAN and no external service is contacted.
 */

export type LanRole = 'host' | 'guest';

export interface DuelInput {
  moveX: number; // -1..1 strafe
  moveZ: number; // -1..1 forward/back
  yaw: number;
  pitch: number;
  firing: boolean;
  reload: boolean; // edge-triggered: true for one send after pressing reload
}

export interface DuelSnapshot {
  t: number; // host clock, seconds
  hostPos: [number, number, number];
  hostRot: {yaw: number; pitch: number};
  hostHp: number;
  guestPos: [number, number, number];
  guestRot: {yaw: number; pitch: number};
  guestHp: number;
  guestAmmo: number;
  guestMaxAmmo: number;
  guestMaxHp: number;
  guestReloading: boolean;
  hostAmmo: number;
  hostMaxAmmo: number;
  hostMaxHp: number;
  hostReloading: boolean;
  timeLeft: number;
  bullets: {
    id: number;
    pos: [number, number, number];
    vel: [number, number, number];
    color: string;
    radius: number;
    fromHost: boolean;
  }[];
}

export type LanMessage =
  | {type: 'hello'}
  | {type: 'state'; snap: unknown}
  | {type: 'move-intent'; pieceId: string; row: number; col: number}
  | {type: 'duel-input'; input: DuelInput}
  | {type: 'duel-snap'; snap: DuelSnapshot}
  | {type: 'perk-offer'; pieceId: string; options: string[]}
  | {type: 'perk-pick'; perkId: string};

interface PairingPayload {
  sdp: RTCSessionDescriptionInit;
}

function encodePayload(payload: PairingPayload): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function decodePayload(code: string): PairingPayload {
  return JSON.parse(decodeURIComponent(escape(atob(code.trim())))) as PairingPayload;
}

export class LanPeer {
  readonly role: LanRole;
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  onMessage: ((msg: LanMessage) => void) | null = null;
  onOpen: (() => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(role: LanRole) {
    this.role = role;
    // No ICE servers: host candidates only, so pairing works purely
    // over the local network and nothing external is contacted.
    this.pc = new RTCPeerConnection({iceServers: []});
    this.pc.onconnectionstatechange = () => {
      if (
        this.pc.connectionState === 'disconnected' ||
        this.pc.connectionState === 'failed' ||
        this.pc.connectionState === 'closed'
      ) {
        this.onClose?.();
      }
    };
    if (role === 'host') {
      this.channel = this.pc.createDataChannel('gambit', {ordered: true});
      this.wireChannel(this.channel);
    } else {
      this.pc.ondatachannel = (e) => {
        this.channel = e.channel;
        this.wireChannel(this.channel);
      };
    }
  }

  private wireChannel(channel: RTCDataChannel) {
    channel.onopen = () => this.onOpen?.();
    channel.onclose = () => this.onClose?.();
    channel.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as LanMessage;
        this.onMessage?.(msg);
      } catch {
        // Ignore malformed frames.
      }
    };
  }

  private waitForIceComplete(): Promise<void> {
    if (this.pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        if (this.pc.iceGatheringState === 'complete') {
          this.pc.removeEventListener('icegatheringstatechange', check);
          resolve();
        }
      };
      this.pc.addEventListener('icegatheringstatechange', check);
    });
  }

  /** Host step 1: create the pairing code to give to the guest. */
  async createOfferCode(): Promise<string> {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.waitForIceComplete();
    return encodePayload({sdp: this.pc.localDescription!});
  }

  /** Guest step 1: consume the host code, produce the reply code. */
  async acceptOfferCode(code: string): Promise<string> {
    const payload = decodePayload(code);
    await this.pc.setRemoteDescription(payload.sdp);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this.waitForIceComplete();
    return encodePayload({sdp: this.pc.localDescription!});
  }

  /** Host step 2: consume the guest reply code; the channel opens. */
  async acceptAnswerCode(code: string): Promise<void> {
    const payload = decodePayload(code);
    await this.pc.setRemoteDescription(payload.sdp);
  }

  get connected(): boolean {
    return this.channel?.readyState === 'open';
  }

  send(msg: LanMessage) {
    if (this.channel?.readyState === 'open') {
      this.channel.send(JSON.stringify(msg));
    }
  }

  close() {
    try {
      this.channel?.close();
      this.pc.close();
    } catch {
      // Already closed.
    }
  }
}
