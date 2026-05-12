import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useArtistImages } from "@/hooks/useArtistImages";
import { TOP_ARTISTS } from "@/data/chartData";

const NEON = "#39FF14";
const BG = "#050505";

const TOURING_ARTISTS = TOP_ARTISTS.filter((a) => a.tour);

const TOURING_NAMES = TOURING_ARTISTS.map((a) => a.name);

const STAT_SUMMARY = [
  { v: `${TOURING_ARTISTS.length}`, l: "artistas en gira" },
  { v: "$119M+", l: "recaudación total" },
  { v: "3 continentes", l: "alcance global" },
];

function InitialAvatar({ name, size, accent }: { name: string; size: number; accent?: string }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: accent ? `${accent}44` : "rgba(255,255,255,0.12)",
    }}>
      <Text style={{ color: accent ?? "#E4E4E7", fontFamily: "Inter_700Bold", fontSize: Math.round(size * 0.38) }}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function TourCard({ artist, photo }: { artist: typeof TOURING_ARTISTS[0]; photo: string | null }) {
  const accentColor = artist.accent.startsWith("#") ? artist.accent : NEON;
  const isTop = artist.rank <= 3;

  return (
    <TouchableOpacity
      style={styles.tourCard}
      activeOpacity={0.78}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({ pathname: "/artist/[name]", params: { name: artist.name } });
      }}
    >
      {/* Photo header */}
      <View style={styles.tourCardPhotoArea}>
        {photo
          ? <Image source={{ uri: photo }} style={styles.tourCardPhoto} resizeMode="cover" />
          : <View style={styles.tourCardPhotoPlaceholder}>
              <Text style={{ color: "rgba(255,255,255,0.13)", fontFamily: "Inter_700Bold", fontSize: 64 }}>
                {artist.name.charAt(0).toUpperCase()}
              </Text>
            </View>
        }
        {/* Gradient */}
        <View style={styles.tourCardOverlay} />
        <View style={styles.tourCardGradientBottom} />

        {/* Rank badge */}
        <View style={[styles.rankBadge, { borderColor: accentColor }]}>
          <Text style={[styles.rankBadgeText, { color: accentColor }]}>#{artist.rank}</Text>
        </View>

        {/* Artist name on photo */}
        <View style={styles.tourCardPhotoText}>
          <Text style={[styles.tourCardTag, { color: accentColor }]}>{artist.tag}</Text>
          <Text style={styles.tourCardArtistName} numberOfLines={1}>
            {artist.name.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Tour info */}
      <View style={styles.tourCardBody}>
        <View style={styles.tourNameRow}>
          <Feather name="map-pin" size={13} color={accentColor} />
          <Text style={styles.tourName} numberOfLines={1}>{artist.tour}</Text>
        </View>

        <View style={styles.tourMeta}>
          <View style={styles.tourMetaItem}>
            <Feather name="calendar" size={12} color="#52525B" />
            <Text style={styles.tourMetaText}>{artist.tourDates}</Text>
          </View>
          {artist.tourGross && (
            <View style={styles.tourMetaItem}>
              <Feather name="dollar-sign" size={12} color="#52525B" />
              <Text style={[styles.tourMetaText, { color: NEON, fontFamily: "Inter_700Bold" }]}>
                {artist.tourGross}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.tourCardBottom}>
          <Text style={styles.tourStreamsLabel}>Oyentes mensuales</Text>
          <Text style={[styles.tourStreamsValue, { color: accentColor }]}>{artist.listeners}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function TouringScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 84 : 0;

  const imageMap = useArtistImages(TOURING_NAMES);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>TOURING</Text>
          <Text style={styles.headerSub}>ARTISTAS EN GIRA · 2024</Text>
        </View>
        <View style={styles.headerBadge}>
          <Feather name="map-pin" size={12} color={NEON} />
          <Text style={styles.headerBadgeText}>EN VIVO</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
      >
        {/* Summary strip */}
        <View style={styles.summaryStrip}>
          {STAT_SUMMARY.map((s, i) => (
            <View
              key={s.l}
              style={[
                styles.summaryItem,
                i < STAT_SUMMARY.length - 1 && { borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.06)" }
              ]}
            >
              <Text style={styles.summaryValue}>{s.v}</Text>
              <Text style={styles.summaryLabel}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* Tour cards grid */}
        <View style={styles.cardsGrid}>
          {TOURING_ARTISTS.map((a) => (
            <TourCard key={a.name} artist={a} photo={imageMap[a.name] ?? null} />
          ))}
        </View>

        {/* Info note */}
        <View style={styles.infoNote}>
          <Feather name="info" size={12} color="#3F3F46" />
          <Text style={styles.infoNoteText}>
            Datos de recaudación y fechas de gira 2024. Toca cualquier artista para ver su perfil completo.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 22, letterSpacing: 2 },
  headerSub: { color: "#52525B", fontFamily: "Inter_500Medium", fontSize: 10, letterSpacing: 1.5, marginTop: 2 },
  headerBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(57,255,20,0.08)",
    borderWidth: 1, borderColor: "rgba(57,255,20,0.22)",
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5,
  },
  headerBadgeText: { color: NEON, fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.5 },
  summaryStrip: {
    flexDirection: "row",
    backgroundColor: "#111111",
    marginHorizontal: 16, marginTop: 14, marginBottom: 4,
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  summaryItem: { flex: 1, alignItems: "center", paddingVertical: 13 },
  summaryValue: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 15, letterSpacing: -0.5 },
  summaryLabel: {
    color: "#52525B", fontFamily: "Inter_400Regular",
    fontSize: 9, letterSpacing: 1, marginTop: 3, textTransform: "uppercase", textAlign: "center",
  },
  cardsGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 12, paddingTop: 14, gap: 12,
  },
  tourCard: {
    width: "47%",
    backgroundColor: "#111111",
    borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  tourCardPhotoArea: {
    height: 160, position: "relative", backgroundColor: "#1A1A1A",
  },
  tourCardPhoto: {
    ...StyleSheet.absoluteFillObject as any,
    opacity: 0.7,
  },
  tourCardPhotoPlaceholder: {
    ...StyleSheet.absoluteFillObject as any,
    alignItems: "center", justifyContent: "center",
  },
  tourCardOverlay: {
    ...StyleSheet.absoluteFillObject as any,
    backgroundColor: "rgba(5,5,5,0.35)",
  },
  tourCardGradientBottom: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: 80,
    backgroundColor: "rgba(5,5,5,0.88)",
  },
  rankBadge: {
    position: "absolute", top: 10, right: 10,
    borderWidth: 1, borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  rankBadgeText: { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 0.5 },
  tourCardPhotoText: {
    position: "absolute", bottom: 12, left: 12, right: 12,
  },
  tourCardTag: {
    fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 2, marginBottom: 3,
  },
  tourCardArtistName: {
    color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 15, letterSpacing: -0.3,
  },
  tourCardBody: { padding: 12, gap: 8 },
  tourNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tourName: {
    flex: 1, color: "#E4E4E7", fontFamily: "Inter_600SemiBold", fontSize: 13,
  },
  tourMeta: { gap: 5 },
  tourMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  tourMetaText: { color: "#71717A", fontFamily: "Inter_400Regular", fontSize: 11 },
  tourCardBottom: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)",
  },
  tourStreamsLabel: { color: "#52525B", fontFamily: "Inter_400Regular", fontSize: 10, letterSpacing: 0.3 },
  tourStreamsValue: { fontFamily: "Inter_700Bold", fontSize: 13 },
  infoNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    paddingHorizontal: 20, paddingTop: 6,
  },
  infoNoteText: { flex: 1, color: "#3F3F46", fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 17 },
});
