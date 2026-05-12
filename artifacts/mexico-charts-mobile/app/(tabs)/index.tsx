import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
  Dimensions,
  FlatList,
  Animated,
  Easing,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useArtistImages } from "@/hooks/useArtistImages";
import { useHubData, HubRow, TickerItem } from "@/hooks/useHubData";
import { TOP_ARTISTS, GENRES, Artist } from "@/data/chartData";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const NEON = "#39FF14";
const BG = "#050505";

// ── Merge live hub row with static fallback ──────────────────────────────────

function buildArtist(row: HubRow): Artist {
  const st = TOP_ARTISTS.find(
    (a) => a.name.toLowerCase() === row.Artist.toLowerCase()
  );
  const gained = row.Prev > 0 && row.Rank > 0 ? row.Prev - row.Rank : 0;
  const growthStr =
    gained > 0 ? `+${gained} pos` : gained < 0 ? `${gained} pos` : "=";
  return {
    rank: row.Rank,
    name: row.Artist,
    genre: st?.genre ?? "Regional Mexicano",
    streams: st?.streams ?? "—",
    listeners: st?.listeners ?? "—",
    growth: st?.growth ?? (gained !== 0 ? growthStr : "="),
    countries: st?.countries ?? "—",
    tag: st?.tag ?? "REGIONAL MEXICANO",
    accent: st?.accent ?? NEON,
    tour: st?.tour,
    tourDates: st?.tourDates,
    tourGross: st?.tourGross,
  };
}

// ── Live animated ticker ─────────────────────────────────────────────────────

function LiveTicker({ items }: { items: TickerItem[] }) {
  const fallback: TickerItem[] = [
    { name: "MEXICO CHARTS", display: "TOP ARTISTAS" },
    { name: "SPOTIFY", display: "EN VIVO" },
    { name: "APPLE MUSIC", display: "CHARTS" },
  ];
  const source = items.length > 0 ? items : fallback;

  // Interleave name · display · name · display …
  const tickerString =
    source
      .flatMap((t) => [t.name.toUpperCase(), t.display])
      .join("  ·  ") + "  ·  ";

  const translateX = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (textWidth <= 0) return;
    if (animRef.current) animRef.current.stop();
    translateX.setValue(0);
    animRef.current = Animated.loop(
      Animated.timing(translateX, {
        toValue: -textWidth,
        duration: textWidth * 22,
        useNativeDriver: false,
        easing: Easing.linear,
      })
    );
    animRef.current.start();
    return () => {
      animRef.current?.stop();
    };
  }, [textWidth, tickerString]);

  return (
    <View style={styles.tickerOuter}>
      <Animated.View
        style={[styles.tickerInner, { transform: [{ translateX }] }]}
      >
        <Text
          style={styles.tickerText}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width / 2;
            if (w > 0 && textWidth === 0) setTextWidth(w);
          }}
          numberOfLines={1}
        >
          {tickerString}
          {tickerString}
        </Text>
      </Animated.View>
    </View>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function InitialAvatar({
  initial,
  size,
  accent,
  fontSize,
}: {
  initial: string;
  size: number;
  accent?: string;
  fontSize?: number;
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
        borderColor: accent ?? "rgba(255,255,255,0.15)",
      }}
    >
      <Text
        style={{
          color: accent ?? "#E4E4E7",
          fontFamily: "Inter_700Bold",
          fontSize: fontSize ?? size * 0.4,
        }}
      >
        {initial.toUpperCase()}
      </Text>
    </View>
  );
}

function HeroArtistCard({
  artist,
  photo,
}: {
  artist: Artist;
  photo: string | null;
}) {
  return (
    <View style={[styles.heroCard, { width: SCREEN_WIDTH }]}>
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={styles.heroPhoto}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.heroPhotoPlaceholder}>
          <Text
            style={{
              color: "rgba(255,255,255,0.06)",
              fontFamily: "Inter_700Bold",
              fontSize: 180,
              lineHeight: 190,
            }}
          >
            {artist.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.heroOverlay} />
      <View style={styles.heroGradientLeft} />
      <View style={styles.heroGradientBottom} />
      <View style={styles.heroContent}>
        <Text style={styles.heroRankTag}>
          #{artist.rank} EN MÉXICO  ·  {artist.tag}
        </Text>
        <Text style={styles.heroName} numberOfLines={1}>
          {artist.name.toUpperCase()}
        </Text>
        <Text style={styles.heroStats}>
          {artist.listeners} OYENTES{"  "}
          <Text style={{ color: NEON }}>{artist.growth} esta semana</Text>
        </Text>
        <View style={styles.heroButtons}>
          <TouchableOpacity
            style={styles.heroPrimaryBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({
                pathname: "/artist/[name]",
                params: { name: artist.name },
              });
            }}
          >
            <Text style={styles.heroPrimaryBtnText}>Ver Perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.heroSecondaryBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/charts");
            }}
          >
            <Text style={styles.heroSecondaryBtnText}>Ver Charts</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function Top10Card({
  artist,
  photo,
}: {
  artist: Artist;
  photo: string | null;
}) {
  return (
    <TouchableOpacity
      style={styles.top10Card}
      activeOpacity={0.75}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
          pathname: "/artist/[name]",
          params: { name: artist.name },
        });
      }}
    >
      <View style={[styles.top10RankBadge, { borderColor: artist.accent }]}>
        <Text style={[styles.top10Rank, { color: artist.accent }]}>
          {artist.rank}
        </Text>
      </View>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.top10Photo} />
      ) : (
        <InitialAvatar
          initial={artist.name.charAt(0)}
          size={80}
          accent={artist.accent}
          fontSize={30}
        />
      )}
      <Text style={styles.top10Name} numberOfLines={1}>
        {artist.name}
      </Text>
      <Text style={styles.top10Genre} numberOfLines={1}>
        {artist.genre}
      </Text>
      <Text style={[styles.top10Streams, { color: artist.accent }]}>
        {artist.streams}
      </Text>
    </TouchableOpacity>
  );
}

