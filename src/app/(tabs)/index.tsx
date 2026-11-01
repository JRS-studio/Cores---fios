import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isActive, useAppointments } from '@/features/agenda/AppointmentsContext';
import { useClients } from '@/features/clients/ClientsContext';
import { useFeedback } from '@/features/feedback/FeedbackContext';
import { PostCard, ReviewCard, StudioAvatar, type FeedItem } from '@/features/feed/FeedCards';
import { useComments } from '@/features/feed/CommentsContext';
import { usePosts } from '@/features/feed/PostsContext';
import { useFinance } from '@/features/finance/FinanceContext';
import { useSession } from '@/features/session/SessionContext';
import { instagramUrl, useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius, shadow } from '@/theme';
import { formatDayMonth, today, toMinutes } from '@/utils/date';
import { brl, formatPhone } from '@/utils/format';
import { openExternal } from '@/utils/openExternal';
import { RemindersCard } from '@/features/reminders/RemindersCard';
import { InstallCard } from '@/features/install/InstallCard';

type Shortcut = { icon: keyof typeof Ionicons.glyphMap; label: string; a11y?: string; href: Href };

// Atalhos em círculos, como os destaques de um perfil.
const OWNER_SHORTCUTS: Shortcut[] = [
  { icon: 'add', label: 'Agendar', href: '/agendamento/novo' },
  { icon: 'cash-outline', label: 'Despesa', href: '/financeiro/novo' },
  { icon: 'person-add-outline', label: 'Cliente', href: { pathname: '/cadastro', params: { tipo: 'rapido' } } },
  { icon: 'star-outline', label: 'Avaliações', href: '/avaliacoes' },
  { icon: 'settings-outline', label: 'Ajustes', href: '/ajustes' },
];

// Agendar já está no "+" da barra e no botão do perfil.
const CLIENT_SHORTCUTS: Shortcut[] = [
  { icon: 'time-outline', label: 'Horários', a11y: 'Meus horários', href: '/agenda' },
  { icon: 'camera-outline', label: 'Avaliar', href: '/avaliacoes/nova' },
  { icon: 'star-outline', label: 'Avaliações', href: '/avaliacoes' },
  { icon: 'person-outline', label: 'Conta', a11y: 'Minha conta', href: '/clientes' },
];

