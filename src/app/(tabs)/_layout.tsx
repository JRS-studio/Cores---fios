import { Tabs } from 'expo-router';

import { TabBar } from '@/components/TabBar';
import { useSession } from '@/features/session/SessionContext';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { canManage } = useSession();
  return (
    <Tabs
      // A cliente não vê o financeiro do studio.
      tabBar={(props) => <TabBar {...props} hidden={canManage ? [] : ['financeiro']} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.cream } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="agenda" options={{ title: canManage ? 'Agenda' : 'Horários' }} />
      <Tabs.Screen name="provador" options={{ title: 'Provador' }} />
      <Tabs.Screen name="financeiro" options={{ title: 'Financeiro' }} />
      <Tabs.Screen name="clientes" options={{ title: canManage ? 'Clientes' : 'Conta' }} />
    </Tabs>
  );
}
