import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import type { Comment } from '@/features/feed/CommentsContext';
import { colors, fonts, radius } from '@/theme';
import { timeAgo } from '@/utils/date';

// Um comentário de publicação, com aprovar/recusar para a profissional e apagar para quem pode.
export function CommentRow({
  comment: c,
  canApprove,
  canRemove,
  onApprove,
  onRemove,
  onReply,
  reply,
  children,
}: {
  comment: Comment;
  canApprove: boolean;
  canRemove: boolean;
  onApprove: () => void;
  onRemove: () => void;
  // A profissional responde (só em comentários já aprovados).
  onReply?: () => void;
  // Resposta mostrada dentro do comentário, recuada.
  reply?: boolean;
  // Respostas e caixa de resposta, abaixo do comentário.
  children?: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <View style={[reply ? styles.reply : styles.comment, !c.approved && styles.commentPending]}>
      <View style={styles.commentTop}>
        <View style={[styles.avatar, c.fromStudio && styles.avatarStudio]}>
          <Text style={[styles.avatarText, c.fromStudio && { color: colors.roseGoldLight }]}>{c.name.trim()[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.commentText}>
            <Text style={styles.author}>{c.name} </Text>
            {c.text}
          </Text>
          <Text style={styles.meta}>
            {timeAgo(c.createdAt)}
            {!c.approved ? ' · Aguardando aprovação' : ''}
          </Text>
        </View>
      </View>
      {confirming ? (
        <View style={styles.row}>
          <Text style={styles.confirmText}>{canApprove ? 'Recusar' : 'Apagar'} este comentário?</Text>
          <Pressable onPress={() => setConfirming(false)} hitSlop={6}>
            <Text style={styles.link}>Cancelar</Text>
          </Pressable>
          <Pressable onPress={onRemove} hitSlop={6}>
            <Text style={[styles.link, { color: colors.danger }]}>{canApprove ? 'Recusar' : 'Apagar'}</Text>
          </Pressable>
        </View>
      ) : canApprove ? (
        <View style={styles.row}>
          <Button label="Aprovar" icon="checkmark-circle-outline" onPress={onApprove} style={{ flex: 1 }} />
          <Button label="Recusar" icon="close-circle-outline" variant="secondary" onPress={() => setConfirming(true)} style={{ flex: 1 }} />
        </View>
      ) : (
        (onReply || canRemove) && (
          <View style={styles.links}>
            {onReply && (
              <Pressable onPress={onReply} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Responder ${c.name}`}>
                <Text style={styles.link}>Responder</Text>
              </Pressable>
            )}
            {canRemove && (
              <Pressable onPress={() => setConfirming(true)} hitSlop={6}>
                <Text style={styles.link}>Apagar</Text>
              </Pressable>
            )}
          </View>
        )
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  comment: { backgroundColor: colors.white, borderRadius: radius.md, padding: 12, marginBottom: 10, gap: 10 },
  reply: { backgroundColor: colors.cream, borderRadius: radius.sm, padding: 10, gap: 8, marginLeft: 20 },
  links: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18 },
  commentPending: { borderWidth: 1, borderColor: colors.roseGold, backgroundColor: colors.blush },
  commentTop: { flexDirection: 'row', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  avatarStudio: { backgroundColor: colors.plum },
  avatarText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.wine },
  commentText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  author: { fontFamily: fonts.semibold, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  confirmText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.wine },
});