function GenreCard({ genre }: { genre: (typeof GENRES)[0] }) {
  return (
    <View
      style={[
        styles.genreCard,
        { borderLeftColor: genre.accent, borderLeftWidth: 3 },
      ]}
    >
      <Text style={styles.genreName} numberOfLines={1}>
        {genre.name}
      </Text>
      <View style={styles.genreStats}>
        <Text style={[styles.genreStreams, { color: genre.accent }]}>
          {genre.streams}
        </Text>
        <Text style={styles.genreArtists}>{genre.artists} artistas</Text>
      </View>
    </View>
  );
}

function AscensoRow({
  item,
  photo,
}: {
  item: { name: string; growth: string; bar: number; accent: string };
  photo: string | null;
}) {
  const barFillStyle: ViewStyle = {
    height: 4,
    borderRadius: 2,
    width: `${item.bar}%`,
    backgroundColor: item.accent,
  };
  return (
    <View style={styles.ascensoRow}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.ascensoAvatar} />
      ) : (
        <InitialAvatar
          initial={item.name.charAt(0)}
          size={36}
          accent={item.accent}
          fontSize={14}
        />
      )}
      <Text style={styles.ascensoName} numberOfLines={1}>
        {item.name}
      </Text>
      <View style={styles.ascensoBarBg}>
        <View style={barFillStyle} />
      </View>
      <Text style={[styles.ascensoGrowth, { color: item.accent }]}>
        {item.growth}
      </Text>
    </View>
  );
}

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

