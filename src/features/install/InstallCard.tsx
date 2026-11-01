import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui";
import {
  canPromptInstall,
  device,
  dismissInstall,
  inAppBrowser,
  installDismissed,
  onInstallChange,
  promptInstall,
  runningInstalled,
} from "@/features/install/install";
import { colors, fonts, radius, shadow } from "@/theme";

type Step = { icon: keyof typeof Ionicons.glyphMap; text: string };

const IOS_STEPS: Step[] = [
  {
    icon: "share-outline",
    text: "Toque no botão Compartilhar do Safari (o quadrado com a seta para cima), embaixo ou no alto da tela.",
  },
  {
    icon: "add-circle-outline",
    text: 'Role a lista e toque em "Adicionar à Tela de Início".',
  },
  {
    icon: "checkmark-circle-outline",
    text: 'Toque em "Adicionar". O ícone do studio aparece na sua tela inicial.',
  },
];

const ANDROID_STEPS: Step[] = [
  {
    icon: "ellipsis-vertical",
    text: "Toque no menu ⋮ do navegador, no canto de cima.",
  },
  {
    icon: "download-outline",
    text: 'Toque em "Instalar app" ou "Adicionar à tela inicial".',
  },
  {
    icon: "checkmark-circle-outline",
    text: "Confirme. O ícone do studio aparece na sua tela inicial.",
  },
];

const IN_APP_STEPS: Step[] = [
  {
    icon: "ellipsis-horizontal",
    text: "Toque no menu (⋯ ou ⋮) no canto da tela.",
  },
  {
    icon: "open-outline",
    text: 'Escolha "Abrir no navegador" (Safari no iPhone, Chrome no Android).',
  },
  {
    icon: "download-outline",
    text: 'No navegador, toque em "Instalar app" aqui na tela inicial do studio.',
  },
];

// Cartão "Instale o app" na tela inicial (só no navegador, e some quando já está instalado).
export function InstallCard() {
  const insets = useSafeAreaInsets();
  const [, refresh] = useState(0);
  const [closed, setClosed] = useState(installDismissed);
  const [help, setHelp] = useState(false);

  // O navegador avisa quando dá para instalar ou quando instalou: redesenha o cartão.
  useEffect(() => onInstallChange(() => refresh((n) => n + 1)), []);

  // O site é só do navegador (sem geração no servidor), então dá para olhar o celular aqui.
  const hidden =
    closed ||
    runningInstalled() ||
    (device() === "outro" && !canPromptInstall());
  if (Platform.OS !== "web" || hidden) return null;

  const ios = device() === "ios";
  const steps = inAppBrowser() ? IN_APP_STEPS : ios ? IOS_STEPS : ANDROID_STEPS;

  async function install() {
    if (canPromptInstall() && !inAppBrowser()) {
      await promptInstall();
      return;
    }
    setHelp(true);
  }

  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name="phone-portrait-outline" size={22} color={colors.wine} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Instale o app no celular</Text>
        <Text style={styles.text}>
          Abra pelo ícone, em tela cheia, sem procurar o link.
        </Text>
        <Pressable
          style={styles.install}
          onPress={install}
          accessibilityRole="button"
          accessibilityLabel="Instalar app"
        >
          <Ionicons name="download-outline" size={16} color={colors.white} />
          <Text style={styles.installText}>Instalar app</Text>
        </Pressable>
      </View>
      <Pressable
        hitSlop={10}
        onPress={() => {
          dismissInstall();
          setClosed(true);
        }}
        accessibilityLabel="Agora não"
      >
        <Ionicons name="close" size={18} color={colors.muted} />
      </Pressable>

      <Modal
        visible={help}
        transparent
        animationType="fade"
        onRequestClose={() => setHelp(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setHelp(false)}
            accessibilityLabel="Fechar"
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.sheetTitle}>
              {ios ? "Instalar no iPhone" : "Instalar no celular"}
            </Text>
            {steps.map((s, i) => (
              <View key={s.text} style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <Ionicons name={s.icon} size={22} color={colors.wine} />
                <Text style={styles.stepText}>{s.text}</Text>
              </View>
            ))}
            {ios && !inAppBrowser() && (
              <Text style={styles.note}>
                Depois, abra sempre pelo ícone: assim você continua conectada e
                recebe os lembretes (iOS 16.4 ou mais novo).
              </Text>
            )}
            {!ios && !inAppBrowser() && (
              <Text style={styles.note}>
                Se aparecer &quot;Esse app já está instalado&quot;, ele está na
                lista de apps do celular.
              </Text>
            )}
            <Button
              label="Entendi"
              onPress={() => setHelp(false)}
              style={{ marginTop: 18 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 14,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.roseGoldLight,
    ...shadow,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  text: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    marginTop: 2,
  },
  install: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.plum,
  },
  installText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.white,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(43, 18, 32, 0.45)",
  },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    gap: 14,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.plum,
    marginBottom: 4,
  },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.plum,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.white,
  },
  stepText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
});
