// C major pentatonic: C D E G A (C5..A5) plus octave C6.
// Any combination of these notes sounds consonant.
export interface BubbleKind {
  color: number;
  freq: number;
}

export const PALETTE: BubbleKind[] = [
  { color: 0xff6b9d, freq: 523.25 }, // C5  - pink
  { color: 0xffd166, freq: 587.33 }, // D5  - yellow
  { color: 0x8ee36b, freq: 659.25 }, // E5  - green
  { color: 0x6bc7ff, freq: 783.99 }, // G5  - sky blue
  { color: 0xc490ff, freq: 880.0 },  // A5  - lavender
  { color: 0xff9a6b, freq: 1046.5 }  // C6  - peach
];

export function pickKind(): BubbleKind {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}
