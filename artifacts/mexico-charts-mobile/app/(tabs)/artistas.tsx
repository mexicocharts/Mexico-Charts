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
import { useHubData, HubRow } from "@/hooks/useHubData";
import { TOP_ARTISTS, Artist } from "@/data/chartData";

const NEON = "#39FF14";
const BG = "#050505";

const GENRE_FILTERS = [
  { label: "TODOS", match: null },
  { label: "CORRIDOS", match: "CORRIDOS TUMBADOS" },
  { label: "REG. MEX.", match: "REGIONAL MEXICANO" },
  { label: "NORTEÑO", match: "NORTEÑO" },
  { label: "BANDA", match: "BANDA" },
];

function buildArtist(row: HubRow): Artist {
  const st = TOP_ARTISTS.find(
    (a) => a.name.toLowerCase() === row.Artist.toLowerCase()
  );
  const gained = row.Prev > 0 && row.Rank > 0 ? row.Prev - row.Rank : 0;
  return {
    rank: row.Rank,
    name: row.Artist,
    genre: st?.genre ?? "Regional Mexicano",
    streams: st?.streams ?? "—",
    listeners: st?.listeners ?? "—",
    growth:
      st?.growth ??
      (gained > 0 ? `+${gained}` : gained < 0 ? `${gained}` : "="),
    countries: st?.countries ?? "—",
    tag: st?.tag ?? "REGIONAL MEXICANO",
    accent: st?.accent ?? "rgba(255,255,255,0.20)",
    tour: st?.tour,
    tourDates: st?.tourDates,
    tourGross: st?.tourGross,
  };
}

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
        borderColor: accent ? `${accent}55` : "rgba(255,255,255,0.12)",
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

function MovementIndicator({ row }: { row?: HubRow }) {
  if (!row) return null;
  const gained = row.Prev > 0 && row.Rank > 0 ? row.Prev - row.Rank : 0;
  if (gained === 0) return null;
  return (
    <View style={gained > 0 ? styles.movUp : styles.movDown}>
      <Feather
        name={gained > 0 ? "arrow-up" : "arrow-down"}
        size={8}
        color={gained > 0 ? NEON : "#EF4444"}
      />
      <Text
        style={[
          styles.movLabel,
          { color: gained > 0 ? NEON : "#EF4444" },
        ]}
      >
        {Math.abs(gained)}
      </Text>
    </View>
  );
}

function ArtistCard({
  artist,
  hubRow,
  photo,
}: {
  artist: Artist;
  hubRow?: HubRow;
  photo: string | null;
}) {
  const isTop3 = artist.rank <= 3;
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.72}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
          pathname: "/artist/[name]",
          params: { name: artist.name },
        });
      }}
    >
      <View style={styles.rankCol}>
        <Text style={[styles.rank, { color: isTop3 ? NEON : "#3F3F46" }]}>
          {String(artist.rank).padStart(2, "0")}
        </Text>
        <MovementIndicator row={hubRow} />
      </View>

      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} />
      ) : (
        <InitialAvatar name={artist.name} size={48} accent={artist.accent} />
      )}

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {artist.name}
        </Text>
        <Text style={styles.tag} numberOfLines={1}>
          {artist.tag}
        </Text>
      </View>

      <View style={styles.statsCol}>
        <Text
          style={[
            styles.streams,
            { color: isTop3 ? artist.accent : "#A1A1AA" },
          ]}
        >
          {artist.streams}
        </Text>
        <Text style={styles.growth}>{artist.growth}</Text>
      </View>

      <Feather name="chevron-right" size={14} color="#3F3F46" />
    </TouchableOpacity>
  );
}

export default function ArtistasScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState(0);

  const { rows, isLoading } = useHubData();

  const liveArtists = useMemo<Artist[]>(() => {
    if (rows.length === 0) return TOP_ARTISTS;
    return rows.map((r) => buildArtist(r));
  }, [rows]);

  const rowMap = useMemo(() => {
    const m: Record<string, HubRow> = {};
    for (const r of rows) m[r.Artist.toLowerCase()] = r;
    return m;
  }, [rows]);

  const allNames = useMemo(() => liveArtists.map((a) => a.name), [liveArtists]);
  const imageMap = useArtistImages(allNames);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 84 : 0;

  const filtered = useMemo(() => {
    let list = liveArtists;
    const match = GENRE_FILTERS[activeFilter].match;
    if (match) list = list.filter((a) => a.tag === match);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }
    return list;
  }, [activeFilter, search, liveArtists]);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>ARTISTAS</Text>
          <Text style={styles.headerSub}>
            {liveArtists.length} ARTISTAS · MÉXICO
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <Feather name="users" size={12} color={NEON} />
          <Text style={styles.headerBadgeText}>
            {isLoading ? "CARGANDO" : rows.length > 0 ? "EN VIVO" : "BASE DE DATOS"}
          </Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <Feather
          name="search"
          size={15}
          color="#52525B"
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar artista..."
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {GENRE_FILTERS.map((f, i) => (
          <TouchableOpacity
            key={f.label}
            style={[styles.pill, i === activeFilter && styles.pillActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveFilter(i);
            }}
          >
            <Text
              style={[
                styles.pillText,
                i === activeFilter && styles.pillTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.colHeaders}>
        <Text style={[styles.colHeader, { width: 36 }]}>#</Text>
        <Text style={[styles.colHeader, { flex: 1, marginLeft: 52 }]}>
          ARTISTA
        </Text>
        <Text
          style={[
            styles.colHeader,
            { textAlign: "right", marginRight: 24 },
          ]}
        >
          STREAMS
        </Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <ArtistCard
            artist={item}
            hubRow={rowMap[item.name.toLowerCase()]}
            photo={imageMap[item.name] ?? null}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 20 }}
        ListEmptyComponent={
          <View style={{ paddingTop: 60, alignItems: "center" }}>
            <Feather name="search" size={32} color="#3F3F46" />
            <Text
              style={{
                color: "#52525B",
                fontFamily: "Inter_500Medium",
                fontSize: 14,
                marginTop: 12,
              }}
            >
              Sin resultados
            </Text>
          </View>
        }
      />
    </View>
  );
}

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
  filterScroll: { maxHeight: 52 },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
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
  colHeaders: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  colHeader: {
    color: "#3F3F46",
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  rankCol: { width: 32, alignItems: "center", gap: 3 },
  rank: { fontFamily: "Inter_700Bold", fontSize: 13, letterSpacing: -0.5 },
  movUp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    backgroundColor: "rgba(57,255,20,0.12)",
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  movDown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  movLabel: { fontFamily: "Inter_700Bold", fontSize: 8 },
  photo: { width: 48, height: 48, borderRadius: 24 },
  info: { flex: 1 },
  name: { color: "#E4E4E7", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  tag: {
    color: "#52525B",
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statsCol: { alignItems: "flex-end", gap: 2 },
  streams: { fontFamily: "Inter_700Bold", fontSize: 13 },
  growth: { color: NEON, fontFamily: "Inter_600SemiBold", fontSize: 11 },
});
