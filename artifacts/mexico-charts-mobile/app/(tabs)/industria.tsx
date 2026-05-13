import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

const SCREEN_WIDTH = Dimensions.get("window").width;

const NEON = "#39FF14";
const BG = "#050505";

const STATS = [
  { icon: "award",       value: "#10",     label: "Mercado global\nmúsica grabada", src: "IFPI 2026",  hi: true  },
  { icon: "trending-up", value: "+13.3%",  label: "Crecimiento de\ningresos · 2025", src: "IFPI",      hi: false },
  { icon: "arrow-up",    value: "#15 al #10", label: "Avance global\n2022–2024",    src: "AMPROFON",   hi: false },
  { icon: "calendar",    value: "10 años", label: "Crecimiento\nsostenido",        src: "AMPROFON",   hi: false },
  { icon: "layers",      value: "2×",      label: "Ingresos dup.\nen cinco años",  src: "AMPROFON",   hi: false },
];

const MILESTONES = [
  { year: "2014", text: "México inicia racha de crecimiento sostenido" },
  { year: "2018", text: "Corridos Tumbados emerge como fenómeno global" },
  { year: "2022", text: "México alcanza el #15 en el ranking IFPI" },
  { year: "2024", text: "México entra al Top 10 por primera vez" },
  { year: "2025", text: "+13.3% de crecimiento · décimo año consecutivo" },
];

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

