import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFonts,
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_700Bold,
  Rubik_800ExtraBold,
} from '@expo-google-fonts/rubik';
import { SuezOne_400Regular } from '@expo-google-fonts/suez-one';
import SongsListScreen from './src/screens/SongsListScreen';
import SongScreen from './src/screens/SongScreen';
import YouTubeScreen from './src/screens/YouTubeScreen';
import VocabScreen from './src/screens/VocabScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import XpPopup from './src/components/XpPopup';
import { colors } from './src/theme';

// The Stack lets us move between screens (list -> song -> back).
const Stack = createNativeStackNavigator();

// A solid purple band exactly as tall as the safe-area top inset, painted
// behind the status bar on every screen — otherwise it shows through as
// the OS's default white/black instead of matching the app's theme.
function StatusBarBackground() {
  const insets = useSafeAreaInsets();
  if (insets.top <= 0) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.primary, zIndex: 100 }}
    />
  );
}

function App() {
  const [fontsLoaded] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_700Bold,
    Rubik_800ExtraBold,
    SuezOne_400Regular,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <NavigationContainer documentTitle={{ formatter: () => 'LyricsApp' }}>
          <StatusBar style="light" />
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="SongsList" component={SongsListScreen} />
            <Stack.Screen name="Song" component={SongScreen} />
            <Stack.Screen name="YouTube" component={YouTubeScreen} />
            <Stack.Screen name="Vocab" component={VocabScreen} />
            <Stack.Screen name="Progress" component={ProgressScreen} />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBarBackground />
        <XpPopup />
      </View>
    </SafeAreaProvider>
  );
}

// A wide window means this is a real desktop browser, not a phone's mobile
// browser (which is also Platform.OS === 'web' but has a narrow viewport).
const DESKTOP_BREAKPOINT = 700;
function isWideViewport(): boolean {
  try {
    return typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT;
  } catch {
    return false;
  }
}

function loadDesktopMode(): boolean {
  if (!isWideViewport()) return false; // always the phone-sized frame on narrow/mobile screens
  try {
    const v = window.localStorage?.getItem('lyricsapp:desktopMode');
    if (v != null) return v === '1';
  } catch {}
  return true; // default to the full desktop layout on a wide screen
}

// On the web preview we normally center the app inside a phone-sized frame,
// so it looks just like it will on a real phone. On a wide (desktop) browser
// window it defaults to filling the screen instead, with a toggle to switch
// back to the phone-sized frame if you want to preview that look.
export default function Root() {
  const [desktopMode, setDesktopMode] = useState(loadDesktopMode);
  const [wide] = useState(isWideViewport);

  if (Platform.OS === 'web') {
    function toggle() {
      setDesktopMode((d) => {
        const next = !d;
        try { window.localStorage?.setItem('lyricsapp:desktopMode', next ? '1' : '0'); } catch {}
        return next;
      });
    }

    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0d0d18',
          ...({ backgroundImage: 'radial-gradient(circle at 50% -10%, #2a2150 0%, #14101f 45%, #0a0a12 100%)' } as any),
        }}
      >
        <View
          style={{
            flex: desktopMode ? undefined : 1,
            height: desktopMode ? '92%' : '100%',
            width: '100%',
            maxWidth: desktopMode ? 640 : 420,
            backgroundColor: colors.background,
            borderRadius: desktopMode ? 20 : 0,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: 0.5,
            shadowRadius: 32,
            ...(Platform.OS === 'web' ? { boxShadow: '0 24px 60px rgba(0,0,0,0.55)' } as any : {}),
          }}
        >
          <App />
        </View>
        {wide && (
          <TouchableOpacity
            onPress={toggle}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              backgroundColor: colors.surface,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: colors.surfaceLight,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>
              {desktopMode ? '📱 תצוגת טלפון' : '🖥️ תצוגת מחשב'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
  return <App />;
}
