import { resolveArtistProEntitlement, type ArtistProEntitlementSource } from "./artist-pro-entitlement";

export type MonitoringArtistGrant = {
  artist_key: string;
  artist_name: string;
  status: string;
  created_at: Date | null;
  match_keys?: readonly string[];
  identity_conflict?: boolean;
};

export type MonitoringAuthorizationDecision = {
  allowed: boolean;
  source: ArtistProEntitlementSource | null;
  grant: MonitoringArtistGrant | null;
  outcome: "allowed" | "entitlement_denied" | "artist_not_found";
  publicReadinessEvaluated: false;
};

type AuthorizeMonitoringArtistInput = {
  userId: string | null | undefined;
  requestedArtistKey: string;
  internalUserIds?: string | null;
  findActiveSubscription: () => Promise<MonitoringArtistGrant | null>;
  findExistingArtist: (artistKey: string) => Promise<MonitoringArtistGrant | null>;
};

async function resolveSubscriptionSourceIdentity(
  grant: MonitoringArtistGrant,
  findExistingArtist: AuthorizeMonitoringArtistInput["findExistingArtist"],
): Promise<MonitoringArtistGrant> {
  // Resolve only the artist already authorized by the paid subscription. The
  // identity record contributes source keys, never a new billing/access grant.
  const identity = await findExistingArtist(grant.artist_key);
  if (!identity) return grant;
  const conflict = grant.identity_conflict === true || identity.identity_conflict === true;
  return {
    ...grant,
    match_keys: conflict ? [grant.artist_key] : [...new Set([
      grant.artist_key,
      ...(identity.match_keys ?? [identity.artist_key]),
    ])],
    identity_conflict: conflict,
  };
}

/**
 * User entitlement and public artist readiness are intentionally separate.
 * Paid customers retain their existing, artist-specific subscription grant.
 * Explicit internal users may inspect an existing monitored artist without
 * changing or bypassing the public readiness policy used by the storefront.
 */
export async function authorizeMonitoringArtist({
  userId,
  requestedArtistKey,
  internalUserIds,
  findActiveSubscription,
  findExistingArtist,
}: AuthorizeMonitoringArtistInput): Promise<MonitoringAuthorizationDecision> {
  let activeSubscription: MonitoringArtistGrant | null = null;
  const entitlement = await resolveArtistProEntitlement({
    userId,
    internalUserIds,
    hasActiveSubscription: async () => {
      activeSubscription = await findActiveSubscription();
      return Boolean(activeSubscription);
    },
  });

  if (!entitlement) {
    return {
      allowed: false,
      source: null,
      grant: null,
      outcome: "entitlement_denied",
      publicReadinessEvaluated: false,
    };
  }

  if (entitlement.source === "subscription") {
    const grant = activeSubscription
      ? await resolveSubscriptionSourceIdentity(activeSubscription, findExistingArtist)
      : null;
    return {
      allowed: Boolean(grant),
      source: "subscription",
      grant,
      outcome: grant ? "allowed" : "entitlement_denied",
      publicReadinessEvaluated: false,
    };
  }

  const existingArtist = await findExistingArtist(requestedArtistKey);
  return {
    allowed: Boolean(existingArtist),
    source: "internal",
    grant: existingArtist,
    outcome: existingArtist ? "allowed" : "artist_not_found",
    publicReadinessEvaluated: false,
  };
}
