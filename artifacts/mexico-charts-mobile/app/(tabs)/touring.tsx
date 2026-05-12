import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useArtistImages } from "@/hooks/useArtistImages";
import { TOP_ARTISTS } from "@/data/chartData";

const NEON = "#39FF14";
const BG = "#050505";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TOURING_ARTISTS = TOP_ARTISTS.filter((a) => a.tour);
const TOURING_NAMES = TOURING_ARTISTS.map((a) => a.name);

const STAT_SUMMARY = [
  { v: `${TOURING_ARTISTS.length}`, l: "artistas en gira" },
  { v: "$119M+", l: "recaudación total" },
  { v: "3 continentes", l: "alcance global" },
];

function InitialAvatar({
  name,
  size,
  accent,
}: {
  name: string;
  size: number;
  accent?: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#1A1A1A",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: accent ? `${accent}44` : "rgba(255,255,255,0.12)",
      }}
    >
      <Text
        style={{
          color: accent ?? "#E4E4E7",
          fontFamily: "Inter_700Bold",
          fontSize: Math.round(size * 0.38),
        }}
      >
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function TourCard({
  artist,
  photo,
}: {
  artist: (typeof TOURING_ARTISTS)[0];
  photo: string | null;
}) {
  const accentColor = artist.accent.startsWith("#") ? artist.accent : NEON;

  return (
    <TouchableOpacity
      style={styles.tourCard}
      activeOpacity={0.8}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({
          pathname: "/artist/[name]",
          params: { name: artist.name },
        });
      }}
    >
      {/* Large photo header */}
      <View style={styles.photoArea}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={styles.photo}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text
              style={{
                color: "rgba(255,255,255,0.06)",
                fontFamily: "Inter_700Bold",
                fontSize: 100,
              }}
            >
              {artist.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Dark overlay */}
        <View style={styles.photoOverlay} />

        {/* Bottom gradient */}
        <View style={styles.photoGradient} />

        {/* Left neon accent stripe */}
        <View style={[styles.accentStripe, { backgroundColor: accentColor }]} />

        {/* Rank badge */}
        <View style={[styles.rankBadge, { borderColor: accentColor }]}>
          <Text style={[styles.rankBadgeText, { color: accentColor }]}>
            #{artist.rank}
          </Text>
        </View>

        {/* Name overlay */}
        <View style={styles.nameOverlay}>
          <Text style={[styles.artistTag, { color: accentColor }]}>
            {artist.tag}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {artist.name.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Tour details */}
      <View style={styles.cardBody}>
        <View style={styles.tourNameRow}>
          <Feather name="map-pin" size={13} color={accentColor} />
          <Text style={styles.tourName} numberOfLines={1}>
            {artist.tour}
          </Text>
          <Feather name="chevron-right" size={14} color="#3F3F46" />
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Feather name="calendar" size={11} color="#3F3F46" />
            <Text style={styles.metaText}>{artist.tourDates}</Text>
          </View>
          {artist.tourGross && (
            <View style={styles.metaItem}>
              <Feather name="dollar-sign" size={11} color="#3F3F46" />
              <Text style={[styles.metaText, { color: NEON, fontFamily: "Inter_700Bold" }]}>
                {artist.tourGross}
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Feather name="headphones" size={11} color="#3F3F46" />
            <Text style={styles.metaText}>{artist.listeners} oyentes</Text>
          </View>
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
                i < STAT_SUMMARY.length - 1 && {
                  borderRightWidth: 1,
                  borderRightColor: "rgba(255,255,255,0.06)",
                },
              ]}
            >
              <Text style={styles.summaryValue}>{s.v}</Text>
              <Text style={styles.summaryLabel}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* Cinematic full-width tour cards */}
        <View style={styles.cardsList}>
          {TOURING_ARTISTS.map((a) => (
            <TourCard
              key={a.name}
              artist={a}
              photo={imageMap[a.name] ?? null}
            />
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

const CARD_WIDTH = SCREEN_WIDTH - 32;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    letterSpacing: 2,
  },
  headerSub: {
    color: "#52525B",
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(57,255,20,0.08)",
    borderWidth: 1,
    borderColor: "rgba(57,255,20,0.22)",
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  headerBadgeText: {
    color: NEON,
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 1.5,
  },
  summaryStrip: {
    flexDirection: "row",
    backgroundColor: "#111111",
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  summaryItem: { flex: 1, alignItems: "center", paddingVertical: 14 },
  summaryValue: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    letterSpacing: -0.5,
  },
  summaryLabel: {
    color: "#52525B",
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 3,
    textTransform: "uppercase",
    textAlign: "center",
  },
  cardsList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  tourCard: {
    width: CARD_WIDTH,
    backgroundColor: "#111111",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  photoArea: {
    height: 260,
    position: "relative",
    backgroundColor: "#1A1A1A",
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.78,
  },
  photoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,5,5,0.25)",
  },
  photoGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 140,
    backgroundColor: "rgba(5,5,5,0.92)",
  },
  accentStripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  rankBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(5,5,5,0.5)",
  },
  rankBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  nameOverlay: {
    position: "absolute",
    bottom: 18,
    left: 20,
    right: 20,
  },
  artistTag: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 2.5,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  artistName: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    letterSpacing: -1,
    lineHeight: 34,
  },
  cardBody: {
    padding: 18,
    gap: 12,
  },
  tourNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tourName: {
    flex: 1,
    color: "#E4E4E7",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  metaGrid: {
    gap: 7,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  metaText: {
    color: "#71717A",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  infoNoteText: {
    flex: 1,
    color: "#3F3F46",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 17,
  },
});
