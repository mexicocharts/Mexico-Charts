export function exportSafeImageUrl(url: string | null | undefined): string | null;
export function weeklyCardRenderOptions(): {
  width: number;
  height: number;
  pixelRatio: number;
  cacheBust: boolean;
  backgroundColor: string;
  fontEmbedCSS: string;
};
export function waitForExportImages(node: HTMLElement, timeoutMs?: number): Promise<void>;
export function prepareWeeklyCardForExport(node: HTMLElement): Promise<void>;
