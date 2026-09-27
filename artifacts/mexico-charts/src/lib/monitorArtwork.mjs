export function missingArtworkBatches(items, size = 12) {
  const keys = [...new Set(items.filter(item => !item.artworkUrl && /^(track|album)$/.test(item.type) && /^[A-Za-z0-9]{22}$/.test(item.key))
    .map(item => `${item.type}:${item.key}`))];
  return Array.from({ length: Math.ceil(keys.length / size) }, (_, i) => keys.slice(i * size, (i + 1) * size));
}

export function validateArtworkResponse(payload, requested) {
  if (!Array.isArray(payload?.items) || payload.items.length !== requested.length ||
    new Set(payload.items.map(item => item.resource)).size !== requested.length ||
    payload.items.some(item => !requested.includes(item.resource) || !["loaded", "pending"].includes(item.status) ||
      (item.status === "loaded" && (typeof item.artworkUrl !== "string" || !/^https:\/\//.test(item.artworkUrl))))) {
    throw new Error("Invalid artwork response");
  }
  return payload.items;
}
