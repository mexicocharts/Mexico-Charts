import type { ImgHTMLAttributes } from "react";

type BrandLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "width" | "height"> & {
  size: number;
};

export default function BrandLogo({ size, alt = "Mexico Charts", loading = "lazy", ...props }: BrandLogoProps) {
  const base = import.meta.env.BASE_URL;
  return (
    <img
      {...props}
      src={`${base}images/ui/mexico-charts-logo-ui-v1-128.png`}
      srcSet={`${base}images/ui/mexico-charts-logo-ui-v1-64.png 64w, ${base}images/ui/mexico-charts-logo-ui-v1-128.png 128w, ${base}images/ui/mexico-charts-logo-ui-v1-192.png 192w`}
      sizes={`${size}px`}
      alt={alt}
      width={size}
      height={size}
      loading={loading}
      decoding="async"
    />
  );
}
