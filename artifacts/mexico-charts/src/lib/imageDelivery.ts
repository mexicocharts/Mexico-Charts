export type ResponsiveImageSource = {
  src: string;
  srcSet?: string;
  sizes?: string;
};

function replaceYouTubeVariant(url: string, variant: string) {
  return url.replace(/\/(?:default|mqdefault|hqdefault|sddefault|maxresdefault)\.jpg(?:\?.*)?$/i, `/${variant}.jpg`);
}

function replaceSquareCdnSize(url: string, size: number) {
  if (/\.dzcdn\.net$/i.test(new URL(url).hostname)) {
    return url.replace(/\/\d+x\d+-/i, `/${size}x${size}-`);
  }
  if (/\.mzstatic\.com$/i.test(new URL(url).hostname)) {
    return url.replace(/\/\d+x\d+(?=bb\.(?:jpg|webp|png))/i, `/${size}x${size}`);
  }
  return url;
}

/**
 * Uses only documented/provider-native image variants. Unknown hosts retain
 * their original URL so image identity and fallback behavior never change.
 */
export function responsiveImageSource(src: string, displayWidth: number): ResponsiveImageSource {
  try {
    const hostname = new URL(src, "https://mexicochart.com").hostname;
    if (hostname === "img.youtube.com" || hostname === "i.ytimg.com") {
      return {
        src: replaceYouTubeVariant(src, "default"),
        srcSet: `${replaceYouTubeVariant(src, "default")} 120w, ${replaceYouTubeVariant(src, "mqdefault")} 320w`,
        sizes: `${displayWidth}px`,
      };
    }
    if (/\.dzcdn\.net$/i.test(hostname) || /\.mzstatic\.com$/i.test(hostname)) {
      return {
        src: replaceSquareCdnSize(src, 96),
        srcSet: `${replaceSquareCdnSize(src, 96)} 96w, ${replaceSquareCdnSize(src, 192)} 192w`,
        sizes: `${displayWidth}px`,
      };
    }
  } catch {
    // Invalid URLs retain the existing source and fail through the current UI fallback.
  }
  return { src };
}
