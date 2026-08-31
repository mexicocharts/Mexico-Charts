import type { ImgHTMLAttributes } from "react";
import { responsiveImageSource } from "@/lib/imageDelivery";

type ResponsiveThumbnailProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "sizes" | "width" | "height"> & {
  src: string;
  width: number;
  height: number;
};

export default function ResponsiveThumbnail({ src, width, height, loading = "lazy", decoding = "async", ...props }: ResponsiveThumbnailProps) {
  const delivered = responsiveImageSource(src, width);
  return (
    <img
      {...props}
      {...delivered}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
    />
  );
}
