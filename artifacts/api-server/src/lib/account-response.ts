import { hasInternalArtistProEntitlement } from "./artist-pro-entitlement";

type AccountRecord = {
  plan?: string | null;
  subscriptionStatus?: string | null;
} | null | undefined;

type BuildAccountResponseInput = {
  userId: string;
  account: AccountRecord;
  savedArtists: unknown[];
  monitoringSubscriptions: unknown[];
  profile: unknown | null | undefined;
  connections: unknown[];
  connectionAvailability: unknown;
  internalUserIds?: string | null;
};

export function buildAccountMeResponse({
  userId,
  account,
  savedArtists,
  monitoringSubscriptions,
  profile,
  connections,
  connectionAvailability,
  internalUserIds,
}: BuildAccountResponseInput) {
  return {
    userId,
    plan: account?.plan ?? "free",
    subscriptionStatus: account?.subscriptionStatus ?? null,
    internalArtistProAccess: hasInternalArtistProEntitlement(userId, internalUserIds),
    savedArtists,
    monitoringSubscriptions,
    profile: profile ?? null,
    connections,
    connectionAvailability,
  };
}
