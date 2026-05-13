import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useArtistImages } from "@/hooks/useArtistImages";
import { useArtistMetadata } from "@/hooks/useArtistMetadata";

const NEON = "#39FF14";
const BG = "#050505";

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PlatformRow({
  label,
  value,
  color,
  iconName,
}: {
  label: string;
  value: string;
  color: string;
  iconName: React.ComponentProps<typeof Feather>["name"];
}) {
  return (
    <View style={styles.platformRow}>
      <View style={[styles.platformDot, { backgroundColor: color }]} />
      <Text style={styles.platformLabel}>{label}</Text>
      <Text style={[styles.platformValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function ArtistDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const insets = useSafeAreaInsets();

  const { byName, artists, isLoading } = useArtistMetadata();

  const artist = useMemo(() => {
    if (!name) return undefined;
    const key = name.toLowerCase();
    const byDisplayName = byName.get(key);
    if (byDisplayName) return byDisplayName;
    const normalized = key
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim();
    return artists.find(
      (a) =>
        a.artistKey === normalized ||
        a.artistKey.replace(/\s+/g, "") === normalized.replace(/\s+/g, "")
    );
  }, [byName, artists, name]);

  const imageMap = useArtistImages(artist ? [artist.displayName] : []);
  const photo = artist ? (imageMap[artist.displayName] ?? null) : null;

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: topInset + 80, alignItems: "center" }]}>
        <TouchableOpacity
          style={[styles.backButton, { top: topInset + 12, position: "absolute", left: 16 }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={20} color="#E4E4E7" />
        </TouchableOpacity>
        <Feather name="loader" size={32} color="#52525B" />
        <Text style={styles.emptyText}>Cargando…</Text>
      </View>
    );
  }

  if (!artist) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <TouchableOpacity
          style={[styles.backButton, { top: topInset + 12, position: "absolute", left: 16 }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={20} color="#E4E4E7" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Feather name="user-x" size={40} color="#52525B" />
          <Text style={styles.emptyText}>Artista no encontrado</Text>
          {name ? (
            <Text style={[styles.emptyText, { fontSize: 12, marginTop: 4, color: "#3F3F46" }]}>
              {name}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  const displayGenre = artist.subgenre || artist.genre || "";
  const hasStats =
    artist.spotifyListenersFmt !== "—" ||
    artist.spotifyStreamsFmt !== "—" ||
    artist.youtubeSubscribersFmt !== "—" ||
    artist.instagramFollowersFmt !== "—";

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 32 }}
      >
        {/* ── Hero ── */}
        <View style={[styles.heroArea, { paddingTop: topInset }]}>
          {photo ? (
            <Image
              source={{ uri: photo }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.heroImagePlaceholder}>
              <Text style={styles.heroPlaceholderLetter}>
                {artist.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.heroGradientSide} />
          <View style={styles.heroGradientBottom} />

          {/* Back button */}
          <TouchableOpacity
            style={[styles.backButton, { top: topInset + 12 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Genre tag */}
          {displayGenre ? (
            <View style={[styles.genreTag, { top: topInset + 16 }]}>
              <Text style={[styles.genreTagText, { color: NEON }]}>
                {displayGenre.toUpperCase()}
              </Text>
            </View>
          ) : null}

          {/* Hero text */}
          <View style={styles.heroText}>
            <Text style={styles.artistName} numberOfLines={2}>
              {artist.displayName.toUpperCase()}
            </Text>
            {artist.country ? (
              <Text style={styles.artistCountry}>{artist.country}</Text>
            ) : null}
          </View>
        </View>

        {/* ── Stats row ── */}
        {hasStats && (
          <View style={styles.statsGrid}>
            {artist.spotifyListenersFmt !== "—" && (
              <StatBox
                label="OYENTES / MES"
                value={artist.spotifyListenersFmt}
                accent={NEON}
              />
            )}
            {artist.spotifyStreamsFmt !== "—" && (
              <StatBox label="STREAMS TOTALES" value={artist.spotifyStreamsFmt} />
            )}
            {artist.youtubeSubscribersFmt !== "—" && (
              <StatBox label="SUSCRIPTORES YT" value={artist.youtubeSubscribersFmt} />
            )}
            {artist.instagramFollowersFmt !== "—" && (
              <StatBox label="SEGUIDORES IG" value={artist.instagramFollowersFmt} />
            )}
          </View>
        )}

        {/* ── Platform stats card ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="bar-chart-2" size={14} color={NEON} />
            <Text style={styles.cardTitle}>PLATAFORMAS</Text>
          </View>

          {artist.spotifyListenersFmt !== "—" && (
            <PlatformRow
              label="Spotify — oyentes / mes"
              value={artist.spotifyListenersFmt}
              color="#1DB954"
              iconName="music"
            />
          )}
          {artist.spotifyStreamsFmt !== "—" && (
            <PlatformRow
              label="Spotify — streams totales"
              value={artist.spotifyStreamsFmt}
              color="#1DB954"
              iconName="music"
            />
          )}
          {artist.youtubeSubscribersFmt !== "—" && (
            <PlatformRow
              label="YouTube — suscriptores"
              value={artist.youtubeSubscribersFmt}
              color="#FF4444"
              iconName="youtube"
            />
          )}
          {artist.tiktokFollowersFmt !== "—" && (
            <PlatformRow
              label="TikTok — seguidores"
              value={artist.tiktokFollowersFmt}
              color="#E4E4E7"
              iconName="video"
            />
          )}
          {artist.instagramFollowersFmt !== "—" && (
            <PlatformRow
              label="Instagram — seguidores"
              value={artist.instagramFollowersFmt}
              color="#E1306C"
              iconName="instagram"
            />
          )}
        </View>

        {/* ── Genre card ── */}
        {displayGenre ? (
          <View style={[styles.card, { marginTop: 12 }]}>
            <View style={styles.cardHeader}>
              <Feather name="music" size={14} color={NEON} />
              <Text style={styles.cardTitle}>GÉNERO</Text>
            </View>
            <View style={[styles.genreChip, { borderColor: NEON }]}>
              <Text style={[styles.genreChipText, { color: NEON }]}>
                {displayGenre.toUpperCase()}
              </Text>
            </View>
            {artist.label ? (
              <Text style={styles.genreDesc}>Sello: {artist.label}</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  heroArea: {
    height: 400,
    position: "relative",
    backgroundColor: "#111",
    overflow: "hidden",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.72,
  },
  heroImagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  heroPlaceholderLetter: {
    color: "rgba(255,255,255,0.05)",
    fontFamily: "Anton_400Regular",
    fontSize: 200,
    lineHeight: 210,
  },
  heroGradientSide: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "65%",
    backgroundColor: "rgba(5,5,5,0.55)",
  },
  heroGradientBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 200,
    backgroundColor: "rgba(5,5,5,0.90)",
  },
  backButton: {
    position: "absolute",
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  genreTag: {
    position: "absolute",
    right: 16,
    zIndex: 10,
  },
  genreTagText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 2.5,
  },
  heroText: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
  },
  artistName: {
    color: "#FFFFFF",
    fontFamily: "Anton_400Regular",
    fontSize: 48,
    lineHeight: 56,
    marginBottom: 10,
  },
  artistCountry: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 3,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  statBox: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: "#111111",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
  },
  statValue: {
    color: "#E4E4E7",
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    letterSpacing: -0.5,
  },
  statLabel: {
    color: "#52525B",
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 1.5,
    marginTop: 5,
    textAlign: "center",
  },

  card: {
    backgroundColor: "#111111",
    borderRadius: 14,
    padding: 18,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    color: "#52525B",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 2.5,
  },

  platformRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  platformDot: { width: 7, height: 7, borderRadius: 3.5 },
  platformLabel: {
    flex: 1,
    color: "#A1A1AA",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  platformValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },

  genreChip: {
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  genreChipText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 1.5,
  },
  genreDesc: {
    color: "#71717A",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },

  emptyText: {
    color: "#52525B",
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    marginTop: 12,
  },
});
