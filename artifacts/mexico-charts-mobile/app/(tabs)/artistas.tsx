import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useArtistImages } from "@/hooks/useArtistImages";
import { useArtistMetadata, ArtistMeta } from "@/hooks/useArtistMetadata";

const NEON = "#39FF14";
const BG = "#050505";

// Genre color map (matches web)
const GENRE_COLORS: Record<string, string> = {
  "Corridos Tumbados": NEON,
  "corridos tumbados": NEON,
  "Regional Mexicano": "#4ade80",
  "regional mexicano": "#4ade80",
  "Norteño": "#86efac",
  "norteño": "#86efac",
  "Banda": "#a3e635",
  "banda": "#a3e635",
  "Hip-Hop Mexicano": "#facc15",
  "hip-hop": "#facc15",
  "hip hop mexicano": "#facc15",
  "Pop": "#fb923c",
  "pop": "#fb923c",
  "Grupero": "#f472b6",
  "Balada": "#818cf8",
  "Rock Mexicano": "#f87171",
};

function genreColor(g: string): string {
  return GENRE_COLORS[g] ?? GENRE_COLORS[g.toLowerCase()] ?? NEON;
}

function displayGenre(meta: ArtistMeta): string {
  if (meta.subgenre) return meta.subgenre;
  if (meta.genre) return meta.genre;
  return "—";
}

// ── Artist card ───────────────────────────────────────────────────────────────

