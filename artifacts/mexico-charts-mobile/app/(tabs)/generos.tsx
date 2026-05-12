import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useArtistImages } from "@/hooks/useArtistImages";
import { GENRES, TOP_ARTISTS } from "@/data/chartData";

const NEON = "#39FF14";
const BG = "#050505";

const GENRE_DESCRIPTIONS: Record<string, string> = {
  "Corridos Tumbados": "La fusión de corridos tradicionales con trap y hip-hop. El sonido que conquistó el mundo desde Sinaloa.",
  "Regional Mexicano": "El género más escuchado de México. Banda, norteño y cumbia bajo un mismo estandarte.",
  "Norteño": "Acordeón, bajo sexto e historias del norte. Raíces profundas con millones de oyentes globales.",
  "Banda": "Los metales de Sinaloa que suenan en estadios. Potencia, celebración y tradición mexicana.",
  "Hip-Hop Mexicano": "Letras callejeras y ritmos urbanos nacidos en México. Voz de una generación.",
  "Pop Urbano": "Pop latino con sello mexicano. Melodías que cruzan fronteras y conectan culturas.",
};

function artistsForGenre(genreName: string) {
  const tagMap: Record<string, string> = {
    "Corridos Tumbados": "CORRIDOS TUMBADOS",
    "Regional Mexicano": "REGIONAL MEXICANO",
    "Norteño": "NORTEÑO",
    "Banda": "BANDA",
  };
  const tag = tagMap[genreName];
  if (!tag) return [];
  return TOP_ARTISTS.filter((a) => a.tag === tag);
}

