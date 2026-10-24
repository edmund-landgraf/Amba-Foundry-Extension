export function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('AMBA URL must be an HTTP(S) origin without credentials, query, or hash.');
  }
  return url.href.replace(/\/$/, '');
}

export function makeAmbaClient(baseUrl, fetchImpl = fetch) {
  const root = normalizeBaseUrl(baseUrl);
  async function getJson(path) {
    const response = await fetchImpl(`${root}${path}`, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`AMBA request failed (${response.status}) for ${path}`);
    return response.json();
  }
  return {
    listModules: () => getJson('/api/modules'),
    listEncounters: (moduleId) => getJson(`/api/modules/${encodeURIComponent(moduleId)}/encounters`),
    getEncounter: (moduleId, encounterId) => getJson(`/api/modules/${encodeURIComponent(moduleId)}/encounters/${encodeURIComponent(encounterId)}`)
  };
}

export function asArray(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
}

export function itemId(item) { return item?.id ?? item?.encounterId ?? item?.slug ?? null; }
export function itemLabel(item) { return item?.title ?? item?.name ?? item?.label ?? String(itemId(item) ?? 'Untitled'); }