type Filter = 'tudo' | 'studio' | 'avaliacoes';
const FILTERS: [Filter, string][] = [
  ['tudo', 'Tudo'],
  ['studio', 'Do studio'],
  ['avaliacoes', 'Avaliações'],
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { canManage, phone } = useSession();
  const { feedbacks, pending, average, removeFeedback } = useFeedback();
  const { posts, removePost } = usePosts();
  const pendingComments = useComments().pending;
  const [filter, setFilter] = useState<Filter>('tudo');

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      ...(filter === 'avaliacoes' ? [] : posts.map((post) => ({ type: 'post' as const, id: post.id, createdAt: post.createdAt, post }))),
      ...(filter === 'studio' ? [] : feedbacks.map((review) => ({ type: 'review' as const, id: review.id, createdAt: review.createdAt, review }))),
    ];
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [posts, feedbacks, filter]);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) =>
      item.type === 'post' ? (
        <PostCard post={item.post} studioName={settings.studioName} canManage={canManage} onRemove={() => removePost(item.id)} />
      ) : (
        <ReviewCard review={item.review} canManage={canManage} onRemove={() => removeFeedback(item.id)} />
      ),
    [settings.studioName, canManage, removePost, removeFeedback],
  );

  const header = (
    <>
      <TopBar />
      <Profile postsCount={posts.length} reviewsCount={feedbacks.length} average={average} />
      <Shortcuts />
      {canManage && pending.length > 0 && (
        <Pressable style={styles.toApprove} onPress={() => router.push('/avaliacoes')} accessibilityRole="button">
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.wine} />
          <Text style={styles.toApproveText}>
            {pending.length === 1 ? '1 avaliação esperando' : `${pending.length} avaliações esperando`} sua aprovação para aparecer no feed
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.wine} />
        </Pressable>
      )}
      {canManage && pendingComments.length > 0 && (
        <Pressable style={styles.toApprove} onPress={() => router.push('/comentarios')} accessibilityRole="button">
          <Ionicons name="chatbubbles-outline" size={20} color={colors.wine} />
          <Text style={styles.toApproveText}>
            {pendingComments.length === 1 ? '1 comentário esperando' : `${pendingComments.length} comentários esperando`} sua aprovação
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.wine} />
        </Pressable>
      )}
      <InstallCard />
      {canManage ? <TodayCard /> : phone ? <NextAppointment /> : null}
      {!canManage && (
        <View style={styles.reminders}>
          <RemindersCard compact />
        </View>
      )}
      <Composer />
      <View style={styles.filters}>
        {FILTERS.map(([id, label]) => (
          <Pressable
            key={id}
            style={[styles.filter, filter === id && styles.filterActive]}
            onPress={() => setFilter(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === id }}
          >
            <Text style={[styles.filterText, filter === id && styles.filterTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );

  return (
    <FlatList
      style={styles.screen}
      data={feed}
      keyExtractor={(item) => `${item.type}-${item.id}`}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListEmptyComponent={<EmptyFeed filter={filter} />}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120 }}
      showsVerticalScrollIndicator={false}
      initialNumToRender={4}
      windowSize={7}
    />
  );
}

function TopBar() {
  const { settings } = useSettings();
  const { canManage } = useSession();
  const { appointments } = useAppointments();
  const todayIso = today();
  const toConfirm = canManage
    ? appointments.filter((a) => a.status === 'agendado' && a.date >= todayIso).length
    : 0;

  return (
    <View style={styles.topBar}>
      <Text style={styles.logo} numberOfLines={1}>
        {settings.studioName}
      </Text>
      <Pressable
        style={styles.iconButton}
        onPress={() => router.navigate('/agenda')}
        accessibilityLabel={toConfirm ? `${toConfirm} pedidos de horário para confirmar` : 'Agenda'}
      >
        <Ionicons name={canManage ? 'notifications-outline' : 'calendar-outline'} size={22} color={colors.plum} />
        {toConfirm > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{toConfirm}</Text>
          </View>
        )}
      </Pressable>
      <Pressable style={styles.iconButton} onPress={() => router.push('/ajustes/tema')} accessibilityLabel="Tema do app">
        <Ionicons name="color-palette-outline" size={22} color={colors.plum} />
      </Pressable>
      <Pressable style={styles.iconButton} onPress={() => router.push('/ajustes')} accessibilityLabel="Ajustes">
        <Ionicons name="menu-outline" size={24} color={colors.plum} />
      </Pressable>
    </View>
  );
}