function InitialAvatar({ name, size, accent }: { name: string; size: number; accent?: string }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: accent ? `${accent}44` : "rgba(255,255,255,0.10)",
    }}>
      <Text style={{ color: accent ?? "#E4E4E7", fontFamily: "Inter_700Bold", fontSize: Math.round(size * 0.38) }}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function GenreCard({ genre, isSelected, onPress, imageMap }: {
  genre: typeof GENRES[0];
  isSelected: boolean;
  onPress: () => void;
  imageMap: Record<string, string | null>;
}) {
  const artists = artistsForGenre(genre.name);

  return (
    <View style={[styles.genreCard, isSelected && { borderColor: genre.accent }]}>
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        {/* Header row */}
        <View style={styles.genreCardHeader}>
          {/* Accent left bar */}
          <View style={[styles.accentBar, { backgroundColor: genre.accent }]} />
          <View style={styles.genreCardHeaderText}>
            <View style={styles.genreNameRow}>
              <Text style={styles.genreName}>{genre.name}</Text>
              {isSelected && (
                <View style={[styles.activeBadge, { backgroundColor: `${genre.accent}22`, borderColor: `${genre.accent}55` }]}>
                  <Text style={[styles.activeBadgeText, { color: genre.accent }]}>ACTIVO</Text>
                </View>
              )}
            </View>
            <Text style={styles.genreArtistCount}>{genre.artists} artistas</Text>
          </View>
          <View style={styles.genreStatsRight}>
            <Text style={[styles.genreStreams, { color: genre.accent }]}>{genre.streams}</Text>
            <Text style={styles.genreStreamsLabel}>streams spotify</Text>
          </View>
          <Feather
            name={isSelected ? "chevron-up" : "chevron-down"}
            size={16}
            color="#52525B"
            style={{ marginLeft: 4 }}
          />
        </View>
      </TouchableOpacity>

      {/* Expanded artist list */}
      {isSelected && artists.length > 0 && (
        <View style={styles.artistList}>
          <View style={styles.artistListDivider} />
          {artists.map((a, idx) => {
            const photo = imageMap[a.name] ?? null;
            return (
              <TouchableOpacity
                key={a.name}
                style={styles.artistRow}
                activeOpacity={0.72}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: "/artist/[name]", params: { name: a.name } });
                }}
              >
                <Text style={[styles.artistRowRank, { color: idx < 3 ? genre.accent : "#3F3F46" }]}>
                  {String(a.rank).padStart(2, "0")}
                </Text>
                {photo
                  ? <Image source={{ uri: photo }} style={styles.artistRowPhoto} />
                  : <InitialAvatar name={a.name} size={36} accent={a.accent} />
                }
                <View style={{ flex: 1 }}>
                  <Text style={styles.artistRowName} numberOfLines={1}>{a.name}</Text>
                  <Text style={styles.artistRowStreams}>{a.streams}</Text>
                </View>
                <Text style={[styles.artistRowGrowth, { color: NEON }]}>{a.growth}</Text>
                <Feather name="chevron-right" size={13} color="#3F3F46" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            );
          })}
          {artists.length === 0 && (
            <Text style={{ color: "#52525B", fontFamily: "Inter_400Regular", fontSize: 13, padding: 16 }}>
              Sin artistas en esta base de datos
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

export default function GenerosScreen() {
  const insets = useSafeAreaInsets();
  const [selectedGenre, setSelectedGenre] = useState<string | null>(GENRES[0].name);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 84 : 0;

  const allNames = TOP_ARTISTS.map((a) => a.name);
  const imageMap = useArtistImages(allNames);

  const totalStreams = GENRES.reduce((sum, g) => {
    const num = parseFloat(g.streams.replace("M", ""));
    return sum + num;
  }, 0);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>GÉNEROS</Text>
          <Text style={styles.headerSub}>MÚSICA MEXICANA · {GENRES.length} GÉNEROS</Text>
        </View>
        <View style={styles.headerBadge}>
          <Feather name="music" size={12} color={NEON} />
          <Text style={styles.headerBadgeText}>{totalStreams.toFixed(0)}M</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: bottomInset + 24, gap: 10 }}
      >
        {/* Summary strip */}
        <View style={styles.summaryStrip}>
          {[
            { v: `${GENRES.length}`, l: "géneros" },
            { v: `${totalStreams.toFixed(0)}M`, l: "streams" },
            { v: `${GENRES.reduce((s, g) => s + g.artists, 0)}`, l: "artistas" },
          ].map((s) => (
            <View key={s.l} style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{s.v}</Text>
              <Text style={styles.summaryLabel}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* Genre cards */}
        {GENRES.map((g) => (
          <GenreCard
            key={g.name}
            genre={g}
            isSelected={selectedGenre === g.name}
            imageMap={imageMap}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedGenre(selectedGenre === g.name ? null : g.name);
            }}
          />
        ))}

        {/* Genre description */}
        {selectedGenre && GENRE_DESCRIPTIONS[selectedGenre] && (
          <View style={styles.descCard}>
            <Feather name="info" size={13} color="#52525B" style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={styles.descText}>{GENRE_DESCRIPTIONS[selectedGenre]}</Text>
          </View>
        )}
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
  headerBadgeText: { color: NEON, fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1 },
  summaryStrip: {
    flexDirection: "row",
    backgroundColor: "#111111",
    borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    marginBottom: 2,
  },
  summaryItem: {
    flex: 1, alignItems: "center", paddingVertical: 14,
    borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.06)",
  },
  summaryValue: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 18, letterSpacing: -0.5 },
  summaryLabel: { color: "#52525B", fontFamily: "Inter_500Medium", fontSize: 10, letterSpacing: 1.5, marginTop: 2, textTransform: "uppercase" },
  genreCard: {
    backgroundColor: "#111111",
    borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  genreCardHeader: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 16, paddingRight: 16, paddingLeft: 0,
  },
  accentBar: { width: 3, alignSelf: "stretch", marginRight: 14, borderRadius: 0 },
  genreCardHeaderText: { flex: 1 },
  genreNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  genreName: { color: "#E4E4E7", fontFamily: "Inter_700Bold", fontSize: 15 },
  activeBadge: {
    borderWidth: 1, borderRadius: 100, paddingHorizontal: 7, paddingVertical: 2,
  },
  activeBadgeText: { fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 1.5 },
  genreArtistCount: { color: "#52525B", fontFamily: "Inter_400Regular", fontSize: 11, letterSpacing: 0.5 },
  genreStatsRight: { alignItems: "flex-end", marginRight: 6 },
  genreStreams: { fontFamily: "Inter_700Bold", fontSize: 17, letterSpacing: -0.5 },
  genreStreamsLabel: { color: "#52525B", fontFamily: "Inter_400Regular", fontSize: 9, letterSpacing: 1, marginTop: 1 },
  artistList: { paddingHorizontal: 16, paddingBottom: 12 },
  artistListDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.05)", marginBottom: 10 },
  artistRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.035)",
  },
  artistRowRank: { fontFamily: "Inter_700Bold", fontSize: 12, width: 22, letterSpacing: -0.5 },
  artistRowPhoto: { width: 36, height: 36, borderRadius: 18 },
  artistRowName: { color: "#E4E4E7", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  artistRowStreams: { color: "#71717A", fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 },
  artistRowGrowth: { fontFamily: "Inter_700Bold", fontSize: 11 },
  descCard: {
    flexDirection: "row", backgroundColor: "#0F0F0F",
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.05)",
    alignItems: "flex-start",
  },
  descText: { flex: 1, color: "#71717A", fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },
});
