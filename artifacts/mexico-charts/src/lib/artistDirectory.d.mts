export interface ArtistDirectoryIdentity {
  canonicalName: string;
  profileHref: string;
  profileSlug: string;
}

export interface ArtistDirectoryExcluded {
  sourceIndex: number;
  artistKey?: string;
  displayName?: string;
  reason: "missing-profile-route";
}

export interface AuditedArtistRecord<T> {
  canonicalName: string;
  profileHref: string;
  profileSlug: string;
  [key: string]: unknown;
}

export interface ArtistDirectoryAudit<T> {
  artists: Array<T & ArtistDirectoryIdentity>;
  excluded: ArtistDirectoryExcluded[];
  duplicateGroups: Array<{
    profileHref: string;
    canonicalName: string;
    sourceNames: string[];
  }>;
}

export declare function auditArtistDirectoryRecords<T extends Record<string, any>>(
  records: readonly T[],
): ArtistDirectoryAudit<T>;

export declare function imageCandidates(
  primaryUrl: unknown,
  fallbackUrl: unknown,
): string[];

export declare function directoryImageState(input: {
  primaryUrl?: unknown;
  fallbackUrl?: unknown;
  imageLookupReady: boolean;
  fallbackLookupLoading?: boolean;
  failedUrls?: ReadonlySet<string>;
}): {
  state: "image" | "loading" | "initial";
  candidates: string[];
};