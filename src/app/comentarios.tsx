import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OwnerOnly, ScreenHeader } from '@/components/ui';
import { CommentRow } from '@/features/feed/CommentRow';
import { useComments } from '@/features/feed/CommentsContext';
import { usePosts } from '@/features/feed/PostsContext';
import { useSession } from '@/features/session/SessionContext';
import { colors, fonts } from '@/theme';

// Comentários das publicações esperando a aprovação da profissional.
export default function ComentariosParaAprovarScreen() {
  const { canManage } = useSession();
  return canManage ? <PendingList /> : <OwnerOnly title="Comentários para aprovar" />;
}

function PendingList() {
  const insets = useSafeAreaInsets();
  const { pending, approveComment, removeComment } = useComments();
  const { posts } = usePosts();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
    >
      <ScreenHeader title="Comentários para aprovar" subtitle="Só aparecem nas publicações depois que você aprovar" />
      {pending.length === 0 && <Text style={styles.muted}>Nenhum comentário esperando aprovação.</Text>}
      {pending.map((c) => {
        const post = posts.find((p) => p.id === c.postId);
        return (
          <View key={c.id}>
            <Pressable onPress={() => router.push({ pathname: '/publicacao/[id]', params: { id: c.postId } })} hitSlop={4}>
              <Text style={styles.post} numberOfLines={1}>
                Na publicação: {post?.caption || 'publicação removida'}
              </Text>
            </Pressable>
            <CommentRow
              comment={c}
              canApprove
              canRemove
              onApprove={() => approveComment(c.id)}
              onRemove={() => removeComment(c.id)}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 12 },
  post: { fontFamily: fonts.medium, fontSize: 12, color: colors.wine, marginBottom: 6, marginTop: 6 },
});
