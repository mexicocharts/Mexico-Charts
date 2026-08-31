export const FLAT_STATIC_ROUTE_TARGETS = new Map([
  ["/charts/spotify", "charts-spotify.html"],
  ["/charts/youtube", "charts-youtube.html"],
  ["/charts/apple-music", "charts-apple-music.html"],
  ["/charts/deezer", "charts-deezer.html"],
]);

export function staticOutputRelativePath(routePath) {
  if (routePath === "/") return "index.html";
  return FLAT_STATIC_ROUTE_TARGETS.get(routePath) ?? routePath.slice(1);
}