function SectionHeader({
  icon,
  label,
  live,
}: {
  icon: FeatherIconName;
  label: string;
  live?: boolean;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Feather name={icon} size={14} color={NEON} />
      <Text style={styles.sectionLabel}>{label}</Text>
      {live && (
        <View style={styles.livePill}>
          <Text style={styles.livePillText}>EN VIVO</Text>
        </View>
      )}
      <View style={styles.sectionLine} />
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [heroIndex, setHeroIndex] = useState(0);
  const heroScrollRef = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { mexicanRows, ascensoItems, tickerItems, rows } = useHubData();

  // Top artists: prefer live Mexican chart; fall back to static
  const liveArtists = useMemo<Artist[]>(() => {
    if (mexicanRows.length === 0) return TOP_ARTISTS.slice(0, 10);
    return mexicanRows.slice(0, 10).map(buildArtist);
  }, [mexicanRows]);

  const heroArtists = useMemo(() => liveArtists.slice(0, 5), [liveArtists]);

  // EN ASCENSO from hook (already computed)
  const ascenso = ascensoItems.length >= 3 ? ascensoItems : null;

  const allNames = useMemo(
    () => [
      ...liveArtists.map((a) => a.name),
      ...(ascenso ?? []).map((a) => a.name),
    ],
    [liveArtists, ascenso]
  );

  const imageMap = useArtistImages(allNames);

  useEffect(() => {
    if (heroArtists.length === 0) return;
    timerRef.current = setInterval(() => {
      setHeroIndex((i) => {
        const next = (i + 1) % heroArtists.length;
        heroScrollRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [heroArtists.length]);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 84 : 0;

  const isLive = rows.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomInset + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Live animated ticker */}
        <View style={{ paddingTop: topInset, backgroundColor: NEON }}>
          <LiveTicker items={tickerItems} />
        </View>

        {/* Hero carousel */}
        <FlatList
          ref={heroScrollRef}
          data={heroArtists}
          renderItem={({ item }) => (
            <HeroArtistCard
              artist={item}
              photo={imageMap[item.name] ?? null}
            />
          )}
          keyExtractor={(item) => item.name}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled
          onMomentumScrollEnd={(e) => {
            const index = Math.round(
              e.nativeEvent.contentOffset.x / SCREEN_WIDTH
            );
            setHeroIndex(index);
          }}
          style={{ height: 460 }}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />

        {/* Hero dot indicators */}
        <View style={styles.heroDots}>
          {heroArtists.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => {
                heroScrollRef.current?.scrollToIndex({
                  index: i,
                  animated: true,
                });
                setHeroIndex(i);
              }}
            >
              <View
                style={[
                  styles.heroDot,
                  i === heroIndex ? styles.heroDotActive : null,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Top 10 Mexican artists */}
        <View style={{ marginTop: 8 }}>
          <SectionHeader
            icon="trending-up"
            label="TOP 10 · MÉXICO · ESTA SEMANA"
            live={isLive}
          />
          <FlatList
            data={liveArtists}
            renderItem={({ item }) => (
              <Top10Card artist={item} photo={imageMap[item.name] ?? null} />
            )}
            keyExtractor={(item) => item.name}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            scrollEnabled
          />
        </View>

        {/* Genres — static editorial */}
        <View style={{ marginTop: 20 }}>
          <SectionHeader icon="music" label="GÉNEROS · STREAMS TOTALES" />
          <View style={styles.genreGrid}>
            {GENRES.map((g) => (
              <GenreCard key={g.name} genre={g} />
            ))}
          </View>
        </View>

        {/* EN ASCENSO — live computed */}
        {ascenso && (
          <View style={{ marginTop: 20 }}>
            <SectionHeader
              icon="arrow-up-right"
              label="EN ASCENSO · ARTISTAS MEXICANOS"
              live
            />
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {ascenso.map((a) => (
                <AscensoRow
                  key={a.name}
                  item={a}
                  photo={imageMap[a.name] ?? null}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tickerOuter: {
    overflow: "hidden",
    height: 30,
    justifyContent: "center",
  },
  tickerInner: {
    flexDirection: "row",
  },
  tickerText: {
    color: "#000000",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    lineHeight: 30,
  },
  heroCard: {
    height: 460,
    position: "relative",
    backgroundColor: "#050505",
    overflow: "hidden",
  },
  heroPhoto: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.75,
  },
  heroPhotoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0D0D0D",
    alignItems: "center",
    justifyContent: "center",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,5,5,0.28)",
  },
  heroGradientLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "72%",
    backgroundColor: "rgba(5,5,5,0.80)",
  },
  heroGradientBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 230,
    backgroundColor: "rgba(5,5,5,0.94)",
  },
  heroContent: {
    position: "absolute",
    left: 0,
    bottom: 0,
    right: 0,
    padding: 22,
    paddingBottom: 30,
  },
  heroRankTag: {
    color: NEON,
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroName: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.5,
    marginBottom: 10,
  },
  heroStats: {
    color: "rgba(255,255,255,0.52)",
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 20,
  },
  heroButtons: {
    flexDirection: "row",
    gap: 10,
  },
  heroPrimaryBtn: {
    backgroundColor: NEON,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 100,
  },
  heroPrimaryBtnText: {
    color: "#000000",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroSecondaryBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 100,
  },
  heroSecondaryBtnText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  heroDotActive: {
    width: 22,
    backgroundColor: NEON,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  sectionLabel: {
    color: "#52525B",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  livePill: {
    backgroundColor: "rgba(57,255,20,0.12)",
    borderWidth: 1,
    borderColor: "rgba(57,255,20,0.3)",
    borderRadius: 100,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  livePillText: {
    color: NEON,
    fontFamily: "Inter_700Bold",
    fontSize: 8,
    letterSpacing: 1.5,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  top10Card: {
    width: 130,
    backgroundColor: "#111111",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  top10RankBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  top10Rank: { fontFamily: "Inter_700Bold", fontSize: 10 },
  top10Photo: { width: 80, height: 80, borderRadius: 40, marginTop: 4 },
  top10Name: {
    color: "#E4E4E7",
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textAlign: "center",
  },
  top10Genre: {
    color: "#71717A",
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  top10Streams: { fontFamily: "Inter_700Bold", fontSize: 12 },
  genreGrid: { paddingHorizontal: 16, gap: 8 },
  genreCard: {
    backgroundColor: "#111111",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  genreName: {
    color: "#E4E4E7",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    flex: 1,
  },
  genreStats: { alignItems: "flex-end", gap: 2 },
  genreStreams: { fontFamily: "Inter_700Bold", fontSize: 14 },
  genreArtists: {
    color: "#71717A",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  ascensoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0D0D0D",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  ascensoAvatar: { width: 36, height: 36, borderRadius: 18 },
  ascensoName: {
    color: "#E4E4E7",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    flex: 1,
  },
  ascensoBarBg: {
    width: 60,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
    overflow: "hidden",
  },
  ascensoGrowth: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.3,
    minWidth: 72,
    textAlign: "right",
  },
});
