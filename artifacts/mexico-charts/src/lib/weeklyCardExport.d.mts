export function exportSafeImageUrl(url: string | null | undefined): string | null;
export function waitForExportImages(node: HTMLElement, timeoutMs?: number): Promise<void>;
export function prepareWeeklyCardForExport(node: HTMLElement): Promise<void>;