function ArtistCard({
  meta,
  photo,
  index,
}: {
  meta: ArtistMeta;
  photo: string | null;
  index: number;
}) {
  const genre = displayGenre(meta);
  const color = genreColor(genre);
  const isTop3 = index < 3;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.75}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/artist/[name]", params: { name: meta.displayName } });
      }}
    >
      {/* Left color accent */}
      <View style={[styles.accentBar, { backgroundColor: color }]} />

      {/* Photo */}
      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} />
      ) : (
        <View
          style={[
            styles.photoPlaceholder,
            { borderColor: `${color}44`, backgroundColor: `${color}0a` },
          ]}
        >
          <Text
            style={{
              color,
              fontFamily: "Inter_700Bold",
              fontSize: 18,
            }}
          >
            {meta.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {meta.displayName}
        </Text>
        <View style={styles.tagRow}>
          <Text
            style={[
              styles.genreTag,
              { color, borderColor: `${color}30`, backgroundColor: `${color}12` },
            ]}
            numberOfLines={1}
          >
            {genre}
          </Text>
          {meta.country ? (
            <Text style={styles.country}>{meta.country}</Text>
          ) : null}
        </View>
        <View style={styles.statsRow}>
          {meta.spotifyListenersFmt !== "—" ? (
            <View style={styles.statItem}>
              <Feather name="music" size={9} color="#1DB954" />
              <Text style={styles.statValue}>{meta.spotifyListenersFmt}</Text>
            </View>
          ) : null}
          {meta.instagramFollowersFmt !== "—" ? (
            <View style={styles.statItem}>
              <Feather name="instagram" size={9} color="#E1306C" />
              <Text style={styles.statValue}>{meta.instagramFollowersFmt}</Text>
            </View>
          ) : null}
          {meta.tiktokFollowersFmt !== "—" ? (
            <View style={styles.statItem}>
              <Feather name="video" size={9} color="#E4E4E7" />
              <Text style={styles.statValue}>{meta.tiktokFollowersFmt}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Spotify streams highlight */}
      <View style={styles.rightCol}>
        {meta.spotifyStreamsFmt !== "—" ? (
          <>
            <Text
              style={[
                styles.streams,
                isTop3 ? { color } : { color: "#A1A1AA" },
              ]}
            >
              {meta.spotifyStreamsFmt}
            </Text>
            <Text style={styles.streamsLabel}>streams</Text>
          </>
        ) : null}
        <Feather name="chevron-right" size={14} color="#3F3F46" style={{ marginTop: 4 }} />
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

const GENRE_FILTERS = [
  { label: "TODOS", match: "" },
  { label: "CORRIDOS", match: "corridos tumbados" },
  { label: "REG. MEX.", match: "regional mexicano" },
  { label: "NORTEÑO", match: "norteño" },
  { label: "BANDA", match: "banda" },
  { label: "HIP-HOP", match: "hip-hop" },
  { label: "POP", match: "pop" },
];

export default function ArtistasScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState(0);

  const { artists, isLoading, hasError } = useArtistMetadata();

  const allNames = useMemo(() => artists.map((a) => a.displayName), [artists]);
  const imageMap = useArtistImages(allNames);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 84 : 0;

  const filtered = useMemo(() => {
    let list = artists;
    const match = GENRE_FILTERS[activeFilter].match;
    if (match) {
      list = list.filter((a) => {
        const sub = (a.subgenre ?? "").toLowerCase();
        const gen = (a.genre ?? "").toLowerCase();
        return sub.includes(match) || gen.includes(match);
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((a) => a.displayName.toLowerCase().includes(q));
    }
    return list;
  }, [artists, activeFilter, search]);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>ARTISTAS</Text>
          <Text style={styles.headerSub}>
            {isLoading
              ? "CARGANDO…"
              : `${artists.length} ARTISTAS MEXICANOS`}
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <Feather name="users" size={12} color={NEON} />
          <Text style={styles.headerBadgeText}>
            {hasError ? "OFFLINE" : isLoading ? "…" : "BASE DE DATOS"}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Feather name="search" size={15} color="#52525B" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar artista…"
          placeholderTextColor="#52525B"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={15} color="#52525B" />
          </TouchableOpacity>
        )}
      </View>

      {/* Genre filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 48 }}
        contentContainerStyle={styles.filterContent}
      >
        {GENRE_FILTERS.map((f, i) => (
          <TouchableOpacity
            key={f.label}
            style={[styles.pill, i === activeFilter && styles.pillActive]}
            onPress={() => { Haptics.selectionAsync(); setActiveFilter(i); }}
          >
            <Text
              style={[styles.pillText, i === activeFilter && styles.pillTextActive]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Count row */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {isLoading ? "—" : `${filtered.length} artistas`}
        </Text>
        <Text style={styles.sortText}>ORDENADO POR STREAMS SPOTIFY</Text>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Feather name="loader" size={24} color="#52525B" />
          <Text style={styles.statusText}>Cargando artistas…</Text>
        </View>
      ) : hasError ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Feather name="wifi-off" size={24} color="#3F3F46" />
          <Text style={styles.statusText}>Error de conexión</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.artistKey}
          renderItem={({ item, index }) => (
            <ArtistCard
              meta={item}
              photo={imageMap[item.displayName] ?? null}
              index={index}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomInset + 20 }}
          ListEmptyComponent={
            <View style={{ paddingTop: 60, alignItems: "center" }}>
              <Feather name="search" size={32} color="#3F3F46" />
              <Text style={[styles.statusText, { marginTop: 12 }]}>Sin resultados</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
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
    fontSize: 9,
    letterSpacing: 1.5,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111111",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  searchInput: {
    flex: 1,
    color: "#E4E4E7",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 7,
    flexDirection: "row",
    alignItems: "center",
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  pillActive: { backgroundColor: NEON, borderColor: NEON },
  pillText: {
    color: "#71717A",
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  pillTextActive: { color: "#000000" },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  countText: {
    color: "#52525B",
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  sortText: {
    color: "#3F3F46",
    fontFamily: "Inter_700Bold",
    fontSize: 8,
    letterSpacing: 1.5,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    paddingVertical: 12,
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  accentBar: {
    width: 3,
    alignSelf: "stretch",
    marginRight: 12,
    borderRadius: 0,
  },
  photo: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  photoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  info: { flex: 1, minWidth: 0 },
  name: { color: "#E4E4E7", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  genreTag: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
    borderWidth: 1,
    textTransform: "uppercase",
  },
  country: {
    color: "#52525B",
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  statValue: {
    color: "#71717A",
    fontFamily: "Inter_500Medium",
    fontSize: 10,
  },
  rightCol: { alignItems: "flex-end", minWidth: 52 },
  streams: { fontFamily: "Inter_700Bold", fontSize: 13 },
  streamsLabel: {
    color: "#3F3F46",
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statusText: {
    color: "#3F3F46",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
