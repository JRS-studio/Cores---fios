import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_600SemiBold_Italic,
} from '@expo-google-fonts/playfair-display';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SyncBanner } from '@/components/SyncBanner';
import { AppointmentsProvider } from '@/features/agenda/AppointmentsContext';
import { ClientsProvider } from '@/features/clients/ClientsContext';
import { FeedbackProvider } from '@/features/feedback/FeedbackContext';
import { LikesProvider } from '@/features/feed/LikesContext';
import { PostsProvider } from '@/features/feed/PostsContext';
import { FinanceProvider } from '@/features/finance/FinanceContext';
import { SessionProvider } from '@/features/session/SessionContext';
import { SettingsProvider } from '@/features/settings/SettingsContext';
import { colors } from '@/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_600SemiBold_Italic,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.plum }}>
        <ActivityIndicator color={colors.roseGold} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <SettingsProvider>
          <ClientsProvider>
            <AppointmentsProvider>
              <FinanceProvider>
                <FeedbackProvider>
                  <PostsProvider>
                    <LikesProvider>
                      <StatusBar style="dark" />
                      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }} />
                      <SyncBanner />
                    </LikesProvider>
                  </PostsProvider>
                </FeedbackProvider>
              </FinanceProvider>
            </AppointmentsProvider>
          </ClientsProvider>
        </SettingsProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
