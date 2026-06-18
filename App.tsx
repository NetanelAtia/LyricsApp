import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
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

// On the web preview we center the app inside a phone-sized frame,
// so it looks just like it will on a real phone. On a real device
// it fills the screen normally.
export default function Root() {
  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#000' }}>
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: 420,
            backgroundColor: colors.background,
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowRadius: 24,
          }}
        >
          <App />
        </View>
      </View>
    );
  }
  return <App />;
}
