import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Inicio</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="artistas">
        <Icon sf={{ default: "person.2", selected: "person.2.fill" }} />
        <Label>Artistas</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="charts">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>Charts</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="generos">
        <Icon sf={{ default: "music.note.list", selected: "music.note.list" }} />
        <Label>Géneros</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="touring">
        <Icon sf={{ default: "mappin.circle", selected: "mappin.circle.fill" }} />
        <Label>Touring</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="industria">
        <Icon sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis" }} />
        <Label>Industria</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="certificaciones">
        <Icon sf={{ default: "medal", selected: "medal.fill" }} />
        <Label>Certs</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#39FF14",
        tabBarInactiveTintColor: "#52525B",
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 9,
          letterSpacing: 0.5,
        },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : "#0A0A0A",
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.07)",
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: "#0A0A0A" },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house.fill" tintColor={color} size={20} />
            ) : (
              <Feather name="home" size={20} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="artistas"
        options={{
          title: "Artistas",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.2.fill" tintColor={color} size={20} />
            ) : (
              <Feather name="users" size={20} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="charts"
        options={{
          title: "Charts",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.bar.fill" tintColor={color} size={20} />
            ) : (
              <Feather name="bar-chart-2" size={20} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="generos"
        options={{
          title: "Géneros",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="music.note.list" tintColor={color} size={20} />
            ) : (
              <Feather name="music" size={20} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="touring"
        options={{
          title: "Touring",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="mappin.circle.fill" tintColor={color} size={20} />
            ) : (
              <Feather name="map-pin" size={20} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="industria"
        options={{
          title: "Industria",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.line.uptrend.xyaxis" tintColor={color} size={20} />
            ) : (
              <Feather name="trending-up" size={20} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="certificaciones"
        options={{
          title: "Certs",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="medal.fill" tintColor={color} size={20} />
            ) : (
              <Feather name="award" size={20} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
