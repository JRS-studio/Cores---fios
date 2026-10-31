import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui';
import { useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius } from '@/theme';

const UPDATED_AT = '31 de outubro de 2026';

export default function PrivacidadeScreen() {
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();

  const sections: { title: string; body: string[] }[] = [
    {
      title: 'Quem cuida dos seus dados',
      body: [
        `${settings.studioName}, com atendimento de ${settings.professionalName}, é responsável pelos dados registrados neste app, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).`,
      ],
    },
    {
      title: 'O que registramos',
      body: [
        'Cadastro rápido: nome e WhatsApp. O WhatsApp é a sua identificação e é confirmado por um código. Não pedimos documentos (CPF, RG ou outros).',
        'Cadastro Premium, se você quiser: e-mail, data de nascimento e endereço (todos opcionais), preferências de atendimento e a ficha de saúde.',
        'Agendamentos, serviços realizados, valores pagos e forma de pagamento.',
        'Avaliações: nota, comentário, foto do resultado e o nome que você escolher mostrar, ou nenhum, se publicar como anônima.',
        'Provador Virtual: a foto da sua mão é usada só na tela, durante o teste, e não é guardada.',
      ],
    },
    {
      title: 'Para que usamos',
      body: [
        'Agendar, confirmar e lembrar seus horários pelo WhatsApp.',
        'Programa de fidelidade: selos, prêmios e desconto no mês do aniversário.',
        'Sua segurança no atendimento, consultando alergias e cuidados antes de começar.',
        'Organização financeira do studio e exibição das avaliações.',
      ],
    },
    {
      title: 'Ficha de saúde',
      body: [
        'Alergias e condições de saúde são dados sensíveis. Só ficam registradas se você autorizar de forma específica no cadastro, e você pode retirar essa autorização a qualquer momento.',
      ],
    },
    {
      title: 'Onde ficam e com quem compartilhamos',
      body: [
        'Os dados ficam guardados no aparelho em que foram registrados. Não vendemos nem repassamos seus dados a terceiros. As mensagens de WhatsApp são abertas no seu próprio aplicativo de WhatsApp.',
      ],
    },
    {
      title: 'Seus direitos',
      body: [
        'Você pode ver seus dados no seu perfil, corrigi-los em “Editar cadastro” e apagá-los em “Excluir cadastro”. Também pode pedir qualquer uma dessas ações, ou informações sobre o uso dos seus dados, diretamente ao studio pelo WhatsApp.',
      ],
    },
    {
      title: 'Por quanto tempo',
      body: ['Enquanto o seu cadastro existir. Ao excluir o cadastro, os dados são apagados na hora.'],
    },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
    >
      <ScreenHeader title="Privacidade" subtitle={`Atualizada em ${UPDATED_AT}`} />
      {sections.map((s) => (
        <View key={s.title} style={styles.section}>
          <Text style={styles.title}>{s.title}</Text>
          {s.body.map((p) => (
            <Text key={p} style={styles.body}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  section: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  title: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.ink },
});
