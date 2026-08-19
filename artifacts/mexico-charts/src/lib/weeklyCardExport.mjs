export function exportSafeImageUrl(url) {
  if (!url) return null;
  if (url.startsWith("/") || !url.includes("://")) return url;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

export function weeklyCardRenderOptions() {
  return {
    width: 1080,
    height: 1350,
    pixelRatio: 2,
    cacheBust: false,
    backgroundColor: "#070707",
    // The card uses fonts that are already loaded in the page. Supplying this
    // value prevents html-to-image from trying to read Google Fonts' protected
    // cross-origin stylesheet, which otherwise aborts the PNG export.
    fontEmbedCSS: "",
  };
}

export async function waitForExportImages(node, timeoutMs = 15_000) {
  const images = Array.from(node.querySelectorAll("img[src]"));
  if (!images.length) return;

  const ready = Promise.all(images.map(async (image) => {
    if (image.complete) {
      if (image.naturalWidth > 0) return;
      throw new Error(`No se pudo cargar una imagen para la tarjeta: ${image.currentSrc || image.src}`);
    }

    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", () => reject(new Error(`No se pudo cargar una imagen para la tarjeta: ${image.currentSrc || image.src}`)), { once: true });
    });

    if (typeof image.decode === "function") await image.decode();
    if (image.naturalWidth <= 0) throw new Error(`La imagen de la tarjeta llegó vacía: ${image.currentSrc || image.src}`);
  }));

  let timer;
  try {
    await Promise.race([
      ready,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Las imágenes tardaron demasiado en prepararse. Intenta descargar otra vez.")), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function prepareWeeklyCardForExport(node) {
  if (typeof document !== "undefined" && document.fonts?.ready) await document.fonts.ready;
  await waitForExportImages(node);
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
