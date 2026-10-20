export type LrcLine = {
  time: number;
  text: string;
};

export type ParsedLyric = {
  lines: LrcLine[];
  synced: boolean;
  offset: number;
};

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const META_TAG = /\[[a-z#]+:[^\]]*\]/gi;

function toSeconds(minute: string, second: string, fraction?: string): number {
  const base = Number(minute) * 60 + Number(second);
  if (!fraction) return base;
  return base + Number(fraction) / 10 ** fraction.length;
}

export function parseLrc(raw: string): ParsedLyric {
  const text = raw ?? "";
  const offsetMatch = text.match(/\[offset:\s*([+-]?\d+)\s*\]/i);
  const offset = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0;

  const lines: LrcLine[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const content = rawLine.replace(META_TAG, "").replace(/\[[^\]]*\]/g, "").trim();
    if (!content) continue;

    TIME_TAG.lastIndex = 0;
    let match: RegExpExecArray | null;
    const stamps: number[] = [];
    while ((match = TIME_TAG.exec(rawLine))) {
      stamps.push(toSeconds(match[1], match[2], match[3]));
    }
    for (const time of stamps) {
      lines.push({ time: Math.max(0, time - offset), text: content });
    }
  }

  lines.sort((a, b) => a.time - b.time);

  const unique: LrcLine[] = [];
  for (const line of lines) {
    const previous = unique[unique.length - 1];
    if (previous && previous.time === line.time && previous.text === line.text) continue;
    unique.push(line);
  }

  return { lines: unique, synced: unique.length > 0, offset };
}

export function activeLineIndex(lines: LrcLine[], time: number): number {
  if (lines.length === 0) return -1;
  if (time < lines[0].time) return -1;
  let low = 0;
  let high = lines.length - 1;
  let result = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].time <= time) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}
