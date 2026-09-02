import { createSchemaBootstrapPool } from "@workspace/db";

export const ACCOUNT_SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS user_accounts (
    clerk_user_id text PRIMARY KEY,
    email text,
    display_name text,
    plan text NOT NULL DEFAULT 'free',
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS saved_artists (
    clerk_user_id text NOT NULL,
    artist_key text NOT NULL,
    artist_name text NOT NULL,
    alerts_enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (clerk_user_id, artist_key)
  );
  CREATE INDEX IF NOT EXISTS saved_artists_user_created_idx
    ON saved_artists (clerk_user_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS monitoring_subscriptions (
    stripe_subscription_id text PRIMARY KEY,
    clerk_user_id text NOT NULL,
    artist_key text NOT NULL,
    artist_name text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS monitoring_subscriptions_user_idx
    ON monitoring_subscriptions (clerk_user_id, updated_at DESC);
  CREATE TABLE IF NOT EXISTS fan_profiles (
    clerk_user_id text PRIMARY KEY,
    username text NOT NULL UNIQUE,
    display_name text,
    bio text,
    account_type text NOT NULL DEFAULT 'personal',
    is_public boolean NOT NULL DEFAULT false,
    show_recent_listening boolean NOT NULL DEFAULT false,
    show_badges boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS fan_profiles_username_idx
    ON fan_profiles (username);
  ALTER TABLE fan_profiles
    ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'personal';
  CREATE TABLE IF NOT EXISTS user_music_connections (
    clerk_user_id text NOT NULL,
    provider text NOT NULL,
    external_user_id text,
    external_username text,
    access_token_encrypted text,
    refresh_token_encrypted text,
    scopes text,
    token_expires_at timestamptz,
    last_synced_at timestamptz,
    connected_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (clerk_user_id, provider)
  );
  CREATE INDEX IF NOT EXISTS user_music_connections_user_idx
    ON user_music_connections (clerk_user_id, updated_at DESC);
  CREATE TABLE IF NOT EXISTS user_listening_events (
    clerk_user_id text NOT NULL,
    provider text NOT NULL,
    event_id text NOT NULL,
    played_at timestamptz NOT NULL,
    track_id text,
    track_name text NOT NULL,
    artist_name text NOT NULL,
    album_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (clerk_user_id, provider, event_id)
  );
  CREATE INDEX IF NOT EXISTS user_listening_events_recent_idx
    ON user_listening_events (clerk_user_id, played_at DESC);
`;

type SchemaExecutor = {
  query(sql: string): Promise<unknown>;
};

export async function runAccountSchemaBootstrap(executor: SchemaExecutor): Promise<void> {
  await executor.query(ACCOUNT_SCHEMA_DDL);
}

let initializationPromise: Promise<void> | null = null;
let schemaReady = false;

export function isAccountSchemaReady(): boolean {
  return schemaReady;
}

export function initializeAccountSchema(): Promise<void> {
  initializationPromise ??= (async () => {
    const bootstrapPool = createSchemaBootstrapPool();
    try {
      await runAccountSchemaBootstrap(bootstrapPool);
      schemaReady = true;
    } finally {
      await bootstrapPool.end();
    }
  })().catch(error => {
    initializationPromise = null;
    schemaReady = false;
    throw error;
  });
  return initializationPromise;
}
