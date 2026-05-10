import React, { useState, useEffect, useRef } from "react";
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
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useArtistImages } from "@/hooks/useArtistImages";
import { TOP_ARTISTS, GENRES, ASCENSO, Artist } from "@/data/chartData";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const HERO_ARTISTS = TOP_ARTISTS.slice(0, 5);
const TOP_10 = TOP_ARTISTS.slice(0, 10);

const HOME_NAMES = TOP_10.map((a) => a.name);

const NEON = "#39FF14";
const BG = "#050505";

function InitialAvatar({ initial, size, accent, fontSize }: { initial: string; size: number; accent?: string; fontSize?: number }) {
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
          letterSpacing: 0,
        }}
      >
        {initial.toUpperCase()}
      </Text>
    </View>
  );
}

function HeroArtistCard({ artist, photo }: { artist: Artist; photo: string | null }) {
  const initial = artist.name.charAt(0);
  return (
    <View style={[styles.heroCard, { width: SCREEN_WIDTH }]}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.heroPhoto} resizeMode="cover" />
      ) : (
        <View style={[styles.heroPhotoPlaceholder, { alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ color: "rgba(255,255,255,0.18)", fontFamily: "Inter_700Bold", fontSize: 120, lineHeight: 130 }}>
            {initial.toUpperCase()}
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
          {artist.listeners} OYENTES  ·  {artist.countries}
          {"  "}
          <Text style={{ color: NEON }}>{artist.growth} esta semana</Text>
        </Text>
        <View style={styles.heroButtons}>
          <TouchableOpacity
            style={styles.heroPrimaryBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({ pathname: "/artist/[name]", params: { name: artist.name } });
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

function Top10Card({ artist, photo }: { artist: Artist; photo: string | null }) {
  return (
    <TouchableOpacity
      style={styles.top10Card}
      activeOpacity={0.75}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/artist/[name]", params: { name: artist.name } });
      }}
    >
      <View style={[styles.top10RankBadge, { borderColor: artist.accent }]}>
        <Text style={[styles.top10Rank, { color: artist.accent }]}>{artist.rank}</Text>
      </View>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.top10Photo} />
      ) : (
        <InitialAvatar initial={artist.name.charAt(0)} size={80} accent={artist.accent} fontSize={30} />
      )}
      <Text style={styles.top10Name} numberOfLines={1}>{artist.name}</Text>
      <Text style={styles.top10Genre} numberOfLines={1}>{artist.genre}</Text>
      <Text style={[styles.top10Streams, { color: artist.accent }]}>{artist.streams}</Text>
    </TouchableOpacity>
  );
}

function GenreCard({ genre }: { genre: typeof GENRES[0] }) {
  return (
    <View style={[styles.genreCard, { borderLeftColor: genre.accent, borderLeftWidth: 3 }]}>
      <Text style={styles.genreName} numberOfLines={1}>{genre.name}</Text>
      <View style={styles.genreStats}>
        <Text style={[styles.genreStreams, { color: genre.accent }]}>{genre.streams}</Text>
        <Text style={styles.genreArtists}>{genre.artists} artistas</Text>
      </View>
    </View>
  );
}

function AscensoRow({ item }: { item: typeof ASCENSO[0] }) {
  const barFillStyle: ViewStyle = {
    height: 4,
    borderRadius: 2,
    width: `${item.bar}%`,
    backgroundColor: item.accent,
  };
  return (
    <View style={styles.ascensoRow}>
      <Text style={styles.ascensoName} numberOfLines={1}>{item.name}</Text>
      <View style={styles.ascensoBarBg}>
        <View style={barFillStyle} />
      </View>
      <Text style={[styles.ascensoGrowth, { color: item.accent }]}>{item.growth}</Text>
    </View>
  );
}

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