function StatCard({ icon, value, label, hi }: {
  icon: string; value: string; label: string; hi: boolean;
}) {
  return (
    <View style={[styles.statCard, hi && styles.statCardHi]}>
      {hi && (
        <View style={styles.statCardGlow} />
      )}
      <Feather name={icon as FeatherIconName} size={14} color={hi ? NEON : "#52525B"} style={{ marginBottom: 10 }} />
      <Text
        style={[styles.statValue, hi && { color: NEON, textShadowColor: `${NEON}60`, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SourceCard({ title, url, subtitle }: { title: string; url: string; subtitle: string }) {
  return (
    <TouchableOpacity
      style={styles.sourceCard}
      activeOpacity={0.75}
      onPress={() => Linking.openURL(url)}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.sourceTitle}>{title}</Text>
        <Text style={styles.sourceSub}>{subtitle}</Text>
      </View>
      <Feather name="external-link" size={14} color={NEON} />
    </TouchableOpacity>
  );
}

export default function IndustriaScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 84 : 0;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
      >
        {/* ── HERO ── */}
        <View style={styles.hero}>
          {/* Glow blob */}
          <View style={styles.heroGlow} />

          <View style={styles.heroInner}>
            <Text style={styles.heroEyebrow}>INDUSTRIA / MERCADO</Text>
            <Text style={styles.heroHeadline}>México ya es</Text>
            <Text style={[styles.heroTop10, { color: NEON }]}>TOP 10</Text>
            <Text style={styles.heroHeadline}>global en música grabada</Text>
            <Text style={styles.heroSub}>
              México pasó del{" "}
              <Text style={{ color: "#fff", fontFamily: "Inter_700Bold" }}>#15 al #10</Text>
              {" "}en el ranking global de la IFPI, con un crecimiento del{" "}
              <Text style={{ color: NEON, fontFamily: "Inter_700Bold" }}>13.3%</Text>
              {" "}en 2025. Décimo año consecutivo de expansión.
            </Text>

            {/* Hero badge */}
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeLabel}>RANKING GLOBAL</Text>
              <Text style={[styles.heroBadgeValue, { color: NEON }]}>#10</Text>
              <Text style={styles.heroBadgeYear}>MÉXICO · 2024</Text>
            </View>
          </View>
        </View>

        {/* ── STAT GRID ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="bar-chart-2" size={13} color={NEON} />
            <Text style={styles.sectionLabel}>CIFRAS CLAVE</Text>
            <View style={styles.sectionLine} />
          </View>

          {/* Stats 2-column grid */}
          <View style={styles.statsGrid}>
            {STATS.map((s) => (
              <StatCard key={s.value} icon={s.icon} value={s.value} label={s.label} hi={s.hi} />
            ))}
          </View>
        </View>

        {/* ── TIMELINE ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="clock" size={13} color={NEON} />
            <Text style={styles.sectionLabel}>HITOS DEL MERCADO</Text>
            <View style={styles.sectionLine} />
          </View>

          <View style={styles.timeline}>
            {MILESTONES.map((m, i) => (
              <View key={m.year} style={styles.milestoneRow}>
                {/* Line + dot */}
                <View style={styles.milestoneLeft}>
                  <View style={[styles.milestoneDot, i === MILESTONES.length - 1 && { backgroundColor: NEON }]} />
                  {i < MILESTONES.length - 1 && <View style={styles.milestoneLine} />}
                </View>
                <View style={styles.milestoneContent}>
                  <Text style={[styles.milestoneYear, i === MILESTONES.length - 1 && { color: NEON }]}>
                    {m.year}
                  </Text>
                  <Text style={styles.milestoneText}>{m.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── SOURCES ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="link" size={13} color={NEON} />
            <Text style={styles.sectionLabel}>FUENTES OFICIALES</Text>
            <View style={styles.sectionLine} />
          </View>
          <View style={{ gap: 10 }}>
            <SourceCard
              title="IFPI Global Music Report 2026"
              subtitle="International Federation of the Phonographic Industry"
              url="https://www.ifpi.org/wp-content/uploads/2026/03/GMR2026_SOTI.pdf"
            />
            <SourceCard
              title="AMPROFON Reporte Música México"
              subtitle="Asociación Mexicana de Productores de Fonogramas"
              url="https://amprofon.com.mx/es/media/pdfs/Reporte_Musica_Mexico_(1).pdf"
            />
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  /* Hero */
  hero: {
    position: "relative",
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(57,255,20,0.08)",
  },
  heroGlow: {
    position: "absolute",
    left: -60, top: -40,
    width: 260, height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(57,255,20,0.065)",
  },
  heroInner: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 28, position: "relative", zIndex: 1 },
  heroEyebrow: {
    color: NEON, fontFamily: "Inter_700Bold",
    fontSize: 9, letterSpacing: 3, marginBottom: 14,
  },
  heroHeadline: {
    color: "#FFFFFF", fontFamily: "Anton_400Regular",
    fontSize: 32, lineHeight: 40,
  },
  heroTop10: {
    fontFamily: "Anton_400Regular",
    fontSize: 68, lineHeight: 78, marginVertical: 2,
  },
  heroSub: {
    color: "rgba(255,255,255,0.55)", fontFamily: "Inter_400Regular",
    fontSize: 13, lineHeight: 20, marginTop: 14, marginBottom: 20,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(57,255,20,0.06)",
    borderWidth: 1, borderColor: "rgba(57,255,20,0.25)",
    borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12,
    alignItems: "center",
  },
  heroBadgeLabel: {
    color: "rgba(255,255,255,0.4)", fontFamily: "Inter_700Bold",
    fontSize: 8, letterSpacing: 2.5, marginBottom: 4,
  },
  heroBadgeValue: {
    fontFamily: "Anton_400Regular", fontSize: 40, letterSpacing: -1, lineHeight: 44,
  },
  heroBadgeYear: {
    color: "rgba(255,255,255,0.55)", fontFamily: "Inter_700Bold",
    fontSize: 10, letterSpacing: 2, marginTop: 4,
  },

  /* Sections */
  section: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 4 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14,
  },
  sectionLabel: {
    color: "#52525B", fontFamily: "Inter_700Bold",
    fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase",
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.05)" },

  /* Stats */
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: (SCREEN_WIDTH - 32 - 10) / 2,
    backgroundColor: "#111111",
    borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    position: "relative", overflow: "hidden",
  },
  statCardHi: {
    borderColor: "rgba(57,255,20,0.25)",
    backgroundColor: "rgba(57,255,20,0.04)",
  },
  statCardGlow: {
    position: "absolute", top: -20, left: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "rgba(57,255,20,0.08)",
  },
  statValue: {
    color: "#FFFFFF", fontFamily: "Anton_400Regular",
    fontSize: 24, letterSpacing: -0.5, marginBottom: 6, lineHeight: 28,
  },
  statLabel: {
    color: "#52525B", fontFamily: "Inter_400Regular",
    fontSize: 12, lineHeight: 17,
  },

  /* Timeline */
  timeline: { paddingLeft: 4, marginBottom: 8 },
  milestoneRow: { flexDirection: "row", gap: 14, minHeight: 52 },
  milestoneLeft: { alignItems: "center", width: 16 },
  milestoneDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: "#3F3F46",
    marginTop: 4,
  },
  milestoneLine: { flex: 1, width: 1, backgroundColor: "rgba(255,255,255,0.07)", marginTop: 4 },
  milestoneContent: { flex: 1, paddingBottom: 18 },
  milestoneYear: {
    color: "#71717A", fontFamily: "Inter_700Bold",
    fontSize: 11, letterSpacing: 1.5, marginBottom: 3,
  },
  milestoneText: {
    color: "#A1A1AA", fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19,
  },

  /* Sources */
  sourceCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#111111",
    borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    gap: 12,
  },
  sourceTitle: {
    color: "#E4E4E7", fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 3,
  },
  sourceSub: {
    color: "#52525B", fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16,
  },
});
