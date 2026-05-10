import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useArtistImages } from "@/hooks/useArtistImages";
import { TOP_ARTISTS, Artist } from "@/data/chartData";

const NEON = "#39FF14";
const BG = "#050505";

const ALL_GENRES = ["TODOS", "CORRIDOS", "REG. MEX.", "NORTEÑO", "BANDA"];

const ALL_NAMES = TOP_ARTISTS.map((a) => a.name);

function InitialAvatar({ initial, size, fontSize }: { initial: string; size: number; fontSize?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#1A1A1A",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: "#E4E4E7",
          fontFamily: "Inter_700Bold",
          fontSize: fontSize ?? Math.round(size * 0.4),
          letterSpacing: 0,
        }}
      >
        {initial.toUpperCase()}
      </Text>
    </View>
  );
}

function ArtistRow({
  artist,
  index,
  photo,
}: {
  artist: Artist;
  index: number;
  photo: string | null;
}) {
  const isTop3 = artist.rank <= 3;

  return (
    <TouchableOpacity
      style={[
        styles.row,
        index === 0
          ? { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }
          : null,
      ]}
      activeOpacity={0.72}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/artist/[name]", params: { name: artist.name } });
      }}
    >
      <View style={styles.rankContainer}>
        <Text
          style={[
            styles.rankNum,
            isTop3 ? { color: NEON } : { color: "#52525B" },
          ]}
        >
          {artist.rank}
        </Text>
        {isTop3 && (
          <View style={[styles.rankDot, { backgroundColor: artist.accent }]} />
        )}
      </View>

      {photo ? (
        <Image source={{ uri: photo }} style={styles.rowPhoto} />
      ) : (
        <InitialAvatar initial={artist.name.charAt(0)} size={44} fontSize={18} />
      )}

      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>
          {artist.name}
        </Text>
        <Text style={styles.rowGenre} numberOfLines={1}>
          {artist.tag}
        </Text>
      </View>

      <View style={styles.rowStats}>
        <Text
          style={[
            styles.rowStreams,
            isTop3 ? { color: artist.accent } : { color: "#A1A1AA" },
          ]}
        >
          {artist.streams}
        </Text>
        <Text style={[styles.rowGrowth, { color: NEON }]}>{artist.growth}</Text>
      </View>

      <Feather name="chevron-right" size={14} color="#3F3F46" />
    </TouchableOpacity>
  );
}

export default function ChartsScreen() {
  const insets = useSafeAreaInsets();
  const [activeGenre, setActiveGenre] = useState(0);

  const imageMap = useArtistImages(ALL_NAMES);

  const filtered = useMemo(() => {
    if (activeGenre === 0) return TOP_ARTISTS;
    const genreFilter = ALL_GENRES[activeGenre];
    return TOP_ARTISTS.filter((a) => {
      if (genreFilter === "CORRIDOS") return a.tag === "CORRIDOS TUMBADOS";
      if (genreFilter === "REG. MEX.") return a.tag === "REGIONAL MEXICANO";
      if (genreFilter === "NORTEÑO") return a.tag === "NORTEÑO";
      if (genreFilter === "BANDA") return a.tag === "BANDA";
      return true;
    });
  }, [activeGenre]);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 84 : 0;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>CHARTS</Text>
          <Text style={styles.headerSub}>MÉXICO · SEMANA 19 · 2024</Text>
        </View>
        <View style={styles.headerBadge}>
          <Feather name="trending-up" size={12} color={NEON} />
          <Text style={styles.headerBadgeText}>EN VIVO</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {ALL_GENRES.map((g, i) => (
          <TouchableOpacity
            key={g}
            style={[
              styles.filterPill,
              i === activeGenre ? styles.filterPillActive : null,
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveGenre(i);
            }}
          >
            <Text
              style={[
                styles.filterPillText,
                i === activeGenre ? styles.filterPillTextActive : null,
              ]}
            >
              {g}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.columnHeaders}>
        <Text style={[styles.columnHeader, { width: 44 }]}>#</Text>
        <Text style={[styles.columnHeader, { flex: 1, marginLeft: 44 }]}>
          ARTISTA
        </Text>
        <Text
          style={[
            styles.columnHeader,
            { textAlign: "right", marginRight: 24 },
          ]}
        >
          STREAMS
        </Text>
      </View>

      <FlatList
        data={filtered}
        renderItem={({ item, index }) => (
          <ArtistRow
            artist={item}
            index={index}
            photo={imageMap[item.name] ?? null}
          />
        )}
        keyExtractor={(item) => item.name}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 20 }}
        scrollEnabled={filtered.length > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
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
    backgroundColor: "rgba(57,255,20,0.1)",
    borderWidth: 1,
    borderColor: "rgba(57,255,20,0.25)",
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
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  filterPillActive: {
    backgroundColor: "#39FF14",
    borderColor: "#39FF14",
  },
  filterPillText: {
    color: "#71717A",
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  filterPillTextActive: {
    color: "#000000",
  },
  columnHeaders: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  columnHeader: {
    color: "#3F3F46",
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  rankContainer: {
    width: 28,
    alignItems: "center",
    position: "relative",
  },
  rankNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    letterSpacing: -0.5,
  },
  rankDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  rowPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  rowName: {
    color: "#E4E4E7",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  rowGenre: {
    color: "#71717A",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  rowStats: {
    alignItems: "flex-end",
    gap: 2,
  },
  rowStreams: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  rowGrowth: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
});
