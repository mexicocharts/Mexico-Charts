import React from "react";
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

import { useArtistImage } from "@/hooks/useArtistImages";
import { TOP_ARTISTS } from "@/data/chartData";

const NEON = "#39FF14";
const BG = "#050505";

function StatBox({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ArtistDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const insets = useSafeAreaInsets();
  const photo = useArtistImage(name);

  const artist = TOP_ARTISTS.find((a) => a.name === name);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  if (!artist) {
    return (
      <View style={[styles.container, { paddingTop: topInset + 60 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#E4E4E7" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Feather name="user-x" size={40} color="#52525B" />
          <Text style={styles.emptyText}>Artista no encontrado</Text>
        </View>
      </View>
    );
  }

  const accentColor = artist.accent.startsWith("#") ? artist.accent : NEON;

  return (
    <View style={[styles.container]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 32 }}
      >
        {/* Hero photo area */}
        <View style={[styles.heroArea, { paddingTop: topInset }]}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.heroImagePlaceholder}>
              <Feather name="user" size={60} color="#52525B" />
            </View>
          )}
          {/* Gradient overlay */}
          <View style={styles.heroGradient} />

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

          {/* Rank badge */}
          <View style={[styles.rankBadge, { borderColor: accentColor }]}>
            <Text style={[styles.rankBadgeText, { color: accentColor }]}>#{artist.rank}</Text>
          </View>

          {/* Hero text */}
          <View style={styles.heroText}>
            <Text style={[styles.tagLabel, { color: accentColor }]}>{artist.tag}</Text>
            <Text style={styles.artistName}>{artist.name.toUpperCase()}</Text>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatBox label="OYENTES" value={artist.listeners} accent={accentColor} />
          <StatBox label="PAÍSES" value={artist.countries.replace(" PAÍSES", "")} />
          <StatBox label="CRECIMIENTO" value={artist.growth} accent={NEON} />
          <StatBox label="RANK" value={`#${artist.rank}`} />
        </View>

        {/* Content cards */}
        <View style={styles.cardsContainer}>
          {/* Streaming card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="bar-chart-2" size={14} color={accentColor} />
              <Text style={styles.cardTitle}>STREAMING</Text>
            </View>
            <View style={styles.streamRow}>
              <Feather name="headphones" size={16} color="#52525B" />
              <Text style={styles.streamLabel}>Streams mensuales</Text>
              <Text style={[styles.streamValue, { color: accentColor }]}>{artist.streams}</Text>
            </View>
            <View style={styles.streamRow}>
              <Feather name="globe" size={16} color="#52525B" />
              <Text style={styles.streamLabel}>Alcance global</Text>
              <Text style={styles.streamValue}>{artist.countries}</Text>
            </View>
            <View style={styles.streamRow}>
              <Feather name="trending-up" size={16} color="#52525B" />
              <Text style={styles.streamLabel}>Crecimiento semanal</Text>
              <Text style={[styles.streamValue, { color: NEON }]}>{artist.growth}</Text>
            </View>
          </View>

          {/* Tour card — only if available */}
          {artist.tour && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Feather name="map-pin" size={14} color={accentColor} />
                <Text style={styles.cardTitle}>TOURING</Text>
              </View>
              <Text style={styles.tourName}>{artist.tour}</Text>
              <View style={styles.tourRow}>
                <Feather name="calendar" size={14} color="#52525B" />
                <Text style={styles.tourDetail}>{artist.tourDates}</Text>
              </View>
              {artist.tourGross && (
                <View style={styles.tourRow}>
                  <Feather name="dollar-sign" size={14} color="#52525B" />
                  <Text style={styles.tourDetail}>Recaudación: <Text style={{ color: NEON }}>{artist.tourGross}</Text></Text>
                </View>
              )}
            </View>
          )}

          {/* Genre card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="music" size={14} color={accentColor} />
              <Text style={styles.cardTitle}>GÉNERO</Text>
            </View>
            <View style={[styles.genreChip, { borderColor: accentColor }]}>
              <Text style={[styles.genreChipText, { color: accentColor }]}>{artist.tag}</Text>
            </View>
            <Text style={styles.genreDesc}>
              {artist.tag === "CORRIDOS TUMBADOS"
                ? "El género más streameado en México con 48.3M de reproducciones mensuales y en constante ascenso global."
                : artist.tag === "REGIONAL MEXICANO"
                ? "Género con 31.2M streams mensuales, fuerte presencia en 60+ países de habla hispana."
                : artist.tag === "NORTEÑO"
                ? "Género tradicional con 18.7M streams mensuales y audiencias fieles en Norte América."
                : "Género con presencia creciente en el mercado de streaming latinoamericano."}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  heroArea: {
    height: 340,
    position: "relative",
    backgroundColor: "#111",
    overflow: "hidden",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.65,
  },
  heroImagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,5,5,0.55)",
  },
  backButton: {
    position: "absolute",
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  rankBadge: {
    position: "absolute",
    top: 60,
    right: 16,
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
    zIndex: 10,
  },
  rankBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 1,
  },
  heroText: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
  },
  tagLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 2.5,
    marginBottom: 6,
  },
  artistName: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.5,
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
    minWidth: "40%",
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
    letterSpacing: 2,
    marginTop: 4,
  },
  cardsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#111111",
    borderRadius: 14,
    padding: 18,
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
  streamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  streamLabel: {
    flex: 1,
    color: "#A1A1AA",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  streamValue: {
    color: "#E4E4E7",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  tourName: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  tourRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tourDetail: {
    color: "#A1A1AA",
    fontFamily: "Inter_400Regular",
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
    lineHeight: 20,
  },
  emptyText: {
    color: "#52525B",
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    marginTop: 12,
  },
});
