import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo, useRef, useState, type ReactNode } from 'react';
import { Animated, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Stars } from '@/components/ui';
import type { Feedback } from '@/features/feedback/FeedbackContext';
import { WEB_URL } from '@/features/session/ClientLink';
import { colors, fonts, radius, shadow } from '@/theme';
import { timeAgo } from '@/utils/date';
import { openExternal } from '@/utils/openExternal';
import { useSession } from '@/features/session/SessionContext';
import { useComments } from './CommentsContext';
import { useLikes } from './LikesContext';
import { postKindLabel, type Post } from './PostsContext';

export type FeedItem = { type: 'post'; id: string; createdAt: string; post: Post } | { type: 'review'; id: string; createdAt: string; review: Feedback };

const LONG_CAPTION = 160;

// Compartilha pelo menu do celular; no navegador sem esse menu, abre o WhatsApp.
async function shareText(text: string) {
  const message = WEB_URL ? `${text}\n\n${WEB_URL}` : text;
  try {
    await Share.share({ message });
  } catch {
    openExternal(`https://wa.me/?text=${encodeURIComponent(message)}`);
  }
}

// Logo do studio (a mesma imagem do ícone do app), usado como foto do perfil.
export const STUDIO_LOGO = require('../../../assets/logo-avatar.png');

export function StudioAvatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <LinearGradient colors={[colors.roseGold, colors.wine]} style={[styles.ring, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 }]}>
      <Image
        source={STUDIO_LOGO}
        style={[styles.studioAvatar, { width: size, height: size, borderRadius: size / 2 }]}
        accessibilityLabel={`Logo do ${name}`}
      />
    </LinearGradient>
  );
}

function PersonAvatar({ name }: { name: string | null }) {
  return (
    <View style={[styles.personAvatar, !name && { backgroundColor: colors.blush }]}>
      {name ? <Text style={styles.personAvatarText}>{name.trim()[0]?.toUpperCase()}</Text> : <Ionicons name="person" size={17} color={colors.muted} />}
    </View>
  );
}

