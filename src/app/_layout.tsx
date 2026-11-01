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
import { Stack, router, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SyncBanner } from '@/components/SyncBanner';
import { AppointmentsProvider } from '@/features/agenda/AppointmentsContext';
import { CashbackProvider } from '@/features/cashback/CashbackContext';
import { ClientsProvider } from '@/features/clients/ClientsContext';
import { FeedbackProvider } from '@/features/feedback/FeedbackContext';
import { CommentsProvider } from '@/features/feed/CommentsContext';
import { LikesProvider } from '@/features/feed/LikesContext';
import { PostsProvider } from '@/features/feed/PostsContext';
import { FinanceProvider } from '@/features/finance/FinanceContext';
// Escuta o aviso de instalação do navegador desde o início (botão "Instalar app").
import '@/features/install/install';
import { BiometricLock } from '@/features/session/BiometricLock';
import { AutoUpdate } from '@/features/update/AutoUpdate';
import { SessionProvider } from '@/features/session/SessionContext';
import { SettingsProvider } from '@/features/settings/SettingsContext';
import { colors, fonts } from '@/theme';
import { ThemeSync } from '@/theme/ThemeSync';

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
              <CashbackProvider>
                <FinanceProvider>
                  <FeedbackProvider>
                    <PostsProvider>
                      <CommentsProvider>
                        <LikesProvider>
                          <StatusBar style="dark" />
                          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }} />
                          <SyncBanner />
                          <ThemeSync />
                          <BiometricLock />
                          <AutoUpdate />
                        </LikesProvider>
                      </CommentsProvider>
                    </PostsProvider>
                  </FeedbackProvider>
                </FinanceProvider>
              </CashbackProvider>
            </AppointmentsProvider>
          </ClientsProvider>
        </SettingsProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

// Se alguma tela quebrar, mostra um aviso com saída (em vez de tela em branco e o app travado).
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: colors.cream, gap: 12 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: 'center' }}>Algo não saiu como esperado</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center' }}>
        Nada do que você salvou foi perdido. Volte ao início e tente de novo.
      </Text>
      <Pressable
        onPress={() => {
          retry();
          router.replace('/');
        }}
        accessibilityRole="button"
        style={{ marginTop: 8, backgroundColor: colors.plum, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 }}
      >
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.white }}>Voltar ao início</Text>
      </Pressable>
    </View>
  );
}
