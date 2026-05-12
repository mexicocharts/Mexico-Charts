import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTouring, ArtistTours, TmEvent } from "@/hooks/useTouring";
import { useArtistImages } from "@/hooks/useArtistImages";

const NEON = "#39FF14";
const BG = "#080808";

const FALLBACK_IMGS: Record<string, string> = {
  "fuerza-regida":    "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=500&fit=crop&q=75",
  "banda-ms":         "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=500&fit=crop&q=75",
  "grupo-firme":      "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=400&h=500&fit=crop&q=75",
  "junior-h":         "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=500&fit=crop&q=75",
  "peso-pluma":       "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&h=500&fit=crop&q=75",
  "eslabon-armado":   "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=400&h=500&fit=crop&q=75",
  "natanael-cano":    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=500&fit=crop&q=75",
  "carin-leon":       "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&h=500&fit=crop&q=75",
  "eden-munoz":       "https://images.unsplash.com/photo-1598387993281-cecf8b71a8f8?w=400&h=500&fit=crop&q=75",
  "christian-nodal":  "https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?w=400&h=500&fit=crop&q=75",
  "larry-hernandez":  "https://images.unsplash.com/photo-1504704911898-68304a7d2807?w=400&h=500&fit=crop&q=75",
  "xavi":             "https://images.unsplash.com/photo-1571935441008-e6244ff434d8?w=400&h=500&fit=crop&q=75",
  "los-dos-carnales": "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=400&h=500&fit=crop&q=75",
};

const HERO_BG =
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=540&fit=crop&q=80";

const PROFILE_CARDS = [
  { artistId: "peso-pluma",     subtitle: "Éxodo Tour 2024",   gross: "$87.4M", tickets: "758K", shows: 288 },
  { artistId: "junior-h",       subtitle: "Sad Boyz Tour",     gross: "$90.4M", tickets: "758K", shows: 69  },
  { artistId: "grupo-firme",    subtitle: "Tour 2022–2023",     gross: "$81.6M", tickets: "687K", shows: 72  },
  { artistId: "fuerza-regida",  subtitle: "Tour 2024",          gross: "—",      tickets: "—",    shows: 0   },
];

function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

type CountryFilter = "ALL" | "US" | "MX" | "OTHER";

// ── Hero ─────────────────────────────────────────────────────────────────────

