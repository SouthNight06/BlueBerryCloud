const MIN_BPM = 56;
const MAX_BPM = 208;
const WINDOW = 48;
const FOLDS = [
  { ratio: 0.5, weight: 0.7 },
  { ratio: 2 / 3, weight: 0.45 },
  { ratio: 1, weight: 1 },
  { ratio: 1.5, weight: 0.5 },
  { ratio: 2, weight: 0.8 },
  { ratio: 3, weight: 0.35 },
];

export type TempoReading = {
  bpm: number;
  confidence: number;
};

export class TempoTracker {
  private intervals: number[] = [];
  private lastOnset = 0;
  private target = 0;
  private stable = 0;
  private value = 0;
  private level = 0;

  reset() {
    this.intervals.length = 0;
    this.lastOnset = 0;
    this.target = 0;
    this.stable = 0;
    this.value = 0;
    this.level = 0;
  }

  onset(now: number) {
    if (this.lastOnset > 0) {
      const gap = now - this.lastOnset;
      if (gap >= 180 && gap <= 2200) {
        this.intervals.push(gap);
        if (this.intervals.length > WINDOW) this.intervals.shift();
      }
    }
    this.lastOnset = now;
  }

  read(): TempoReading {
    return { bpm: this.value, confidence: this.level };
  }

  analyse(): TempoReading {
    const count = this.intervals.length;
    if (count < 6) {
      this.target = 0;
      this.value = 0;
      this.level = 0;
      return this.read();
    }

    const votes = new Map<number, number>();
    let total = 0;
    for (let i = 0; i < count; i += 1) {
      const base = 60000 / this.intervals[i];
      const recency = 1 + i * 0.05;
      let mass = 0;
      for (let f = 0; f < FOLDS.length; f += 1) {
        const bpm = base * FOLDS[f].ratio;
        if (bpm >= MIN_BPM && bpm <= MAX_BPM) mass += FOLDS[f].weight;
      }
      if (mass <= 0) continue;
      const unit = recency / mass;
      for (let f = 0; f < FOLDS.length; f += 1) {
        const bpm = base * FOLDS[f].ratio;
        if (bpm < MIN_BPM || bpm > MAX_BPM) continue;
        const key = Math.round(bpm / 2) * 2;
        const vote = unit * FOLDS[f].weight;
        votes.set(key, (votes.get(key) ?? 0) + vote);
        total += vote;
      }
    }

    let bestKey = 0;
    let bestVote = 0;
    votes.forEach((vote, key) => {
      if (vote > bestVote) {
        bestVote = vote;
        bestKey = key;
      }
    });
    if (!bestKey || total <= 0) {
      this.level = 0;
      return this.read();
    }

    const jump = this.target > 0 ? Math.abs(bestKey - this.target) : 0;
    this.stable = jump <= 6 ? Math.min(1, this.stable + 0.3) : 0.3;
    this.target = bestKey;
    this.level = Math.min(1, (bestVote / total) * 1.7) * this.stable;
    this.value = this.value > 0 ? this.value * 0.82 + this.target * 0.18 : this.target;
    return this.read();
  }
}

export function tempoStrengthFactor(bpm: number, confidence: number): number {
  if (bpm < MIN_BPM || confidence < 0.12) return 1;
  const trust = Math.min(1, Math.sqrt(confidence) * 2.1);
  const raw = 1 + (bpm - 100) * 0.0058;
  const shaped = Math.min(1.38, Math.max(0.74, raw));
  return 1 + (shaped - 1) * trust;
}
