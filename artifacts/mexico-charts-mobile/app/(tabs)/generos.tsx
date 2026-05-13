import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useArtistMetadata, ArtistMeta } from "@/hooks/useArtistMetadata";
import { useArtistImages } from "@/hooks/useArtistImages";

const NEON = "#39FF14";
const BG = "#050505";

// ── Genre config (matches web HomeV6 GENRE_SYNONYMS) ────────────────────────

interface GenreDef {
  label: string;
  displayLabel: string;
  color: string;
  synonyms: string[];
  description: string;
}

const GENRES: GenreDef[] = [
  {
    label: "corridos-tumbados",
    displayLabel: "CORRIDOS TUMBADOS",
    color: NEON,
    synonyms: ["corridos tumbados", "corrido tumbado", "corridos"],
    description: "El género que redefinió la música mexicana",
  },
  {
    label: "regional-mexicano",
    displayLabel: "REGIONAL MEXICANO",
    color: "#4ade80",
    synonyms: ["regional mexicano", "regional", "reg. mexicano"],
    description: "Música que lleva las raíces de México al mundo",
  },
  {
    label: "norteno",
    displayLabel: "NORTEÑO",
    color: "#86efac",
    synonyms: ["norteño", "norteno", "nortena"],
    description: "El sonido clásico del norte de México",
  },
  {
    label: "banda",
    displayLabel: "BANDA",
    color: "#a3e635",
    synonyms: ["banda", "banda sinaloense"],
    description: "La banda que mueve masas en México y USA",
  },
  {
    label: "hip-hop",
    displayLabel: "HIP-HOP MEXICANO",
    color: "#facc15",
    synonyms: ["hip-hop", "hip hop mexicano", "hip hop", "rap mexicano"],
    description: "El nuevo rap hecho en México",
  },
  {
    label: "pop",
    displayLabel: "POP MEXICANO",
    color: "#fb923c",
    synonyms: ["pop", "pop mexicano", "pop latino"],
    description: "Pop hecho en México con alcance global",
  },
];

function matchesGenre(meta: ArtistMeta, genre: GenreDef): boolean {
  const sub = (meta.subgenre ?? "").toLowerCase();
  const gen = (meta.genre ?? "").toLowerCase();
  return genre.synonyms.some(
    (s) => sub.includes(s) || gen.includes(s)
  );
}

function fmtNum(n: number): string {
  if (n === 0) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

// ── Genre card ────────────────────────────────────────────────────────────────

function GenreCard({
  genre,
  artists,
  totalStreams,
  onPress,
  isActive,
}: {
  genre: GenreDef;
  artists: ArtistMeta[];
  totalStreams: number;
  onPress: () => void;
  isActive: boolean;
}) {
  const count = artists.length;
  return (
    <TouchableOpacity
      style={[
        styles.genreCard,
        isActive
          ? { borderColor: genre.color, backgroundColor: `${genre.color}0e` }
          : null,
      ]}
      activeOpacity={0.8}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
    >
      {/* Color swatch */}
      <View style={[styles.genreAccent, { backgroundColor: genre.color }]} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.genreLabel, { color: genre.color }]}>
          {genre.displayLabel}
        </Text>
        <Text style={styles.genreDesc} numberOfLines={1}>
          {genre.description}
        </Text>
      </View>

      <View style={styles.genreMeta}>
        <View style={styles.genreMetaItem}>
          <Text style={[styles.genreMetaNum, isActive ? { color: genre.color } : null]}>
            {count}
          </Text>
          <Text style={styles.genreMetaLabel}>artistas</Text>
        </View>
        {totalStreams > 0 && (
          <View style={styles.genreMetaItem}>
            <Text style={[styles.genreMetaNum, isActive ? { color: genre.color } : null]}>
              {fmtNum(totalStreams)}
            </Text>
            <Text style={styles.genreMetaLabel}>streams</Text>
          </View>
        )}
        <Feather
          name={isActive ? "chevron-up" : "chevron-down"}
          size={14}
          color={isActive ? genre.color : "#3F3F46"}
        />
      </View>
    </TouchableOpacity>
  );
}

// ── Artist grid card ─────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = (SCREEN_W - 32 - 10) / 2;

