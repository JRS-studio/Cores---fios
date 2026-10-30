import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ComingSoon } from '@/components/ComingSoon';
import { colors, fonts, radius } from '@/theme';

export default function AgendaScreen() {
  // Serviço escolhido no Provador Virtual, enviado ao tocar em "Agendar".
  const { servico, valor } = useLocalSearchParams<{ servico?: string; valor?: string }>();

  return (
    <ComingSoon
      icon="calendar-outline"
      title="Agenda"
      description="Agende clientes, veja horários livres e receba lembretes de cada atendimento."
    >
      {servico && (
        <View style={styles.selected}>
          <Text style={styles.label}>Serviço escolhido no provador</Text>
          <Text style={styles.service}>{servico}</Text>
          {valor && <Text style={styles.price}>R$ {valor}</Text>}
        </View>
      )}
    </ComingSoon>
  );
}

const styles = StyleSheet.create({
  selected: {
    marginTop: 16,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.plum,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.roseGold,
    textTransform: 'uppercase',
  },
  service: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.white,
    marginTop: 4,
  },
  price: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.roseGoldLight,
    marginTop: 2,
  },
});
