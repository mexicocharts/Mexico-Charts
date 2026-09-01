export const ACTIVE_ARTIST_PRO_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

export type ArtistProEntitlementSource = "subscription" | "internal";

export type ArtistProEntitlement = {
  source: ArtistProEntitlementSource;
};

type ResolveArtistProEntitlementInput = {
  userId: string | null | undefined;
  hasActiveSubscription: () => boolean | Promise<boolean>;
  internalUserIds?: string | null;
};

export function configuredInternalArtistProUserIds(
  raw: string | null | undefined = process.env["ARTIST_PRO_INTERNAL_USER_IDS"],
): Set<string> {
  return new Set(
    String(raw ?? "")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean),
  );
}

export function hasInternalArtistProEntitlement(
  userId: string | null | undefined,
  raw: string | null | undefined = process.env["ARTIST_PRO_INTERNAL_USER_IDS"],
): boolean {
  const normalizedUserId = String(userId ?? "").trim();
  return Boolean(normalizedUserId) && configuredInternalArtistProUserIds(raw).has(normalizedUserId);
}

/**
 * The single server-side policy for Artist Pro access. Billing remains the
 * source of truth for customers; explicitly allowlisted Clerk accounts receive
 * the product entitlement without creating or changing a Stripe subscription.
 */
export async function resolveArtistProEntitlement({
  userId,
  hasActiveSubscription,
  internalUserIds,
}: ResolveArtistProEntitlementInput): Promise<ArtistProEntitlement | null> {
  const normalizedUserId = String(userId ?? "").trim();
  if (!normalizedUserId) return null;

  if (hasInternalArtistProEntitlement(normalizedUserId, internalUserIds)) {
    return { source: "internal" };
  }

  return await hasActiveSubscription() ? { source: "subscription" } : null;
}
