# Mexico Charts AI Host Briefings

These scripts create short host scripts for the Mexico Charts AI newsroom idea.
They are draft-only by default, so they do not spend Tavus credits.

## What It Does

Daily Briefing:

- Reads daily artists, daily songs, viral songs, and weekly albums.
- Writes a short presenter script for Adrian / the Mexico Charts host.
- Can output Tavus-ready JSON with transparent background enabled.

Touring Desk:

- Reads live touring data from the Mexico Charts touring API.
- Summarizes active dates, top touring artists, next shows, cities, and markets.
- Can output Tavus-ready JSON with transparent background enabled.

Artist Momentum Watch:

- Reads daily artist rankings, artist metadata, and live touring activity.
- Calculates an explainable 0-100 momentum score.
- Uses chart rank, listener growth, audience size, social reach, and touring dates.
- Prints the top artists with score components and a host-ready segment.
- Can output Tavus-ready JSON with transparent background enabled.

## Commands

Run the Daily Briefing script:

```bash
pnpm --filter @workspace/scripts run daily-briefing
```

Create the Daily Briefing Tavus payload:

```bash
pnpm --filter @workspace/scripts run daily-briefing -- --tavus-payload
```

Run the Touring Desk script:

```bash
pnpm --filter @workspace/scripts run touring-briefing
```

Create the Touring Desk Tavus payload:

```bash
pnpm --filter @workspace/scripts run touring-briefing -- --tavus-payload
```

Run Artist Momentum Watch:

```bash
pnpm --filter @workspace/scripts run artist-momentum
```

Create the Artist Momentum Tavus payload:

```bash
pnpm --filter @workspace/scripts run artist-momentum -- --tavus-payload
```

Export Artist Momentum as JSON:

```bash
pnpm --filter @workspace/scripts run artist-momentum -- --json
```

## Tavus Notes

The payload modes use:

- `TAVUS_REPLICA_ID` from your environment, if set.
- `r72f7f7f7c8b` as the fallback replica ID.
- `transparent_background: true`.
- `fast: true`.

The scripts do not call Tavus yet. They only print payloads so you can review
them before generating a video.

## Files

- `scripts/src/daily-briefing.ts` - briefing generator.
- `scripts/src/touring-briefing.ts` - Touring Desk generator.
- `scripts/src/artist-momentum.ts` - Artist Momentum Watch generator.
- `scripts/package.json` - contains the `daily-briefing` command.
