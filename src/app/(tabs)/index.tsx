import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Nail } from '@/components/Nail';
import { SectionHeader } from '@/components/SectionHeader';
import { Stars } from '@/components/ui';
import { trendingPolishes } from '@/data/mock';
import { isActive, useAppointments } from '@/features/agenda/AppointmentsContext';
import { useFeedback } from '@/features/feedback/FeedbackContext';
import { useFinance } from '@/features/finance/FinanceContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius, shadow } from '@/theme';
import { addDays, formatDayMonth, monthKey, today, toMinutes } from '@/utils/date';
import { brl } from '@/utils/format';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

const QUICK_ACTIONS: { icon: keyof typeof Ionicons.glyphMap; label: string; href: Href }[] = [
  { icon: 'add-circle-outline', label: 'Novo\nagendamento', href: '/agendamento/novo' },
  { icon: 'cash-outline', label: 'Lançar\ndespesa', href: '/financeiro/novo' },
  { icon: 'person-add-outline', label: 'Nova\ncliente', href: { pathname: '/cadastro', params: { tipo: 'rapido' } } },
  { icon: 'settings-outline', label: 'Ajustes\ndo studio', href: '/ajustes' },
];

const HERO_NAILS = ['#B3123C', '#E7BFB0', '#6B2D5C', '#E8A0B4'];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { feedbacks, average } = useFeedback();
  const latest = feedbacks[0];
  const { settings } = useSettings();
  const { appointments } = useAppointments();
  const { transactions } = useFinance();

  const todayIso = today();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const income = transactions.filter((t) => t.type === 'entrada');
  const todayIncome = income.filter((t) => t.date === todayIso).reduce((sum, t) => sum + t.amount, 0);
  const monthIncome = income.filter((t) => t.date.startsWith(monthKey(todayIso))).reduce((sum, t) => sum + t.amount, 0);
  const goalProgress = settings.monthlyGoal > 0 ? Math.min(monthIncome / settings.monthlyGoal, 1) : 0;
  const todayCount = appointments.filter((a) => a.date === todayIso && isActive(a)).length;
  // Próximos: ainda não concluídos e que não terminaram.
  const upcoming = appointments
    .filter(
      (a) =>
        (a.status === 'agendado' || a.status === 'confirmado') &&
        (a.date > todayIso || (a.date === todayIso && toMinutes(a.time) + a.duration > nowMinutes)),
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const nextToday = upcoming.find((a) => a.date === todayIso);
  const toConfirm = appointments.filter(
    (a) => a.status === 'agendado' && (a.date === todayIso || a.date === addDays(todayIso, 1)),
  ).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Cabeçalho */}
      <View style={[styles.header, styles.gutter]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.name}>{settings.professionalName}</Text>
          <Text style={styles.studio}>{settings.studioName}</Text>
        </View>
        <Pressable
          style={styles.iconButton}
          onPress={() => router.navigate('/agenda')}
          accessibilityLabel={toConfirm ? `${toConfirm} horários para confirmar` : 'Agenda'}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.plum} />
          {toConfirm > 0 && <View style={styles.badge} />}
        </Pressable>
        <Pressable onPress={() => router.push('/ajustes')} accessibilityLabel="Ajustes">
          <LinearGradient colors={[colors.roseGoldLight, colors.roseGold]} style={styles.avatar}>
            <Text style={styles.avatarText}>{settings.professionalName[0]?.toUpperCase()}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* Destaque: Provador Virtual */}
      <View style={styles.gutter}>
        <Pressable onPress={() => router.navigate('/provador')} style={({ pressed }) => pressed && { opacity: 0.92 }}>
          <LinearGradient
            colors={[colors.wine, colors.plum]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroGlow} />
            <View style={styles.heroContent}>
              <View style={styles.heroTag}>
                <Ionicons name="sparkles" size={12} color={colors.plum} />
                <Text style={styles.heroTagText}>Exclusivo</Text>
              </View>
              <Text style={styles.heroTitle}>
                Provador <Text style={styles.heroTitleItalic}>Virtual</Text>
              </Text>
              <Text style={styles.heroText}>
                Sua cliente fotografa a mão e testa esmaltes e designs antes de escolher.
              </Text>
              <View style={styles.heroButton}>
                <Ionicons name="camera-outline" size={16} color={colors.plum} />
                <Text style={styles.heroButtonText}>Testar agora</Text>
              </View>
            </View>
            <View style={styles.heroNails}>
              {HERO_NAILS.map((color, i) => (
                <View key={color} style={[styles.finger, { height: 92 + (i === 1 || i === 2 ? 18 : 0) }]}>
                  <Nail color={color} width={22} height={32} />
                </View>
              ))}
            </View>
          </LinearGradient>
        </Pressable>
      </View>

      {/* Resumo do dia */}
      <View style={[styles.section, styles.gutter]}>
        <SectionHeader title="Resumo de hoje" />
        <View style={styles.revenueCard}>
          <View style={styles.revenueTop}>
            <View>
              <Text style={styles.cardLabel}>Faturamento de hoje</Text>
              <Text style={styles.revenueValue}>{brl(todayIncome)}</Text>
            </View>
            <Pressable style={styles.trend} onPress={() => router.navigate('/financeiro')}>
              <Text style={styles.trendText}>Mês: {brl(monthIncome)}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.success} />
            </Pressable>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={[colors.roseGold, colors.wine]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${goalProgress * 100}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(goalProgress * 100)}% da meta do mês de {brl(settings.monthlyGoal)}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={20} color={colors.wine} />
            <Text style={styles.statValue}>{todayCount}</Text>
            <Text style={styles.cardLabel} numberOfLines={1}>Hoje</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="star-outline" size={20} color={colors.wine} />
            <Text style={styles.statValue}>{feedbacks.length ? average.toFixed(1).replace('.', ',') : '–'}</Text>
            <Text style={styles.cardLabel} numberOfLines={1}>Avaliação</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={20} color={colors.wine} />
            <Text style={styles.statValue}>{nextToday?.time ?? '–'}</Text>
            <Text style={styles.cardLabel} numberOfLines={1}>Próxima</Text>
          </View>
        </View>
      </View>

      {/* Acesso rápido */}
      <View style={[styles.section, styles.gutter]}>
        <SectionHeader title="Acesso rápido" />
        <View style={styles.quickRow}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable key={action.label} style={styles.quickItem} onPress={() => router.navigate(action.href)}>
              <View style={styles.quickIcon}>
                <Ionicons name={action.icon} size={24} color={colors.plum} />
              </View>
              <Text style={styles.quickLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Próximos horários */}
      <View style={[styles.section, styles.gutter]}>
        <SectionHeader title="Próximos horários" action="Ver agenda" onAction={() => router.navigate('/agenda')} />
        <View style={styles.listCard}>
          {upcoming.slice(0, 4).map((item, i) => (
            <Pressable
              key={item.id}
              style={[styles.appointment, i > 0 && styles.appointmentDivider]}
              onPress={() => router.push({ pathname: '/agendamento/[id]', params: { id: item.id } })}
            >
              <View style={styles.timeBox}>
                <Text style={styles.timeText}>{item.time}</Text>
                {item.date !== todayIso && <Text style={styles.timeDate}>{formatDayMonth(item.date)}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{item.clientName}</Text>
                <View style={styles.serviceRow}>
                  {item.status === 'confirmado' && <Ionicons name="checkmark-circle" size={13} color={colors.success} />}
                  <Text style={styles.serviceText} numberOfLines={1}>
                    {item.serviceName}
                  </Text>
                </View>
              </View>
              <Text style={styles.price}>{brl(item.price)}</Text>
            </Pressable>
          ))}
          {upcoming.length === 0 && (
            <Pressable style={styles.emptyAgenda} onPress={() => router.push('/agendamento/novo')}>
              <Text style={styles.serviceText}>Nenhum horário marcado.</Text>
              <Text style={styles.emptyAgendaCta}>Agendar ›</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Avaliações */}
      <View style={[styles.section, styles.gutter]}>
        <SectionHeader title="Avaliações" action="Ver todas" onAction={() => router.push('/avaliacoes')} />
        <View style={styles.reviewCard}>
          <View style={styles.reviewSummary}>
            <Text style={styles.reviewAverage}>{feedbacks.length ? average.toFixed(1).replace('.', ',') : '–'}</Text>
            <View>
              <Stars value={average} size={16} />
              <Text style={styles.reviewCount}>
                {feedbacks.length
                  ? `${feedbacks.length} ${feedbacks.length === 1 ? 'avaliação' : 'avaliações'}`
                  : 'Nenhuma avaliação ainda'}
              </Text>
            </View>
          </View>
          {latest && (
            <View style={styles.reviewLatest}>
              {latest.photoUri && <Image source={{ uri: latest.photoUri }} style={styles.reviewPhoto} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewName}>{latest.displayName ?? 'Cliente anônima'}</Text>
                <Text style={styles.reviewComment} numberOfLines={2}>
                  {latest.comment || `${latest.rating} ${latest.rating === 1 ? 'estrela' : 'estrelas'}`}
                </Text>
              </View>
            </View>
          )}
          <Pressable style={styles.reviewButton} onPress={() => router.push('/avaliacoes/nova')}>
            <Ionicons name="star-outline" size={16} color={colors.white} />
            <Text style={styles.reviewButtonText}>Avaliar meu atendimento</Text>
          </Pressable>
        </View>
      </View>

      {/* Cores em alta */}
      <View style={styles.section}>
        <View style={styles.gutter}>
          <SectionHeader title="Cores em alta" action="Testar" onAction={() => router.navigate('/provador')} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.polishList}>
          {trendingPolishes.map((polish) => (
            <Pressable key={polish.id} style={styles.polishCard} onPress={() => router.navigate('/provador')}>
              <Nail color={polish.color} width={36} height={50} />
              <Text style={styles.polishName}>{polish.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  gutter: {
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 28,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 22,
  },
  greeting: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.ink,
    lineHeight: 38,
  },
  studio: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.roseGold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 13,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.wine,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.plum,
  },

  hero: {
    borderRadius: radius.lg,
    padding: 22,
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 200,
    ...shadow,
    shadowOpacity: 0.25,
  },
  heroGlow: {
    position: 'absolute',
    right: -60,
    top: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(201,162,126,0.18)',
  },
  heroContent: {
    flex: 1,
    paddingRight: 8,
    zIndex: 1,
  },
  heroTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.roseGoldLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginBottom: 12,
  },
  heroTagText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.plum,
    letterSpacing: 0.4,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.white,
    lineHeight: 32,
  },
  heroTitleItalic: {
    fontFamily: fonts.displayItalic,
    color: colors.roseGoldLight,
  },
  heroText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 6,
    marginBottom: 16,
  },
  heroButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  heroButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.plum,
  },
  heroNails: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    marginBottom: -22,
    alignSelf: 'flex-end',
  },
  finger: {
    width: 30,
    backgroundColor: '#E9C3AE',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    alignItems: 'center',
    paddingTop: 5,
  },

  revenueCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 18,
    ...shadow,
  },
  revenueTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
  revenueValue: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.ink,
    marginTop: 2,
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F3EC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  trendText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.success,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.blush,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 14,
    gap: 2,
    ...shadow,
  },
  statValue: {
    fontFamily: fonts.semibold,
    fontSize: 20,
    color: colors.ink,
    marginTop: 6,
  },

  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickItem: {
    alignItems: 'center',
    width: '23%',
  },
  quickIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 15,
    color: colors.ink,
    textAlign: 'center',
  },

  listCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    ...shadow,
  },
  appointment: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  appointmentDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  timeBox: {
    backgroundColor: colors.plum,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  timeText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.roseGoldLight,
  },
  clientName: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  timeDate: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.roseGold,
    textAlign: 'center',
  },
  emptyAgenda: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  emptyAgendaCta: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.wine,
  },
  serviceText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
  price: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.wine,
  },

  reviewCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 16,
    gap: 14,
    ...shadow,
  },
  reviewSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  reviewAverage: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.ink,
  },
  reviewCount: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  reviewLatest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  reviewPhoto: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.blush,
  },
  reviewName: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.ink,
  },
  reviewComment: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.plum,
    borderRadius: radius.pill,
    paddingVertical: 12,
  },
  reviewButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.white,
  },

  polishList: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  polishCard: {
    width: 82,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: 14,
    gap: 10,
    ...shadow,
  },
  polishName: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.ink,
  },
});