function TouringHero({
  totalShows,
  artistsOnTour,
  isLoading,
}: {
  totalShows: number;
  artistsOnTour: number;
  isLoading: boolean;
}) {
  return (
    <View style={styles.hero}>
      <Image source={{ uri: HERO_BG }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <View style={styles.heroLeft} />
      <View style={styles.heroBottom} />
      <View style={styles.heroContent}>
        <Text style={styles.heroEyebrow}>Touring</Text>
        <Text style={styles.heroTitle}>{"La Música\nMexicana\nen Vivo"}</Text>
        {!isLoading && totalShows > 0 && (
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{totalShows}</Text>
              <Text style={styles.heroStatLabel}>Shows próximos</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{artistsOnTour}</Text>
              <Text style={styles.heroStatLabel}>Artistas en gira</Text>
            </View>
          </View>
        )}
        <View style={styles.heroLiveBadge}>
          <View style={styles.heroDot} />
          <Text style={styles.heroLiveBadgeText}>
            {isLoading ? "CARGANDO…" : `${totalShows} shows · Ticketmaster`}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Shelf card ────────────────────────────────────────────────────────────────

function ShelfCard({ artist, idx }: { artist: ArtistTours; idx: number }) {
  const photo = artist.events[0]?.img ?? FALLBACK_IMGS[artist.id] ?? null;
  const nextEv = artist.events[0];
  const accent =
    idx === 0 ? NEON : idx === 1 ? "rgba(57,255,20,0.7)" : "rgba(57,255,20,0.45)";

  return (
    <TouchableOpacity
      style={styles.shelfCard}
      activeOpacity={0.85}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (nextEv?.url) Linking.openURL(nextEv.url);
      }}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#0f0f0f" }]} />
      )}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.28)" }]} />
      <View style={styles.shelfGradient} />
      <Text style={styles.shelfRankNum}>{String(idx + 1).padStart(2, "0")}</Text>
      {artist.events.length > 0 && (
        <View style={[styles.shelfDot, { backgroundColor: accent }]} />
      )}
      <View style={styles.shelfBottom}>
        <Text style={styles.shelfName} numberOfLines={1}>
          {artist.name.toUpperCase()}
        </Text>
        {nextEv ? (
          <>
            <Text style={[styles.shelfShows, { color: accent }]}>
              {artist.events.length} shows
            </Text>
            <Text style={styles.shelfDate} numberOfLines={1}>
              {formatDate(nextEv.date)} · {nextEv.city}
            </Text>
          </>
        ) : (
          <Text style={styles.shelfNoDate}>Sin fechas</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Show row ──────────────────────────────────────────────────────────────────

function ShowRow({ event }: { event: TmEvent & { artistName: string } }) {
  return (
    <TouchableOpacity
      style={styles.showRow}
      activeOpacity={0.78}
      onPress={() => { if (event.url) Linking.openURL(event.url); }}
    >
      {event.img ? (
        <Image source={{ uri: event.img }} style={styles.showThumb} />
      ) : (
        <View style={[styles.showThumb, { backgroundColor: "#111111" }]} />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.showDate}>{formatDate(event.date)}</Text>
        <Text style={styles.showArtist} numberOfLines={1}>
          {event.artistName}
        </Text>
        <Text style={styles.showVenue} numberOfLines={1}>
          {event.venue} · {event.city}{event.state ? `, ${event.state}` : ""}
        </Text>
      </View>
      <View style={styles.showRight}>
        <Text style={styles.showCountry}>{event.country}</Text>
        <Feather name="external-link" size={13} color="#52525B" />
      </View>
    </TouchableOpacity>
  );
}

// ── Profile card ──────────────────────────────────────────────────────────────

function ProfileCard({
  artistId,
  subtitle,
  gross,
  tickets,
  shows,
}: {
  artistId: string;
  subtitle: string;
  gross: string;
  tickets: string;
  shows: number;
}) {
  const img = FALLBACK_IMGS[artistId];
  const name = artistId
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return (
    <View style={styles.profileCard}>
      {img ? (
        <Image source={{ uri: img }} style={styles.profileImg} resizeMode="cover" />
      ) : null}
      <View style={styles.profileOverlay} />
      <View style={styles.profileContent}>
        <Text style={styles.profileName}>{name}</Text>
        <Text style={styles.profileSubtitle}>{subtitle}</Text>
        <View style={styles.profileStats}>
          {gross !== "—" && (
            <View>
              <Text style={styles.profileStatNum}>{gross}</Text>
              <Text style={styles.profileStatLabel}>Gross</Text>
            </View>
          )}
          {tickets !== "—" && (
            <View>
              <Text style={styles.profileStatNum}>{tickets}</Text>
              <Text style={styles.profileStatLabel}>Tickets</Text>
            </View>
          )}
          {shows > 0 && (
            <View>
              <Text style={styles.profileStatNum}>{shows}</Text>
              <Text style={styles.profileStatLabel}>Shows</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, pill }: { title: string; pill?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>◈</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
      {pill ? (
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.livePillText}>{pill}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TouringScreen() {
  const insets = useSafeAreaInsets();
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("ALL");

  const { artists, totalShows, artistsOnTour, isLoading, hasError } = useTouring();
  const artistNames = useMemo(() => artists.map((a) => a.name), [artists]);
  useArtistImages(artistNames);

  const allShows = useMemo(() => {
    return artists
      .flatMap((a) => a.events.slice(0, 8).map((ev) => ({ ...ev, artistName: a.name })))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [artists]);

  const filteredShows = useMemo(() => {
    if (countryFilter === "ALL") return allShows;
    if (countryFilter === "US") return allShows.filter((e) => e.country === "US");
    if (countryFilter === "MX") return allShows.filter((e) => e.country === "MX");
    return allShows.filter((e) => e.country !== "US" && e.country !== "MX");
  }, [allShows, countryFilter]);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 84 : 0;

  const COUNTRY_FILTERS: { id: CountryFilter; label: string }[] = [
    { id: "ALL",   label: `Todos (${allShows.length})` },
    { id: "US",    label: `USA (${allShows.filter((e) => e.country === "US").length})` },
    { id: "MX",    label: `MX (${allShows.filter((e) => e.country === "MX").length})` },
    { id: "OTHER", label: `Intl. (${allShows.filter((e) => e.country !== "US" && e.country !== "MX").length})` },
  ];

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topInset }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
    >
      <TouringHero totalShows={totalShows} artistsOnTour={artistsOnTour} isLoading={isLoading} />

      {/* Upcoming Tours */}
      <View style={styles.section}>
        <SectionHeader
          title="UPCOMING TOURS"
          pill={!isLoading && totalShows > 0 ? `${totalShows} shows · TM` : undefined}
        />
        {isLoading ? (
          <View style={styles.loadingRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.shelfCard, styles.shelfCardSkeleton]} />
            ))}
          </View>
        ) : hasError ? (
          <View style={styles.errorBox}>
            <Feather name="alert-triangle" size={16} color="rgba(255,80,80,0.6)" />
            <Text style={styles.errorText}>Error cargando datos de Ticketmaster</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingVertical: 4 }}
          >
            {artists.map((a, idx) => (
              <ShelfCard key={a.id} artist={a} idx={idx} />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Artist profiles */}
      <View style={styles.section}>
        <SectionHeader title="PERFILES ARTISTAS" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingVertical: 4 }}
        >
          {PROFILE_CARDS.map((p) => (
            <ProfileCard key={p.artistId} {...p} />
          ))}
        </ScrollView>
      </View>

      {/* All shows */}
      {!isLoading && !hasError && totalShows > 0 && (
        <View style={styles.section}>
          <SectionHeader title="TODOS LOS SHOWS" />

          {/* Country filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 10 }}
          >
            {COUNTRY_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.countryFilter,
                  countryFilter === f.id ? styles.countryFilterActive : null,
                ]}
                onPress={() => { Haptics.selectionAsync(); setCountryFilter(f.id); }}
              >
                <Text
                  style={[
                    styles.countryFilterText,
                    countryFilter === f.id ? styles.countryFilterTextActive : null,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredShows.length === 0 ? (
            <Text style={styles.noShows}>Sin shows en esta región</Text>
          ) : (
            filteredShows.map((ev) => <ShowRow key={ev.eventId} event={ev} />)
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  hero: { height: 420, position: "relative", overflow: "hidden" },
  heroLeft: {
    position: "absolute", left: 0, top: 0, bottom: 0, width: "70%",
    backgroundColor: "rgba(4,10,4,0.68)",
  },
  heroBottom: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: 120,
    backgroundColor: "rgba(8,8,8,0.95)",
  },
  heroContent: {
    position: "absolute", left: 0, bottom: 0, right: 0,
    padding: 24, paddingBottom: 28, zIndex: 10,
  },
  heroEyebrow: {
    color: NEON, fontFamily: "Inter_700Bold", fontSize: 10,
    letterSpacing: 4, textTransform: "uppercase", marginBottom: 12,
  },
  heroTitle: {
    color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 44,
    lineHeight: 44, letterSpacing: -0.5, textTransform: "uppercase", marginBottom: 18,
  },
  heroStats: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 14 },
  heroStat: { gap: 3 },
  heroStatNum: {
    color: NEON, fontFamily: "Inter_700Bold", fontSize: 26, lineHeight: 26, letterSpacing: -0.5,
  },
  heroStatLabel: {
    color: "rgba(255,255,255,0.55)", fontFamily: "Inter_500Medium", fontSize: 8,
    textTransform: "uppercase", letterSpacing: 2.5,
  },
  heroStatDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.12)" },
  heroLiveBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: NEON },
  heroLiveBadgeText: {
    color: "rgba(255,255,255,0.45)", fontFamily: "Inter_600SemiBold", fontSize: 9,
    textTransform: "uppercase", letterSpacing: 1.5,
  },

  section: { marginBottom: 4 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
  },
  sectionIcon: { color: NEON, fontSize: 12 },
  sectionTitle: {
    color: "rgba(255,255,255,0.52)", fontFamily: "Inter_700Bold",
    fontSize: 9, letterSpacing: 3, textTransform: "uppercase",
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.05)" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: NEON },
  livePillText: {
    color: "rgba(255,255,255,0.45)", fontFamily: "Inter_600SemiBold",
    fontSize: 9, letterSpacing: 1,
  },

  loadingRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingVertical: 8 },
  shelfCard: {
    width: 140, height: 300, borderRadius: 10, overflow: "hidden",
    position: "relative", backgroundColor: "#0f0f0f",
  },
  shelfCardSkeleton: { opacity: 0.3 },
  shelfGradient: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: "65%",
    backgroundColor: "rgba(0,0,0,0.92)",
  },
  shelfRankNum: {
    position: "absolute", top: 10, left: 12,
    color: "rgba(255,255,255,0.12)", fontFamily: "Inter_700Bold",
    fontSize: 36, lineHeight: 40, letterSpacing: -1,
  },
  shelfDot: { position: "absolute", top: 12, right: 12, width: 6, height: 6, borderRadius: 3 },
  shelfBottom: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 12 },
  shelfName: {
    color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 15,
    letterSpacing: 0.3, lineHeight: 18, marginBottom: 3,
  },
  shelfShows: { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 0.5, marginBottom: 2 },
  shelfDate: { color: "rgba(255,255,255,0.35)", fontFamily: "Inter_400Regular", fontSize: 9, letterSpacing: 0.3 },
  shelfNoDate: {
    color: "rgba(255,255,255,0.35)", fontFamily: "Inter_500Medium",
    fontSize: 9, textTransform: "uppercase", letterSpacing: 1.2,
  },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 20, marginVertical: 10,
    backgroundColor: "#0d0d0d", borderWidth: 1, borderColor: "rgba(255,60,60,0.15)",
    padding: 14, borderRadius: 8,
  },
  errorText: { color: "rgba(255,80,80,0.6)", fontFamily: "Inter_500Medium", fontSize: 11, letterSpacing: 0.5 },

  profileCard: {
    width: 180, height: 220, borderRadius: 12, overflow: "hidden",
    position: "relative", backgroundColor: "#0f0f0f",
    borderWidth: 1, borderColor: "#181818",
  },
  profileImg: { ...StyleSheet.absoluteFillObject, opacity: 0.45 },
  profileOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  profileContent: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: 14, backgroundColor: "rgba(0,0,0,0.75)",
  },
  profileName: {
    color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 14,
    letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2,
  },
  profileSubtitle: { color: "rgba(255,255,255,0.42)", fontFamily: "Inter_400Regular", fontSize: 10, marginBottom: 10 },
  profileStats: { flexDirection: "row", gap: 16 },
  profileStatNum: { color: NEON, fontFamily: "Inter_700Bold", fontSize: 14, lineHeight: 16 },
  profileStatLabel: {
    color: "rgba(255,255,255,0.38)", fontFamily: "Inter_400Regular",
    fontSize: 8, textTransform: "uppercase", letterSpacing: 1, marginTop: 1,
  },

  showRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)",
    backgroundColor: "#090909",
  },
  showThumb: { width: 50, height: 50, borderRadius: 0 },
  showDate: { color: NEON, fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 0.3, marginBottom: 2 },
  showArtist: {
    color: "#e8e8e8", fontFamily: "Inter_700Bold", fontSize: 13,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2,
  },
  showVenue: { color: "rgba(255,255,255,0.38)", fontFamily: "Inter_400Regular", fontSize: 10 },
  showRight: { alignItems: "flex-end", gap: 4 },
  showCountry: {
    color: "rgba(255,255,255,0.28)", fontFamily: "Inter_700Bold",
    fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase",
  },

  countryFilter: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  countryFilterActive: { backgroundColor: NEON, borderColor: NEON },
  countryFilterText: { color: "#555555", fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 0.8 },
  countryFilterTextActive: { color: "#000000" },
  noShows: {
    paddingVertical: 32, textAlign: "center",
    color: "rgba(255,255,255,0.38)", fontFamily: "Inter_500Medium",
    fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase",
  },
});