function SectionHeader({ icon, label }: { icon: FeatherIconName; label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Feather name={icon} size={14} color={NEON} />
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [heroIndex, setHeroIndex] = useState(0);
  const heroScrollRef = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const imageMap = useArtistImages(HOME_NAMES);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setHeroIndex((i) => {
        const next = (i + 1) % HERO_ARTISTS.length;
        heroScrollRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 84 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomInset + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Green ticker bar */}
        <View style={[styles.ticker, { paddingTop: topInset }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={styles.tickerText}>
              PESO PLUMA · 32.4M OYENTES · FUERZA REGIDA · 12.4M OYENTES · NATANAEL CANO · CORRIDOS TUMBADOS · JUNIOR H · CARIN LEÓN · 7.1M OYENTES ·{" "}
            </Text>
          </ScrollView>
        </View>

        {/* Hero carousel */}
        <FlatList
          ref={heroScrollRef}
          data={HERO_ARTISTS}
          renderItem={({ item }) => (
            <HeroArtistCard artist={item} photo={imageMap[item.name] ?? null} />
          )}
          keyExtractor={(item) => item.name}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setHeroIndex(index);
          }}
          style={{ height: 380 }}
          getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
        />

        {/* Hero dot indicators */}
        <View style={styles.heroDots}>
          {HERO_ARTISTS.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => {
                heroScrollRef.current?.scrollToIndex({ index: i, animated: true });
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

        {/* Top 10 horizontal scroll */}
        <View style={{ marginTop: 8 }}>
          <SectionHeader icon="trending-up" label="TOP 10 · MÉXICO · ESTA SEMANA" />
          <FlatList
            data={TOP_10}
            renderItem={({ item }) => (
              <Top10Card artist={item} photo={imageMap[item.name] ?? null} />
            )}
            keyExtractor={(item) => item.name}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            scrollEnabled={true}
          />
        </View>

        {/* Genre blocks */}
        <View style={{ marginTop: 20 }}>
          <SectionHeader icon="music" label="GÉNEROS · STREAMS TOTALES" />
          <View style={styles.genreGrid}>
            {GENRES.map((g) => (
              <GenreCard key={g.name} genre={g} />
            ))}
          </View>
        </View>

        {/* En ascenso */}
        <View style={{ marginTop: 20 }}>
          <SectionHeader icon="arrow-up-right" label="EN ASCENSO · ESTA SEMANA" />
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {ASCENSO.map((a) => (
              <AscensoRow key={a.name} item={a} />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ticker: {
    backgroundColor: "#39FF14",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tickerText: {
    color: "#000000",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  heroCard: {
    height: 380,
    position: "relative",
    backgroundColor: "#050505",
  },
  heroPhoto: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "60%",
  },
  heroPhotoPlaceholder: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "60%",
    backgroundColor: "#111",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,5,5,0.45)",
  },
  heroGradientLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "65%",
    backgroundColor: "rgba(5,5,5,0.72)",
  },
  heroGradientBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
    backgroundColor: "rgba(5,5,5,0.88)",
  },
  heroContent: {
    position: "absolute",
    left: 0,
    bottom: 0,
    right: 0,
    padding: 20,
    paddingBottom: 24,
    backgroundColor: "transparent",
  },
  heroRankTag: {
    color: "#39FF14",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroName: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  heroStats: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  heroButtons: {
    flexDirection: "row",
    gap: 10,
  },
  heroPrimaryBtn: {
    backgroundColor: "#39FF14",
    paddingHorizontal: 18,
    paddingVertical: 10,
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
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 18,
    paddingVertical: 10,
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
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  heroDotActive: {
    width: 20,
    backgroundColor: "#39FF14",
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
  top10Rank: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
  },
  top10Photo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginTop: 4,
  },
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
  },
  top10Streams: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  genreGrid: {
    paddingHorizontal: 16,
    gap: 8,
  },
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
  genreStats: {
    alignItems: "flex-end",
    gap: 2,
  },
  genreStreams: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  genreArtists: {
    color: "#71717A",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  ascensoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#111111",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  ascensoName: {
    color: "#E4E4E7",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    width: 130,
  },
  ascensoBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
    overflow: "hidden",
  },
  ascensoGrowth: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    width: 46,
    textAlign: "right",
  },
});
