import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SongsListScreen from './src/screens/SongsListScreen';
import SongScreen from './src/screens/SongScreen';
import YouTubeScreen from './src/screens/YouTubeScreen';
import VocabScreen from './src/screens/VocabScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import XpPopup from './src/components/XpPopup';
import { colors } from './src/theme';

// The Stack lets us move between screens (list -> song -> back).
const Stack = createNativeStackNavigator();

function App() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <NavigationContainer>
          <StatusBar style="light" />
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="SongsList" component={SongsListScreen} />
            <Stack.Screen name="Song" component={SongScreen} />
            <Stack.Screen name="YouTube" component={YouTubeScreen} />
            <Stack.Screen name="Vocab" component={VocabScreen} />
            <Stack.Screen name="Progress" component={ProgressScreen} />
          </Stack.Navigator>
        </NavigationContainer>
        <XpPopup />
      </View>
    </SafeAreaProvider>
  );
}

function loadDesktopMode(): boolean {
  try {
    return window.localStorage?.getItem('lyricsapp:desktopMode') === '1';
  } catch {
    return false;
  }
}

// On the web preview we normally center the app inside a phone-sized frame,
// so it looks just like it will on a real phone. A toggle lets you switch to
// a full-width desktop layout instead — handy when using the web app on a
// computer rather than a phone.
export default function Root() {
  const [desktopMode, setDesktopMode] = useState(loadDesktopMode);

  if (Platform.OS === 'web') {
    function toggle() {
      setDesktopMode((d) => {
        const next = !d;
        try { window.localStorage?.setItem('lyricsapp:desktopMode', next ? '1' : '0'); } catch {}
        return next;
      });
    }

    return (
      <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#000' }}>
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: desktopMode ? undefined : 420,
            backgroundColor: colors.background,
            shadowColor: '#000',
            shadowOpacity: desktopMode ? 0 : 0.4,
            shadowRadius: 24,
          }}
        >
          <App />
        </View>
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
      </View>
    );
  }
  return <App />;
}
