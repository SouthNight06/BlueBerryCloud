import { bilibiliSource } from "./bilibili.js";
import { demoSource } from "./demoCatalog.js";
import { internetArchiveSource } from "./internetArchive.js";

const registry = new Map();
registry.set(demoSource.id, demoSource);
registry.set(internetArchiveSource.id, internetArchiveSource);
registry.set(bilibiliSource.id, bilibiliSource);

export function listSources() {
  return [...registry.values()].map(
    ({ id, name, description, supportsDownload, offline }) => ({
      id,
      name,
      description,
      supportsDownload,
      offline: Boolean(offline),
    }),
  );
}

export function getSource(id) {
  return registry.get(id) ?? null;
}

export const ALL_SOURCES = "all";

export async function searchAll(query, { limit = 20, userId = null } = {}) {
  const adapters = [...registry.values()];
  const outcomes = await Promise.allSettled(
    adapters.map((adapter) => adapter.search(query, { limit, userId })),
  );

  const results = [];
  const status = outcomes.map((outcome, index) => {
    const adapter = adapters[index];
    if (outcome.status === "fulfilled") {
      results.push(...outcome.value);
      return {
        id: adapter.id,
        name: adapter.name,
        ok: true,
        count: outcome.value.length,
      };
    }
    return {
      id: adapter.id,
      name: adapter.name,
      ok: false,
      error: String(outcome.reason?.message ?? "failed"),
    };
  });

  return { results, status };
}
