import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const NEON = "#39FF14";
const BG = "#080808";

const CERT_COLORS: Record<string, string> = {
  DIAMANTE: "#B9F2FF",
  PLATINO: "#C0C0C0",
  ORO: "#FFD700",
};

type CertRow = {
  artista: string;
  titulo: string;
  disquera: string;
  formato: string;
  certificacion: string;
  nivel: string;
  fechaISO: string;
  year: number;
  diamante: number;
  platino: number;
  oro: number;
  totalLevels: number;
};

type CertData = {
  rows: CertRow[];
  meta?: { total?: number; updated?: string };
};

const FILTER_CERTS = ["TODOS", "DIAMANTE", "PLATINO", "ORO"] as const;
type FilterCert = (typeof FILTER_CERTS)[number];

const PAGE_SIZE = 30;

function certTier(row: CertRow): string {
  if (row.diamante > 0) return "DIAMANTE";
  if (row.platino > 0) return "PLATINO";
  return "ORO";
}

function CertBadge({ cert }: { cert: string }) {
  const upper = cert.toUpperCase();
  const tier = upper.includes("DIAMANTE")
    ? "DIAMANTE"
    : upper.includes("PLATINO")
    ? "PLATINO"
    : "ORO";
  const color = CERT_COLORS[tier] ?? "#E4E4E7";
  const symbol = tier === "DIAMANTE" ? "◆" : tier === "PLATINO" ? "◆" : "◆";
  return (
    <View style={[styles.certBadge, { borderColor: `${color}40`, backgroundColor: `${color}10` }]}>
      <Text style={[styles.certBadgeText, { color }]}>{cert}</Text>
    </View>
  );
}

function CertRow({ row }: { row: CertRow }) {
  const tier = certTier(row);
  const color = CERT_COLORS[tier] ?? "#E4E4E7";
  const dateStr = row.fechaISO
    ? row.fechaISO.split("-").reverse().slice(0, 2).join("/")
    : "";

  return (
    <View style={styles.certRow}>
      <View style={[styles.certAccent, { backgroundColor: color }]} />
      <View style={styles.certInfo}>
        <Text style={styles.certTitulo} numberOfLines={1}>
          {row.titulo}
        </Text>
        <Text style={styles.certArtista} numberOfLines={1}>
          {row.artista}
        </Text>
        <Text style={styles.certMeta} numberOfLines={1}>
          {row.formato}
          {row.disquera ? `  ·  ${row.disquera}` : ""}
        </Text>
      </View>
      <View style={styles.certRight}>
        <CertBadge cert={row.certificacion} />
        {dateStr ? <Text style={styles.certDate}>{dateStr}</Text> : null}
      </View>
    </View>
  );
}

