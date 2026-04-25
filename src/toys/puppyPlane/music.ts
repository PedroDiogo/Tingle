import { playPiano } from "../../audio";

interface Note {
  midi: number;
  beat: number;
  vel: number;
}

const BPM = 132;
const BEAT_MS = 60000 / BPM;
const TOTAL_BEATS = 16; // 4 bars

// I-V-vi-IV in D major (D, A, Bm, G) — bouncy adventurous riff.
// Bass on beat 1 of each bar; melody arpeggio across the 4 beats.
const SCORE: Note[] = [
  // Bar 1: D major
  { midi: 50, beat: 0, vel: 0.75 },   // D3 bass
  { midi: 74, beat: 0, vel: 0.6 },    // D5
  { midi: 78, beat: 1, vel: 0.55 },   // F#5
  { midi: 81, beat: 2, vel: 0.65 },   // A5
  { midi: 78, beat: 3, vel: 0.5 },    // F#5
  // Bar 2: A major
  { midi: 45, beat: 4, vel: 0.75 },   // A2 bass
  { midi: 73, beat: 4, vel: 0.6 },    // C#5
  { midi: 76, beat: 5, vel: 0.55 },   // E5
  { midi: 81, beat: 6, vel: 0.65 },   // A5
  { midi: 76, beat: 7, vel: 0.5 },    // E5
  // Bar 3: B minor
  { midi: 47, beat: 8, vel: 0.75 },   // B2 bass
  { midi: 71, beat: 8, vel: 0.6 },    // B4
  { midi: 74, beat: 9, vel: 0.55 },   // D5
  { midi: 78, beat: 10, vel: 0.65 },  // F#5
  { midi: 74, beat: 11, vel: 0.5 },   // D5
  // Bar 4: G major (turnaround back to D)
  { midi: 43, beat: 12, vel: 0.75 },  // G2 bass
  { midi: 67, beat: 12, vel: 0.6 },   // G4
  { midi: 71, beat: 13, vel: 0.55 },  // B4
  { midi: 74, beat: 14, vel: 0.65 },  // D5
  { midi: 76, beat: 15, vel: 0.6 }    // E5 lead-back
];

export class Music {
  private timers: number[] = [];
  private active = false;
  private duck = 1;
  private duckTimer: number | null = null;

  start() {
    if (this.active) return;
    this.active = true;
    this.scheduleLoop(0);
  }

  stop() {
    this.active = false;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    if (this.duckTimer !== null) {
      clearTimeout(this.duckTimer);
      this.duckTimer = null;
    }
    this.duck = 1;
  }

  duckFor(ms: number) {
    this.duck = 0.25;
    if (this.duckTimer !== null) clearTimeout(this.duckTimer);
    this.duckTimer = window.setTimeout(() => {
      this.duck = 1;
      this.duckTimer = null;
    }, ms);
  }

  private scheduleLoop(offsetMs: number) {
    if (!this.active) return;
    for (const note of SCORE) {
      const ms = offsetMs + note.beat * BEAT_MS;
      const t = window.setTimeout(() => {
        if (!this.active) return;
        playPiano(note.midi, note.vel * this.duck);
      }, ms);
      this.timers.push(t);
    }
    const nextMs = offsetMs + TOTAL_BEATS * BEAT_MS;
    const next = window.setTimeout(() => this.scheduleLoop(0), nextMs);
    this.timers.push(next);
  }
}