function ArtistGridCard({
  meta,
  index,
  color,
  photo,
}: {
  meta: ArtistMeta;
  index: number;
  color: string;
  photo: string | null;
}) {
  return (
    <TouchableOpacity
      style={[styles.artistCard, { borderColor: index < 3 ? `${color}40` : "rgba(255,255,255,0.06)" }]}
      activeOpacity={0.75}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/artist/[name]", params: { name: meta.displayName } });
      }}
    >
      {/* Rank badge */}
      <View style={[styles.artistCardRank, { backgroundColor: index < 3 ? `${color}22` : "rgba(255,255,255,0.05)" }]}>
        <Text style={[styles.artistCardRankText, { color: index < 3 ? color : "#52525B" }]}>
          {String(index + 1).padStart(2, "0")}
        </Text>
      </View>
      {/* Photo */}
      {photo ? (
        <Image source={{ uri: photo }} style={styles.artistCardPhoto} />
      ) : (
        <View style={[styles.artistCardPhoto, { backgroundColor: `${color}14`, alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ color, fontFamily: "Anton_400Regular", fontSize: 26 }}>
            {meta.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <Text style={styles.artistCardName} numberOfLines={2}>
        {meta.displayName}
      </Text>
      {meta.spotifyListenersFmt !== "—" && (
        <Text style={[styles.artistCardListeners, index < 3 ? { color } : null]}>
          {meta.spotifyListenersFmt}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function GenerosScreen() {
  const insets = useSafeAreaInsets();
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

  const { artists, isLoading, hasError } = useArtistMetadata();

  // Pre-compute per-genre stats
  const genreStats = useMemo(() => {
    return GENRES.map((g) => {
      const matched = artists
        .filter((a) => matchesGenre(a, g))
        .sort((a, b) => b.spotifyStreams - a.spotifyStreams);
      const totalStreams = matched.reduce((sum, a) => sum + a.spotifyStreams, 0);
      return { genre: g, artists: matched, totalStreams };
    });
  }, [artists]);

  // Artists for the expanded panel
  const expandedArtists = useMemo(() => {
    if (!activeGenre) return [];
    const gs = genreStats.find((g) => g.genre.label === activeGenre);
    return gs?.artists ?? [];
  }, [activeGenre, genreStats]);

  const expandedColor =
    GENRES.find((g) => g.label === activeGenre)?.color ?? NEON;

  const allNames = useMemo(
    () => expandedArtists.map((a) => a.displayName),
    [expandedArtists]
  );
  const imageMap = useArtistImages(allNames);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 84 : 0;

  // Total roster stats
  const totalArtists = artists.length;
  const totalStreams = useMemo(
    () => artists.reduce((s, a) => s + a.spotifyListeners, 0),
    [artists]
  );

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>GÉNEROS</Text>
          <Text style={styles.headerSub}>
            {isLoading ? "CARGANDO…" : `${totalArtists} ARTISTAS · ${fmtNum(totalStreams)} OYENTES`}
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <Feather name="music" size={12} color={NEON} />
          <Text style={styles.headerBadgeText}>EN VIVO</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 20 }}
      >
        {isLoading ? (
          <View style={{ paddingTop: 80, alignItems: "center" }}>
            <Feather name="loader" size={24} color="#52525B" />
            <Text style={styles.statusText}>Cargando géneros…</Text>
          </View>
        ) : hasError ? (
          <View style={{ paddingTop: 80, alignItems: "center" }}>
            <Feather name="wifi-off" size={24} color="#3F3F46" />
            <Text style={styles.statusText}>Error de conexión</Text>
          </View>
        ) : (
          <>
            {genreStats.map(({ genre, artists: ga, totalStreams: ts }) => {
              const isActive = activeGenre === genre.label;
              return (
                <View key={genre.label}>
                  <GenreCard
                    genre={genre}
                    artists={ga}
                    totalStreams={ts}
                    isActive={isActive}
                    onPress={() =>
                      setActiveGenre(isActive ? null : genre.label)
                    }
                  />

                  {/* Expanded artist grid */}
                  {isActive && (
                    <View style={styles.expandedPanel}>
                      <View style={styles.expandedHeader}>
                        <Text style={[styles.expandedTitle, { color: genre.color }]}>
                          {genre.displayLabel}
                        </Text>
                        <Text style={styles.expandedCount}>
                          {ga.length} artistas · {fmtNum(ts)} streams
                        </Text>
                      </View>
                      <View style={styles.artistGrid}>
                        {ga.slice(0, 20).map((meta, idx) => (
                          <ArtistGridCard
                            key={meta.artistKey}
                            meta={meta}
                            index={idx}
                            color={genre.color}
                            photo={imageMap[meta.displayName] ?? null}
                          />
                        ))}
                      </View>
                      {ga.length > 20 && (
                        <Text style={styles.moreText}>
                          +{ga.length - 20} más en {genre.displayLabel}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Roster totals */}
            <View style={styles.totalsCard}>
              <Text style={styles.totalsTitle}>BASE DE DATOS</Text>
              <View style={styles.totalsRow}>
                <View style={styles.totalItem}>
                  <Text style={styles.totalNum}>{totalArtists}</Text>
                  <Text style={styles.totalLabel}>artistas totales</Text>
                </View>
                <View style={styles.totalItem}>
                  <Text style={styles.totalNum}>{GENRES.length}</Text>
                  <Text style={styles.totalLabel}>géneros</Text>
                </View>
                <View style={styles.totalItem}>
                  <Text style={styles.totalNum}>{fmtNum(totalStreams)}</Text>
                  <Text style={styles.totalLabel}>oyentes spotify</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: {
    color: "#FFFFFF", fontFamily: "Anton_400Regular", fontSize: 36, lineHeight: 46,
  },
  headerSub: {
    color: "#52525B", fontFamily: "Inter_500Medium",
    fontSize: 10, letterSpacing: 1.5, marginTop: 2,
  },
  headerBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(57,255,20,0.08)",
    borderWidth: 1, borderColor: "rgba(57,255,20,0.22)",
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5,
  },
  headerBadgeText: {
    color: NEON, fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 1.5,
  },

  genreCard: {
    flexDirection: "row", alignItems: "center", gap: 0,
    paddingRight: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
    borderLeftWidth: 0, borderRightWidth: 0, borderTopWidth: 0,
    overflow: "hidden",
  },
  genreAccent: { width: 3, alignSelf: "stretch", marginRight: 16 },
  genreLabel: {
    fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1,
    textTransform: "uppercase", marginBottom: 2,
  },
  genreDesc: {
    color: "#52525B", fontFamily: "Inter_400Regular", fontSize: 10,
  },
  genreMeta: { flexDirection: "row", alignItems: "center", gap: 16 },
  genreMetaItem: { alignItems: "flex-end" },
  genreMetaNum: {
    color: "#A1A1AA", fontFamily: "Inter_700Bold", fontSize: 13, lineHeight: 15,
  },
  genreMetaLabel: {
    color: "#3F3F46", fontFamily: "Inter_400Regular", fontSize: 8,
    textTransform: "uppercase", letterSpacing: 0.8,
  },

  expandedPanel: {
    backgroundColor: "#080808",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
    paddingBottom: 8,
  },
  expandedHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)",
  },
  expandedTitle: {
    fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase",
  },
  expandedCount: {
    color: "#52525B", fontFamily: "Inter_500Medium", fontSize: 10, letterSpacing: 0.3,
  },

  artistGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 10,
  },
  artistCard: {
    width: CARD_W,
    backgroundColor: "#0f0f0f",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    padding: 10,
    alignItems: "center",
  },
  artistCardRank: {
    position: "absolute",
    top: 8,
    left: 8,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  artistCardRankText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 1,
  },
  artistCardPhoto: {
    width: CARD_W - 24,
    height: CARD_W - 24,
    borderRadius: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  artistCardName: {
    color: "#E4E4E7",
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 3,
  },
  artistCardListeners: {
    color: "#71717A",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    textAlign: "center",
  },

  moreText: {
    color: "#3F3F46", fontFamily: "Inter_500Medium", fontSize: 10,
    textAlign: "center", paddingVertical: 12, letterSpacing: 0.5,
  },

  totalsCard: {
    marginHorizontal: 16, marginTop: 20, marginBottom: 8,
    backgroundColor: "#0a0a0a", borderWidth: 1,
    borderColor: "rgba(57,255,20,0.12)", borderRadius: 8, padding: 18,
  },
  totalsTitle: {
    color: NEON, fontFamily: "Inter_700Bold", fontSize: 9,
    letterSpacing: 3, marginBottom: 14, textTransform: "uppercase",
  },
  totalsRow: { flexDirection: "row", justifyContent: "space-between" },
  totalItem: { alignItems: "center" },
  totalNum: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 20, letterSpacing: -0.5 },
  totalLabel: {
    color: "#52525B", fontFamily: "Inter_500Medium", fontSize: 9,
    textTransform: "uppercase", letterSpacing: 1, marginTop: 2,
  },

  statusText: {
    color: "#3F3F46", fontFamily: "Inter_500Medium",
    fontSize: 13, marginTop: 12, letterSpacing: 0.5,
  },
});
