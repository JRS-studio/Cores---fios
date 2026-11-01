import { router, Tabs } from 'expo-router';

import { TabBar } from '@/components/TabBar';
import { useSession } from '@/features/session/SessionContext';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { canManage, viewOnly } = useSession();
  // O "+" central cria o que cada uma mais usa: a profissional publica; a cliente agenda.
  // Sem login (modo visualização), o botão central leva para entrar ou se cadastrar.
  const center = canManage
    ? { label: 'Publicar', onPress: () => router.push('/publicacao/nova') }
    : viewOnly
      ? { label: 'Entrar', icon: 'log-in-outline' as const, onPress: () => router.push('/entrar') }
      : { label: 'Agendar', onPress: () => router.push('/agendamento/novo') };
  return (
    <Tabs
      // A cliente não vê o financeiro do studio.
      tabBar={(props) => <TabBar {...props} hidden={canManage ? [] : viewOnly ? ['financeiro', 'agenda'] : ['financeiro']} center={center} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.cream } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="agenda" options={{ title: canManage ? 'Agenda' : 'Horários' }} />
      <Tabs.Screen name="financeiro" options={{ title: 'Financeiro' }} />
      <Tabs.Screen name="clientes" options={{ title: canManage ? 'Clientes' : 'Conta' }} />
    </Tabs>
  );
}
