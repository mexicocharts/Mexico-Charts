type AdminKeyEnvironment = Partial<Record<
  "NEWSLETTER_ADMIN_KEY" | "YOUTUBE_ADMIN_KEY" | "SPOTIFY_ADMIN_KEY",
  string | undefined
>>;

export function getDashboardAdminKey(env: AdminKeyEnvironment = process.env): string {
  return (
    env.NEWSLETTER_ADMIN_KEY ||
    env.YOUTUBE_ADMIN_KEY ||
    env.SPOTIFY_ADMIN_KEY ||
    ""
  ).trim();
}
