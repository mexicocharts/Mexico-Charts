import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ScrollView,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useArtistImages } from "@/hooks/useArtistImages";
import {
  useChartsHub,
  Row,
  SheetName,
  rankOf,
  prevOf,
  movOf,
  isMexican,
} from "@/hooks/useChartsHub";

const NEON = "#39FF14";
const YT_RED = "#FF0000";
const SP_GREEN = "#1DB954";
const AM_RED = "#fc3c44";
const DZ_PURPLE = "#A238FF";
const BG = "#050505";

// ── Platform config (mirrors web ChartsHub) ──────────────────────────────────

interface ChartTab {
  id: SheetName;
  label: string;
  period: string;
}

interface PlatformDef {
  id: string;
  label: string;
  color: string;
  icon: string;
  charts: ChartTab[];
}

const PLATFORMS: PlatformDef[] = [
  {
    id: "YouTube",
    label: "YouTube",
    color: YT_RED,
    icon: "youtube",
    charts: [
      { id: "YT_Songs_Weekly", label: "Top Songs", period: "Semanal" },
      { id: "YT_Videos_Daily", label: "Top Videos", period: "Diario" },
      { id: "YT_Artists_Weekly", label: "Top Artists", period: "Semanal" },
      { id: "YT_Shorts_Daily", label: "Shorts", period: "Diario" },
    ],
  },
  {
    id: "Spotify",
    label: "Spotify",
    color: SP_GREEN,
    icon: "music",
    charts: [
      { id: "Spotify_Artists_Daily", label: "Top Artists", period: "Diario" },
      { id: "Spotify_Regional_Daily", label: "Regional", period: "Diario" },
      { id: "Spotify_Regional_Weekly", label: "Regional", period: "Semanal" },
      { id: "Spotify_Viral_Daily", label: "Viral", period: "Diario" },
    ],
  },
  {
    id: "Apple Music",
    label: "Apple",
    color: AM_RED,
    icon: "headphones",
    charts: [
      { id: "Apple_Songs", label: "Top Songs", period: "" },
      { id: "Apple_Albums", label: "Top Albums", period: "" },
    ],
  },
  {
    id: "Deezer",
    label: "Deezer",
    color: DZ_PURPLE,
    icon: "radio",
    charts: [
      { id: "Deezer_Top_Mexico", label: "Top México", period: "Diario" },
    ],
  },
];

// ── Column config per sheet ───────────────────────────────────────────────────

interface ColDef {
  key: string;
  label: string;
  isArtist?: boolean;
  isTrack?: boolean;
  isLink?: boolean;
  isMetric?: boolean;
}

