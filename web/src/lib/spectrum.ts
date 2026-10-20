export const WAVE_BANDS = 56;

type WaveBus = {
  levels: Float32Array;
  energy: number;
  beat: number;
  squash: number;
  lift: number;
  active: boolean;
};

export const waveBus: WaveBus = {
  levels: new Float32Array(WAVE_BANDS),
  energy: 0,
  beat: 0,
  squash: 0,
  lift: 0,
  active: false,
};

export function resetWaveBus() {
  waveBus.energy = 0;
  waveBus.beat = 0;
  waveBus.squash = 0;
  waveBus.lift = 0;
  waveBus.active = false;
}

export function bandRanges(
  bins: number,
  sampleRate: number,
  count = WAVE_BANDS,
  minHz = 36,
  maxHz = 14000,
): Array<[number, number]> {
  const binHz = sampleRate / 2 / bins;
  const lower = Math.log(Math.max(minHz, binHz));
  const upper = Math.log(Math.min(maxHz, sampleRate / 2));
  const ranges: Array<[number, number]> = [];
  for (let i = 0; i < count; i += 1) {
    const startHz = Math.exp(lower + ((upper - lower) * i) / count);
    const endHz = Math.exp(lower + ((upper - lower) * (i + 1)) / count);
    const from = Math.max(1, Math.floor(startHz / binHz));
    const to = Math.min(bins - 1, Math.max(from, Math.ceil(endHz / binHz) - 1));
    ranges.push([from, to]);
  }
  return ranges;
}