export default function CertificacionesScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCert, setFilterCert] = useState<FilterCert>("TODOS");
  const [page, setPage] = useState(1);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 84 : 0;

  useEffect(() => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) {
      setLoading(false);
      setError(true);
      return;
    }
    fetch(`https://${domain}/api/certifications`)
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((d: CertData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, filterCert]);

  const stats = useMemo(() => {
    if (!data) return null;
    const rows = data.rows;
    return {
      total: rows.length,
      diamante: rows.reduce((s, r) => s + r.diamante, 0),
      platino: rows.reduce((s, r) => s + r.platino, 0),
      oro: rows.reduce((s, r) => s + r.oro, 0),
    };
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = [...data.rows];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.artista.toLowerCase().includes(q) ||
          r.titulo.toLowerCase().includes(q)
      );
    }
    if (filterCert !== "TODOS") {
      rows = rows.filter((r) =>
        r.certificacion.toUpperCase().includes(filterCert)
      );
    }
    return rows;
  }, [data, search, filterCert]);

  const pageRows = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = pageRows.length < filtered.length;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            {"CERT "}
            <Text style={{ color: NEON }}>AMPROFON</Text>
          </Text>
          <Text style={styles.headerSub}>
            {loading
              ? "CARGANDO…"
              : error
              ? "ERROR DE CONEXIÓN"
              : `${data?.rows.length ?? 0} CERTIFICACIONES`}
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <Feather name="award" size={12} color={NEON} />
          <Text style={styles.headerBadgeText}>OFICIAL</Text>
        </View>
      </View>

      {/* Stat strip */}
      {stats && (
        <View style={styles.statStrip}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: CERT_COLORS.DIAMANTE }]}>
              {stats.diamante}
            </Text>
            <Text style={styles.statLabel}>Diamante</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: CERT_COLORS.PLATINO }]}>
              {stats.platino}
            </Text>
            <Text style={styles.statLabel}>Platino</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: CERT_COLORS.ORO }]}>
              {stats.oro}
            </Text>
            <Text style={styles.statLabel}>Oro</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: "#E4E4E7" }]}>
              {stats.total}
            </Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchRow}>
        <Feather name="search" size={15} color="#52525B" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar artista o título…"
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

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 46 }}
        contentContainerStyle={styles.filterContent}
      >
        {FILTER_CERTS.map((f) => {
          const active = filterCert === f;
          const color = f === "TODOS" ? NEON : (CERT_COLORS[f] ?? NEON);
          return (
            <TouchableOpacity
              key={f}
              style={[
                styles.pill,
                active && { backgroundColor: `${color}18`, borderColor: `${color}55` },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setFilterCert(f);
              }}
            >
              <Text
                style={[styles.pillText, active && { color }]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Count */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {loading ? "—" : `${filtered.length} resultados`}
        </Text>
        <Text style={styles.sortText}>RECIENTES PRIMERO</Text>
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={NEON} size="large" />
          <Text style={styles.statusText}>Cargando certificaciones…</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Feather name="wifi-off" size={32} color="#3F3F46" />
          <Text style={styles.statusText}>Error de conexión</Text>
        </View>
      ) : (
        <FlatList
          data={pageRows}
          keyExtractor={(item, i) => `${item.artista}-${item.titulo}-${i}`}
          renderItem={({ item }) => <CertRow row={item} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomInset + 20 }}
          onEndReached={() => {
            if (hasMore) setPage((p) => p + 1);
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={{ paddingTop: 60, alignItems: "center" }}>
              <Feather name="search" size={32} color="#3F3F46" />
              <Text style={[styles.statusText, { marginTop: 12 }]}>
                Sin resultados
              </Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => setPage((p) => p + 1)}
              >
                <Text style={styles.loadMoreText}>Cargar más</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontFamily: "Anton_400Regular",
    fontSize: 36,
    lineHeight: 46,
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

  statStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    backgroundColor: "#0D0D0D",
  },
  statItem: { alignItems: "center" },
  statNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    letterSpacing: -0.5,
  },
  statLabel: {
    color: "#52525B",
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 2,
    textTransform: "uppercase",
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.07)",
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
    paddingVertical: 8,
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
  pillText: {
    color: "#71717A",
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.2,
  },

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

  certRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
    paddingRight: 16,
    paddingVertical: 12,
    gap: 0,
  },
  certAccent: {
    width: 3,
    alignSelf: "stretch",
    marginRight: 14,
  },
  certInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  certTitulo: {
    color: "#E4E4E7",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  certArtista: {
    color: NEON,
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.3,
  },
  certMeta: {
    color: "#52525B",
    fontFamily: "Inter_400Regular",
    fontSize: 10,
  },
  certRight: {
    alignItems: "flex-end",
    gap: 4,
    marginLeft: 10,
  },
  certBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  certBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 1,
  },
  certDate: {
    color: "#3F3F46",
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    letterSpacing: 0.5,
  },

  statusText: {
    color: "#52525B",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    marginTop: 12,
  },

  loadMoreBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  loadMoreText: {
    color: "#71717A",
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
