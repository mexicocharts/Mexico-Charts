import type { ImgHTMLAttributes } from "react";

type CertificationTier = "DIAMANTE" | "PLATINO" | "ORO";
type CertificationBadgeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "width" | "height"> & {
  tier: CertificationTier;
  size: number;
};

const FILENAMES: Record<CertificationTier, string> = {
  DIAMANTE: "diamond",
  PLATINO: "platinum",
  ORO: "gold",
};

export default function CertificationBadgeImage({ tier, size, alt, loading = "lazy", ...props }: CertificationBadgeImageProps) {
  const base = import.meta.env.BASE_URL;
  const filename = FILENAMES[tier];
  const label = tier === "DIAMANTE" ? "Diamante" : tier === "PLATINO" ? "Platino" : "Oro";
  return (
    <img
      {...props}
      src={`${base}images/ui/cert-${filename}-ui-v1-128.png`}
      srcSet={`${base}images/ui/cert-${filename}-ui-v1-64.png 64w, ${base}images/ui/cert-${filename}-ui-v1-128.png 128w, ${base}images/ui/cert-${filename}-ui-v1-192.png 192w`}
      sizes={`${size}px`}
      alt={alt ?? label}
      width={size}
      height={size}
      loading={loading}
      decoding="async"
    />
  );
}