function Profile({ postsCount, reviewsCount, average }: { postsCount: number; reviewsCount: number; average: number }) {
  const { settings } = useSettings();
  const { canManage, phone } = useSession();
  const { findByPhone } = useClients();
  const me = !canManage && phone ? findByPhone(phone) : undefined;

  const stats = [
    { value: String(postsCount), label: 'publicações' },
    { value: String(reviewsCount), label: 'avaliações' },
    { value: reviewsCount ? average.toFixed(1).replace('.', ',') : '–', label: 'nota', star: true },
  ];

  return (
    <View style={styles.profile}>
      <View style={styles.profileTop}>
        <StudioAvatar name={settings.studioName} size={74} />
        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <View style={styles.statValueRow}>
                {s.star && <Ionicons name="star" size={13} color="#E0A526" />}
                <Text style={styles.statValue}>{s.value}</Text>
              </View>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={styles.profileName}>{settings.professionalName}</Text>
      <Text style={styles.profileBio}>
        {canManage
          ? 'Seu perfil como as clientes veem. Publique seus trabalhos e novidades.'
          : me
            ? `Que bom te ver, ${me.name.split(' ')[0]}! Confira as novidades e os trabalhos do studio.`
            : 'Manicure e nail designer. Veja os trabalhos, as avaliações das clientes e agende seu horário.'}
      </Text>
      <View style={styles.profileButtons}>
        {canManage ? (
          <>
            <ProfileButton icon="add-circle-outline" label="Publicar" primary onPress={() => router.push('/publicacao/nova')} />
            <ProfileButton icon="create-outline" label="Editar perfil" onPress={() => router.push('/ajustes')} />
          </>
        ) : (
          <>
            <ProfileButton icon="calendar-outline" label="Agendar" primary onPress={() => router.push('/agendamento/novo')} />
            <ProfileButton icon="star-outline" label="Avaliar" onPress={() => router.push('/avaliacoes/nova')} />
          </>
        )}
        {settings.instagram ? (
          <Pressable
            onPress={() => openExternal(instagramUrl(settings.instagram))}
            style={({ pressed }) => [styles.instagram, pressed && { opacity: 0.85 }]}
            accessibilityRole="link"
            accessibilityLabel={`Instagram do studio: @${settings.instagram}`}
          >
            <Ionicons name="logo-instagram" size={20} color={colors.plum} />
          </Pressable>
        ) : null}
        {settings.whatsapp ? (
          <Pressable
            onPress={() =>
              openExternal(
                `https://wa.me/55${settings.whatsapp}?text=${encodeURIComponent(`Oi, ${settings.professionalName}! Vim pelo app do ${settings.studioName}.`)}`,
              )
            }
            style={({ pressed }) => [styles.instagram, pressed && { opacity: 0.85 }]}
            accessibilityRole="link"
            accessibilityLabel={`WhatsApp do studio: ${formatPhone(settings.whatsapp)}`}
          >
            <Ionicons name="logo-whatsapp" size={20} color={colors.plum} />
          </Pressable>
        ) : canManage ? (
          // Sem número cadastrado, as clientes não veem o botão; a profissional vê um atalho para cadastrar.
          <Pressable
            onPress={() => router.push('/ajustes')}
            style={({ pressed }) => [styles.instagram, styles.whatsappMissing, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Cadastrar seu WhatsApp para as clientes"
          >
            <Ionicons name="logo-whatsapp" size={20} color={colors.muted} />
            <View style={styles.whatsappBadge}>
              <Ionicons name="add" size={11} color={colors.white} />
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ProfileButton({ icon, label, primary, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.profileButton, primary && styles.profileButtonPrimary, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={17} color={primary ? colors.roseGoldLight : colors.plum} />
      <Text style={[styles.profileButtonText, primary && { color: colors.white }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Shortcuts() {
  const { canManage } = useSession();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcuts}>
      {(canManage ? OWNER_SHORTCUTS : CLIENT_SHORTCUTS).map((s) => (
        <Pressable key={s.label} style={styles.shortcut} onPress={() => router.navigate(s.href)} accessibilityRole="button" accessibilityLabel={s.a11y ?? s.label}>
          <LinearGradient colors={[colors.roseGoldLight, colors.roseGold]} style={styles.shortcutRing}>
            <View style={styles.shortcutInner}>
              <Ionicons name={s.icon} size={24} color={colors.plum} />
            </View>
          </LinearGradient>
          <Text style={styles.shortcutLabel} numberOfLines={1}>
            {s.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// Resumo do dia da profissional, discreto, acima do feed.
function TodayCard() {
  const { appointments } = useAppointments();
  const { transactions } = useFinance();
  const todayIso = today();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayIncome = transactions.filter((t) => t.type === 'entrada' && t.date === todayIso).reduce((sum, t) => sum + t.amount, 0);
  const todays = appointments.filter((a) => a.date === todayIso && isActive(a));
  const next = todays
    .filter((a) => (a.status === 'agendado' || a.status === 'confirmado') && toMinutes(a.time) + a.duration > nowMinutes)
    .sort((a, b) => a.time.localeCompare(b.time))[0];

  return (
    <View style={styles.today}>
      <Pressable style={styles.todayItem} onPress={() => router.navigate('/agenda')} accessibilityRole="button">
        <Text style={styles.todayValue}>{todays.length}</Text>
        <Text style={styles.todayLabel}>horários hoje</Text>
      </Pressable>
      <View style={styles.todayDivider} />
      <Pressable style={styles.todayItem} onPress={() => router.navigate('/agenda')} accessibilityRole="button">
        <Text style={styles.todayValue}>{next?.time ?? '–'}</Text>
        <Text style={styles.todayLabel} numberOfLines={1}>
          {next ? next.clientName.split(' ')[0] : 'próxima'}
        </Text>
      </Pressable>
      <View style={styles.todayDivider} />
      <Pressable style={styles.todayItem} onPress={() => router.navigate('/financeiro')} accessibilityRole="button">
        <Text style={styles.todayValue}>{brl(todayIncome)}</Text>
        <Text style={styles.todayLabel}>recebido hoje</Text>
      </Pressable>
    </View>
  );
}

function NextAppointment() {
  const { appointments } = useAppointments();
  const todayIso = today();
  const next = appointments
    .filter((a) => (a.status === 'agendado' || a.status === 'confirmado') && a.date >= todayIso)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  if (!next) return null;
  return (
    <Pressable style={styles.next} onPress={() => router.push({ pathname: '/agendamento/[id]', params: { id: next.id } })}>
      <View style={styles.nextIcon}>
        <Ionicons name="calendar" size={18} color={colors.roseGoldLight} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.nextTitle}>Seu próximo horário</Text>
        <Text style={styles.nextText} numberOfLines={1}>
          {next.date === todayIso ? 'Hoje' : formatDayMonth(next.date)} às {next.time} · {next.serviceName}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function Composer() {
  const { canManage, phone } = useSession();
  const { settings } = useSettings();
  const { findByPhone } = useClients();
  const me = !canManage && phone ? findByPhone(phone) : undefined;
  return (
    <Pressable
      style={styles.composer}
      onPress={() => router.push(canManage ? '/publicacao/nova' : '/avaliacoes/nova')}
      accessibilityRole="button"
    >
      {canManage ? (
        <StudioAvatar name={settings.studioName} size={30} />
      ) : (
        <View style={styles.composerAvatar}>
          {me ? <Text style={styles.composerAvatarText}>{me.name[0]?.toUpperCase()}</Text> : <Ionicons name="person" size={16} color={colors.muted} />}
        </View>
      )}
      <Text style={styles.composerText} numberOfLines={1}>
        {canManage ? 'Compartilhe um trabalho ou novidade…' : 'Como ficaram suas unhas? Conte aqui…'}
      </Text>
      <Ionicons name={canManage ? 'image-outline' : 'camera-outline'} size={22} color={colors.wine} />
    </Pressable>
  );
}

function EmptyFeed({ filter }: { filter: Filter }) {
  const { canManage } = useSession();
  const studio = filter === 'studio';
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={studio ? 'images-outline' : 'chatbubble-ellipses-outline'} size={28} color={colors.wine} />
      </View>
      <Text style={styles.emptyTitle}>{studio || filter === 'tudo' ? 'Nenhuma publicação ainda' : 'Nenhuma avaliação ainda'}</Text>
      <Text style={styles.emptyText}>
        {canManage
          ? 'Publique fotos dos seus trabalhos, promoções e avisos. As avaliações das clientes também aparecem aqui.'
          : 'Logo aparecem aqui os trabalhos do studio e as avaliações das clientes.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 14 },
  logo: { flex: 1, fontFamily: fonts.displayItalic, fontSize: 24, color: colors.plum },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.wine,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.cream,
  },
  badgeText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.white },

  profile: { paddingHorizontal: 18 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statValue: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink },
  statLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  profileName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, marginTop: 10 },
  profileBio: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.ink, marginTop: 2 },
  profileButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  whatsappMissing: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.roseGold, backgroundColor: 'transparent' },
  whatsappBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.wine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instagram: { width: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.blush },
  profileButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.blush,
  },
  profileButtonPrimary: { backgroundColor: colors.plum },
  profileButtonText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.plum },

  shortcuts: { paddingHorizontal: 14, paddingVertical: 16, gap: 14 },
  shortcut: { alignItems: 'center', width: 70, gap: 6 },
  shortcutRing: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  shortcutInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.ink },

  today: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    marginHorizontal: 12,
    paddingVertical: 12,
    ...shadow,
    shadowOpacity: 0.06,
  },
  todayItem: { flex: 1, alignItems: 'center' },
  todayValue: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  todayLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  todayDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },

  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    marginHorizontal: 12,
    padding: 12,
    ...shadow,
    shadowOpacity: 0.06,
  },
  nextIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.plum, alignItems: 'center', justifyContent: 'center' },
  nextTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  nextText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },

  reminders: { marginHorizontal: 12, marginTop: 12 },
  toApprove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.roseGold,
    backgroundColor: colors.blush,
  },
  toApproveText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.wine },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    marginHorizontal: 12,
    marginTop: 12,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  composerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.roseGoldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerAvatarText: { fontFamily: fonts.display, fontSize: 16, color: colors.plum },
  composerText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.muted },

  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginTop: 16, marginBottom: 12 },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filterActive: { backgroundColor: colors.plum, borderColor: colors.plum },
  filterText: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink },
  filterTextActive: { color: colors.white },

  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 32 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink, marginBottom: 6 },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.muted, textAlign: 'center' },
});
