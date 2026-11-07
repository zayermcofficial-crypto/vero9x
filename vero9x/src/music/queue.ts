export interface MusicTrack {
  encoded: string; title: string; author: string; uri: string | null;
  length: number; isStream: boolean; artwork: string | null; requesterId: string;
}
export type LoopMode = 'off' | 'track' | 'queue';
export const MAX_QUEUE = 500;
const MAX_HISTORY = 25;

/** Pure queue logic (no Discord / Lavalink), so it can be tested on its own. */
export class Queue {
  current: MusicTrack | null = null;
  upcoming: MusicTrack[] = [];
  history: MusicTrack[] = [];
  loop: LoopMode = 'off';

  /** Adds tracks up to MAX_QUEUE. Returns how many were added. */
  add(tracks: MusicTrack[]): number {
    const room = Math.max(0, MAX_QUEUE - this.upcoming.length - (this.current ? 1 : 0));
    const take = tracks.slice(0, room);
    this.upcoming.push(...take);
    return take.length;
  }

  /** Move to the next track. `ignoreTrackLoop` is used by skip and by failed tracks. */
  advance(ignoreTrackLoop = false): MusicTrack | null {
    if (this.current) {
      if (this.loop === 'track' && !ignoreTrackLoop) return this.current;
      this.history.push(this.current);
      if (this.history.length > MAX_HISTORY) this.history.shift();
      if (this.loop === 'queue') this.upcoming.push(this.current);
    }
    this.current = this.upcoming.shift() ?? null;
    return this.current;
  }
  skip(): MusicTrack | null { return this.advance(true); }

  previous(): MusicTrack | null {
    const prev = this.history.pop();
    if (!prev) return null;
    if (this.loop === 'queue') { const i = this.upcoming.lastIndexOf(prev); if (i >= 0) this.upcoming.splice(i, 1); }
    if (this.current) this.upcoming.unshift(this.current);
    this.current = prev;
    return prev;
  }

  shuffle(): void {
    for (let i = this.upcoming.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.upcoming[i], this.upcoming[j]] = [this.upcoming[j], this.upcoming[i]];
    }
  }
  /** 1-based position in the upcoming list. */
  remove(position: number): MusicTrack | null {
    if (!Number.isInteger(position) || position < 1 || position > this.upcoming.length) return null;
    return this.upcoming.splice(position - 1, 1)[0];
  }
  clearUpcoming(): number { const n = this.upcoming.length; this.upcoming = []; return n; }
  clearAll(): void { this.current = null; this.upcoming = []; this.history = []; }
  totalLength(): number { return this.upcoming.reduce((a, t) => a + (t.isStream ? 0 : t.length), 0); }
}