const COLS: Record<string, ColDef[]> = {
  Spotify_Artists_Daily: [
    { key: "Artist", label: "Artista", isArtist: true },
    { key: "Streak", label: "Racha" },
  ],
  YT_Artists_Weekly: [
    { key: "Artist Name", label: "Artista", isArtist: true },
    { key: "Views", label: "Views", isMetric: true },
  ],
  YT_Songs_Weekly: [
    { key: "Artist Names", label: "Artista", isArtist: true },
    { key: "Track Name", label: "Canción", isTrack: true },
    { key: "Views", label: "Views", isMetric: true },
  ],
  YT_Videos_Daily: [
    { key: "Artist Names", label: "Artista", isArtist: true },
    { key: "Video Title", label: "Video", isTrack: true },
    { key: "YouTube URL", label: "Ver", isLink: true },
  ],
  YT_Shorts_Daily: [
    { key: "Artist Names", label: "Artista", isArtist: true },
    { key: "Track Name", label: "Short", isTrack: true },
    { key: "YouTube URL", label: "Ver", isLink: true },
  ],
  Spotify_Regional_Daily: [
    { key: "artist_names", label: "Artista", isArtist: true },
    { key: "track_name", label: "Canción", isTrack: true },
    { key: "streams", label: "Streams", isMetric: true },
  ],
  Spotify_Regional_Weekly: [
    { key: "artist_names", label: "Artista", isArtist: true },
    { key: "track_name", label: "Canción", isTrack: true },
    { key: "streams", label: "Streams", isMetric: true },
  ],
  Spotify_Viral_Daily: [
    { key: "artist_names", label: "Artista", isArtist: true },
    { key: "track_name", label: "Canción", isTrack: true },
    { key: "days_on_chart", label: "Días" },
  ],
  Apple_Songs: [
    { key: "Artist Names", label: "Artista", isArtist: true },
    { key: "Title", label: "Canción", isTrack: true },
  ],
  Apple_Albums: [
    { key: "Artist Names", label: "Artista", isArtist: true },
    { key: "Title", label: "Álbum", isTrack: true },
  ],
  Deezer_Top_Mexico: [
    { key: "Artist", label: "Artista", isArtist: true },
    { key: "Title", label: "Canción", isTrack: true },
    { key: "Track Link", label: "Ver", isLink: true },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function firstArtist(credit: string): string {
  return (
    credit
      .split(/,|&|\/|\s+feat\.?\s+|\s+ft\.?\s+|\s+x\s+|\s+and\s+|\s+y\s+/gi)[0]
      ?.trim() ?? credit
  );
}

function fmtMetric(val: string): string {
  const n = parseInt((val ?? "").replace(/,/g, ""), 10);
  if (isNaN(n)) return val || "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function ytThumb(url: string): string | null {
  const m = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

// ── Movement badge ────────────────────────────────────────────────────────────

function MovementBadge({ row }: { row: Row }) {
  const rank = rankOf(row);
  const prev = prevOf(row);
  const mov = movOf(row);

  let gained = 0;
  if (mov === "NEW") {
    return (
      <View style={movStyles.newBadge}>
        <Text style={movStyles.newText}>NEW</Text>
      </View>
    );
  }
  if (prev && rank) {
    gained = parseInt(prev, 10) - parseInt(rank, 10);
  } else if (mov) {
    gained = parseInt(mov, 10) || 0;
  }

  if (gained === 0) return <Text style={movStyles.flat}>—</Text>;
  if (gained > 0)
    return (
      <View style={movStyles.upRow}>
        <Feather name="arrow-up" size={8} color={NEON} />
        <Text style={[movStyles.num, { color: NEON }]}>{gained}</Text>
      </View>
    );
  return (
    <View style={movStyles.downRow}>
      <Feather name="arrow-down" size={8} color="#EF4444" />
      <Text style={[movStyles.num, { color: "#EF4444" }]}>{Math.abs(gained)}</Text>
    </View>
  );
}

const movStyles = StyleSheet.create({
  newBadge: {
    backgroundColor: `${NEON}22`,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  newText: { color: NEON, fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 1 },
  flat: { color: "#3F3F46", fontFamily: "Inter_400Regular", fontSize: 9 },
  upRow: { flexDirection: "row", alignItems: "center", gap: 1 },
  downRow: { flexDirection: "row", alignItems: "center", gap: 1 },
  num: { fontFamily: "Inter_700Bold", fontSize: 9 },
});

// ── Chart row ─────────────────────────────────────────────────────────────────

function ChartRow({
  row,
  index,
  cols,
  activeSheet,
  artistImg,
  platformColor,
}: {
  row: Row;
  index: number;
  cols: ColDef[];
  activeSheet: SheetName;
  artistImg: string | null;
  platformColor: string;
}) {
  const rank = rankOf(row) || String(index + 1);
  const isTop3 = parseInt(rank, 10) <= 3;
  const artistCol = cols.find((c) => c.isArtist);
  const trackCol = cols.find((c) => c.isTrack);
  const metricCol = cols.find((c) => c.isMetric);
  const linkCol = cols.find((c) => c.isLink);

  const artistName = artistCol ? firstArtist(row[artistCol.key] ?? "") : "";
  const trackName = trackCol ? row[trackCol.key] ?? "" : "";
  const metricVal = metricCol ? fmtMetric(row[metricCol.key] ?? "") : "";
  const linkUrl = linkCol ? row[linkCol.key] ?? "" : "";
  const mexican = isMexican(row);

  const isYtSource =
    activeSheet === "YT_Songs_Weekly" ||
    activeSheet === "YT_Videos_Daily" ||
    activeSheet === "YT_Shorts_Daily";

  let thumbUrl: string | null = artistImg;
  if (isYtSource && linkUrl) {
    thumbUrl = ytThumb(linkUrl);
  }

  const openLink = () => {
    if (linkUrl) Linking.openURL(linkUrl);
  };

  return (
    <TouchableOpacity
      style={[
        styles.chartRow,
        index === 0
          ? { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" }
          : null,
      ]}
      activeOpacity={linkUrl ? 0.7 : 0.9}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (linkUrl) {
          openLink();
        } else if (artistName) {
          router.push({ pathname: "/artist/[name]", params: { name: artistName } });
        }
      }}
    >
      {/* Rank */}
      <View style={styles.rankCol}>
        <Text
          style={[
            styles.rankNum,
            { color: isTop3 ? platformColor : "#52525B" },
          ]}
        >
          {rank}
        </Text>
        <MovementBadge row={row} />
      </View>

      {/* Thumbnail */}
      {thumbUrl ? (
        <Image
          source={{ uri: thumbUrl }}
          style={[
            styles.thumb,
            isYtSource ? styles.thumbRect : styles.thumbRound,
          ]}
        />
      ) : (
        <View
          style={[
            styles.thumbPlaceholder,
            isYtSource ? styles.thumbRect : styles.thumbRound,
            { borderColor: `${platformColor}44` },
          ]}
        >
          <Text
            style={{
              color: platformColor,
              fontFamily: "Inter_700Bold",
              fontSize: 14,
            }}
          >
            {artistName.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      {/* Info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Text style={styles.artistName} numberOfLines={1}>
            {artistName}
          </Text>
          {mexican && (
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 2.5,
                backgroundColor: NEON,
              }}
            />
          )}
        </View>
        {trackName ? (
          <Text style={styles.trackName} numberOfLines={1}>
            {trackName}
          </Text>
        ) : null}
      </View>

      {/* Metric or link */}
      {metricVal ? (
        <Text
          style={[
            styles.metric,
            isTop3 ? { color: platformColor } : { color: "#A1A1AA" },
          ]}
        >
          {metricVal}
        </Text>
      ) : linkUrl ? (
        <Feather name="external-link" size={14} color="#52525B" />
      ) : (
        <Feather name="chevron-right" size={14} color="#3F3F46" />
      )}
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ChartsScreen() {
  const insets = useSafeAreaInsets();
  const [activePlatformId, setActivePlatformId] = useState("YouTube");
  const [activeSheetId, setActiveSheetId] = useState<SheetName>("YT_Songs_Weekly");
  const [filterMex, setFilterMex] = useState(false);

  const { data, isLoading, hasError } = useChartsHub();

  const platform = PLATFORMS.find((p) => p.id === activePlatformId) ?? PLATFORMS[0];

  const rows = useMemo<Row[]>(() => {
    const sheet = data?.sheets?.[activeSheetId];
    if (!sheet) return [];
    return filterMex ? sheet.rows.filter(isMexican) : sheet.rows;
  }, [data, activeSheetId, filterMex]);

  const cols = COLS[activeSheetId] ?? [];

  // Artist names for images
  const artistCol = cols.find((c) => c.isArtist);
  const artistNames = useMemo(() => {
    if (!artistCol) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of rows.slice(0, 50)) {
      const name = firstArtist(row[artistCol.key] ?? "");
      if (name && !seen.has(name)) { seen.add(name); out.push(name); }
    }
    return out;
  }, [rows, artistCol, activeSheetId]);

  const imageMap = useArtistImages(artistNames);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 84 : 0;

  function switchPlatform(pid: string) {
    const p = PLATFORMS.find((x) => x.id === pid)!;
    setActivePlatformId(pid);
    setActiveSheetId(p.charts[0].id);
    setFilterMex(false);
    Haptics.selectionAsync();
  }

  function switchSheet(sid: SheetName) {
    setActiveSheetId(sid);
    setFilterMex(false);
    Haptics.selectionAsync();
  }

  const updatedFmt = useMemo(() => {
    if (!data?.lastUpdated) return null;
    return new Date(data.lastUpdated).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [data]);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
          {"CHARTS "}
          <Text style={{ color: "#39FF14" }}>MÉXICO</Text>
        </Text>
          {updatedFmt ? (
            <Text style={styles.headerSub}>Actualizado {updatedFmt}</Text>
          ) : (
            <Text style={styles.headerSub}>
              {isLoading ? "CARGANDO…" : hasError ? "ERROR" : "CHARTS MÉXICO"}
            </Text>
          )}
        </View>
        {/* Mexican filter toggle */}
        <TouchableOpacity
          style={[styles.mexToggle, filterMex ? styles.mexToggleActive : null]}
          onPress={() => { Haptics.selectionAsync(); setFilterMex(!filterMex); }}
        >
          <Text style={[styles.mexToggleText, filterMex ? styles.mexToggleTextActive : null]}>
            🇲🇽 Solo MX
          </Text>
        </TouchableOpacity>
      </View>

      {/* Platform tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.platformTabScroll}
        contentContainerStyle={styles.platformTabContent}
      >
        {PLATFORMS.map((p) => {
          const active = activePlatformId === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.platformTab,
                active ? { backgroundColor: p.color, borderColor: p.color } : null,
              ]}
              onPress={() => switchPlatform(p.id)}
            >
              <Text
                style={[
                  styles.platformTabText,
                  active ? { color: "#000" } : { color: "#71717A" },
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Chart type sub-tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chartTabScroll}
        contentContainerStyle={styles.chartTabContent}
      >
        {platform.charts.map((c) => {
          const active = activeSheetId === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.chartTab,
                active
                  ? { borderBottomWidth: 2, borderBottomColor: platform.color }
                  : null,
              ]}
              onPress={() => switchSheet(c.id)}
            >
              <Text
                style={[
                  styles.chartTabText,
                  active ? { color: "#FFFFFF" } : { color: "#52525B" },
                ]}
              >
                {c.label}
              </Text>
              {c.period ? (
                <Text
                  style={[
                    styles.chartTabPeriod,
                    active
                      ? { color: platform.color }
                      : { color: "rgba(255,255,255,0.2)" },
                  ]}
                >
                  {c.period}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Rows */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Feather name="loader" size={24} color="#52525B" />
          <Text style={styles.statusText}>Cargando datos…</Text>
        </View>
      ) : hasError ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Feather name="wifi-off" size={24} color="#3F3F46" />
          <Text style={styles.statusText}>Error de conexión</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Feather name="bar-chart-2" size={24} color="#3F3F46" />
          <Text style={styles.statusText}>Sin datos disponibles</Text>
        </View>
      ) : (
        <FlatList
          data={rows.slice(0, 100)}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index }) => {
            const artistName = artistCol
              ? firstArtist(item[artistCol.key] ?? "")
              : "";
            return (
              <ChartRow
                row={item}
                index={index}
                cols={cols}
                activeSheet={activeSheetId}
                artistImg={imageMap[artistName] ?? null}
                platformColor={platform.color}
              />
            );
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomInset + 20 }}
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
    fontFamily: "Anton_400Regular",
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -0.5,
  },
  headerSub: {
    color: "#52525B",
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 2,
    textTransform: "uppercase",
  },
  mexToggle: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#111111",
  },
  mexToggleActive: { backgroundColor: `${NEON}18`, borderColor: `${NEON}55` },
  mexToggleText: {
    color: "#71717A",
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  mexToggleTextActive: { color: NEON },
  platformTabScroll: {
    maxHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  platformTabContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexDirection: "row",
  },
  platformTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  platformTabText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  chartTabScroll: {
    maxHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  chartTabContent: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  chartTab: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  chartTabText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.3,
  },
  chartTabPeriod: {
    fontFamily: "Inter_700Bold",
    fontSize: 8,
    letterSpacing: 1,
    marginTop: 1,
    textTransform: "uppercase",
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  rankCol: { width: 36, alignItems: "center", gap: 2 },
  rankNum: { fontFamily: "Inter_700Bold", fontSize: 13, letterSpacing: -0.5 },
  thumb: { backgroundColor: "#1A1A1A" },
  thumbRound: { width: 40, height: 40, borderRadius: 20 },
  thumbRect: { width: 56, height: 40, borderRadius: 4 },
  thumbPlaceholder: {
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  artistName: {
    color: "#E4E4E7",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  trackName: {
    color: "#71717A",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 2,
  },
  metric: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    minWidth: 44,
    textAlign: "right",
  },
  statusText: {
    color: "#3F3F46",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 12,
    letterSpacing: 0.5,
  },
});