// Fotos que passam para o lado; dois toques seguidos curtem, como nas redes sociais.
function PhotoPager({ photos, onDoubleTap, label }: { photos: string[]; onDoubleTap: () => void; label: string }) {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const lastTap = useRef(0);
  const [burst] = useState(() => new Animated.Value(0));

  function onPress() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      onDoubleTap();
      burst.setValue(0);
      Animated.sequence([
        Animated.spring(burst, { toValue: 1, useNativeDriver: true, friction: 4 }),
        Animated.timing(burst, { toValue: 0, duration: 250, delay: 250, useNativeDriver: true }),
      ]).start();
    }
    lastTap.current = now;
  }

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={photos.length > 1}
        onMomentumScrollEnd={(e) => width && setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        onScroll={(e) => width && setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        scrollEventThrottle={64}
      >
        {photos.map((uri, i) => (
          <Pressable key={uri} onPress={onPress} accessibilityLabel={`${label}, foto ${i + 1} de ${photos.length}`}>
            <Image source={{ uri }} style={[styles.photo, { width: width || 1 }]} resizeMode="cover" />
          </Pressable>
        ))}
      </ScrollView>
      <Animated.View pointerEvents="none" style={[styles.burst, { opacity: burst, transform: [{ scale: burst }] }]}>
        <Ionicons name="heart" size={88} color={colors.white} />
      </Animated.View>
      {photos.length > 1 && (
        <>
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {page + 1}/{photos.length}
            </Text>
          </View>
          <View style={styles.dots}>
            {photos.map((uri, i) => (
              <View key={uri} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function LikeButton({ itemId }: { itemId: string }) {
  const { count, likedByMe, toggle } = useLikes();
  const { viewOnly } = useSession();
  const liked = likedByMe(itemId);
  const n = count(itemId);
  if (viewOnly) {
    // Modo visualização: só mostra quantas curtidas tem.
    return (
      <View style={styles.action} accessibilityLabel={`${n} ${n === 1 ? 'curtida' : 'curtidas'}`}>
        <Ionicons name="heart-outline" size={25} color={colors.muted} />
        {n > 0 && <Text style={styles.actionCount}>{n}</Text>}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => toggle(itemId)}
      hitSlop={8}
      style={styles.action}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={liked ? 'Descurtir' : 'Curtir'}
    >
      <Ionicons name={liked ? 'heart' : 'heart-outline'} size={25} color={liked ? colors.chartIncome : colors.ink} />
      {n > 0 && <Text style={styles.actionCount}>{n}</Text>}
    </Pressable>
  );
}

function Caption({ author, text }: { author?: string; text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > LONG_CAPTION;
  return (
    <Pressable onPress={() => long && setOpen(!open)} disabled={!long}>
      <Text style={styles.caption} numberOfLines={open || !long ? undefined : 3}>
        {author && <Text style={styles.captionAuthor}>{author} </Text>}
        {text}
      </Text>
      {long && !open && <Text style={styles.more}>ver mais</Text>}
    </Pressable>
  );
}

function RemoveMenu({ label, onRemove }: { label: string; onRemove: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Pressable onPress={() => setConfirming(true)} hitSlop={10} accessibilityLabel={`Opções: ${label}`}>
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
      </Pressable>
    );
  }
  return (
    <View style={styles.confirm}>
      <Pressable onPress={() => setConfirming(false)} hitSlop={6}>
        <Text style={styles.confirmCancel}>Cancelar</Text>
      </Pressable>
      <Pressable onPress={onRemove} hitSlop={6}>
        <Text style={styles.confirmRemove}>{label}</Text>
      </Pressable>
    </View>
  );
}

function Card({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>{header}</View>
      {children}
    </View>
  );
}

const openComments = (id: string) => router.push({ pathname: '/publicacao/[id]', params: { id } });

type PostCardProps = { post: Post; studioName: string; canManage: boolean; onRemove: () => void };

export const PostCard = memo(function PostCard({ post, studioName, canManage, onRemove }: PostCardProps) {
  const { likedByMe, toggle } = useLikes();
  const { viewOnly } = useSession();
  const comments = useComments().approvedFor(post.id);
  const like = () => !viewOnly && !likedByMe(post.id) && toggle(post.id);
  const kind = postKindLabel(post.kind);
  const hasPhotos = post.photos.length > 0;

  return (
    <Card
      header={
        <>
          <StudioAvatar name={studioName} size={34} />
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {studioName}
              </Text>
              <View style={styles.studioTag}>
                <Text style={styles.studioTagText}>Studio</Text>
              </View>
            </View>
            <Text style={styles.meta}>
              {timeAgo(post.createdAt)}
              {kind ? ` · ${kind}` : ''}
            </Text>
          </View>
          {canManage && <RemoveMenu label="Excluir publicação" onRemove={onRemove} />}
        </>
      }
    >
      {hasPhotos ? (
        <PhotoPager photos={post.photos} label={kind || 'Publicação'} onDoubleTap={like} />
      ) : (
        <LinearGradient colors={post.kind === 'promocao' ? [colors.wine, colors.plum] : [colors.plumSoft, colors.plum]} style={styles.textPost}>
          <Ionicons name={post.kind === 'promocao' ? 'pricetag' : post.kind === 'aviso' ? 'megaphone' : 'sparkles'} size={22} color={colors.roseGoldLight} />
          <Text style={styles.textPostText}>{post.caption}</Text>
        </LinearGradient>
      )}

      <View style={styles.actions}>
        <LikeButton itemId={post.id} />
        {(!viewOnly || comments.length > 0) && (
          <Pressable
            onPress={() => openComments(post.id)}
            hitSlop={8}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel={comments.length ? `Comentários (${comments.length})` : 'Comentar'}
          >
            <Ionicons name="chatbubble-outline" size={23} color={colors.ink} />
            {comments.length > 0 && <Text style={styles.actionCount}>{comments.length}</Text>}
          </Pressable>
        )}
        {!viewOnly && (
          <Pressable onPress={() => shareText(`${studioName}: ${post.caption}`)} hitSlop={8} style={styles.action} accessibilityLabel="Compartilhar">
            <Ionicons name="paper-plane-outline" size={23} color={colors.ink} />
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {!canManage && !viewOnly && (
          <Pressable style={styles.bookButton} onPress={() => router.push('/agendamento/novo')}>
            <Ionicons name="calendar-outline" size={15} color={colors.white} />
            <Text style={styles.bookText}>Agendar</Text>
          </Pressable>
        )}
      </View>
      {(hasPhotos || comments.length > 0) && (
        <View style={styles.body}>
          {hasPhotos && <Caption author={studioName} text={post.caption} />}
          {comments.length > 2 && (
            <Pressable onPress={() => openComments(post.id)} hitSlop={4}>
              <Text style={styles.more}>Ver os {comments.length} comentários</Text>
            </Pressable>
          )}
          {comments.slice(-2).map((c) => (
            <Text key={c.id} style={[styles.commentLine, !!c.replyTo && styles.replyLine]} numberOfLines={2}>
              {c.replyTo ? '↳ ' : ''}
              <Text style={styles.captionAuthor}>{c.name} </Text>
              {c.text}
            </Text>
          ))}
          {!viewOnly && (
            <Pressable onPress={() => openComments(post.id)} hitSlop={4}>
              <Text style={styles.addComment}>Adicione um comentário…</Text>
            </Pressable>
          )}
        </View>
      )}
      {!hasPhotos && comments.length === 0 && !viewOnly && (
        <Pressable onPress={() => openComments(post.id)} hitSlop={4} style={styles.body}>
          <Text style={styles.addComment}>Adicione um comentário…</Text>
        </Pressable>
      )}
    </Card>
  );
});

type ReviewCardProps = { review: Feedback; canManage: boolean; onRemove: () => void };

export const ReviewCard = memo(function ReviewCard({ review: f, canManage, onRemove }: ReviewCardProps) {
  const { likedByMe, toggle } = useLikes();
  const { viewOnly } = useSession();
  const name = f.displayName ?? 'Cliente anônima';

  return (
    <Card
      header={
        <>
          <PersonAvatar name={f.displayName} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.meta}>avaliou o atendimento · {timeAgo(f.createdAt)}</Text>
          </View>
          {canManage ? <RemoveMenu label="Remover avaliação" onRemove={onRemove} /> : <Stars value={f.rating} size={13} />}
        </>
      }
    >
      {f.photoUri && <PhotoPager photos={[f.photoUri]} label="Resultado" onDoubleTap={() => !viewOnly && !likedByMe(f.id) && toggle(f.id)} />}
      <View style={styles.actions}>
        <LikeButton itemId={f.id} />
        {!viewOnly && (
          <Pressable
            onPress={() => shareText(`“${f.comment || 'Amei o atendimento!'}” — ${name}, ${f.rating} ${f.rating === 1 ? 'estrela' : 'estrelas'}`)}
            hitSlop={8}
            style={styles.action}
            accessibilityLabel="Compartilhar"
          >
            <Ionicons name="paper-plane-outline" size={23} color={colors.ink} />
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {canManage && <Stars value={f.rating} size={14} />}
      </View>
      <View style={styles.body}>
        {f.service && (
          <View style={styles.serviceTag}>
            <Text style={styles.serviceTagText}>{f.service}</Text>
          </View>
        )}
        {f.comment ? <Caption author={f.displayName ?? undefined} text={f.comment} /> : null}
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    marginHorizontal: 12,
    marginBottom: 14,
    overflow: 'hidden',
    ...shadow,
    shadowOpacity: 0.06,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  ring: { alignItems: 'center', justifyContent: 'center' },
  studioAvatar: { backgroundColor: colors.plum, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  personAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.roseGoldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatarText: { fontFamily: fonts.display, fontSize: 17, color: colors.plum },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, flexShrink: 1 },
  studioTag: { backgroundColor: colors.blush, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1 },
  studioTagText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.wine },
  meta: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  photo: { aspectRatio: 4 / 5, backgroundColor: colors.blush },
  burst: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(43,18,32,0.6)',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  counterText: { fontFamily: fonts.medium, fontSize: 11, color: colors.white },
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotActive: { backgroundColor: colors.white },
  textPost: { minHeight: 220, padding: 26, justifyContent: 'center', gap: 14 },
  textPostText: { fontFamily: fonts.display, fontSize: 22, lineHeight: 30, color: colors.white },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.plum,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  bookText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.white },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  commentLine: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  replyLine: { paddingLeft: 14 },
  addComment: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  caption: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  captionAuthor: { fontFamily: fonts.semibold },
  more: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 2 },
  serviceTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.blush,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  serviceTagText: { fontFamily: fonts.medium, fontSize: 11, color: colors.wine },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  confirmCancel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  confirmRemove: { fontFamily: fonts.semibold, fontSize: 12, color: colors.wine },
});
