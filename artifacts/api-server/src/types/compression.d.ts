declare module "compression" {
  import type { RequestHandler } from "express";

  type CompressionOptions = {
    threshold?: number | string;
    brotli?: { params?: Record<number, number> };
  };

  export default function compression(options?: CompressionOptions): RequestHandler;
}
