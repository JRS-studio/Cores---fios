import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field, ScreenHeader } from '@/components/ui';
import { useClients } from '@/features/clients/ClientsContext';
import { CommentRow } from '@/features/feed/CommentRow';
import { MAX_COMMENT, useComments } from '@/features/feed/CommentsContext';
import { postKindLabel, usePosts } from '@/features/feed/PostsContext';
import { useSession } from '@/features/session/SessionContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius } from '@/theme';
import { timeAgo } from '@/utils/date';

// Comentários de uma publicação: os aprovados para todas e, para quem pode ver, os que esperam aprovação.
export default function ComentariosScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { posts, ready } = usePosts();
  const { visibleFor, addComment, approveComment, removeComment, canRemove } = useComments();
  const { canManage, role, phone } = useSession();
  const { settings } = useSettings();
  const { findByPhone } = useClients();
  const me = role === 'cliente' && phone ? findByPhone(phone) : undefined;
  // A profissional comenta como o studio; a cliente com cadastro, com o primeiro nome; quem visita escreve o nome.
  const knownName = canManage ? settings.studioName : me?.name.split(' ')[0];
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const post = posts.find((p) => p.id === id);
  const comments = visibleFor(id);

  if (!post) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12, paddingHorizontal: 20 }]}>
        <ScreenHeader title="Comentários" />
        <Text style={styles.muted}>{ready ? 'Publicação não encontrada.' : 'Carregando…'}</Text>
      </View>
    );
  }

  const authorName = knownName ?? name.trim();
  const errors = {
    name: !knownName && authorName.length < 2 ? 'Digite seu nome.' : null,
    text: text.trim().length < 2 ? 'Escreva o comentário.' : null,
  };

  async function send() {
    setTried(true);
    if (errors.name || errors.text || sending) return;
    setSending(true);
    const ok = await addComment(post!.id, text, authorName);
    setSending(false);
    if (!ok) {
      setNotice('Não foi possível enviar agora. Confira a internet e tente de novo.');
      return;
    }
    setText('');
    setTried(false);
    setNotice(canManage ? 'Comentário publicado.' : `Comentário enviado! Ele aparece para todas depois que ${settings.professionalName} aprovar.`);
  }

  const kind = postKindLabel(post.kind);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
      >
        <ScreenHeader title="Comentários" subtitle={kind ? `${kind} · ${timeAgo(post.createdAt)}` : timeAgo(post.createdAt)} />

        {!!post.caption && (
          <View style={styles.post}>
            <Text style={styles.postText}>
              <Text style={styles.author}>{settings.studioName} </Text>
              {post.caption}
            </Text>
          </View>
        )}

        {comments.length === 0 ? (
          <Text style={styles.muted}>Ainda não há comentários. Seja a primeira!</Text>
        ) : (
          comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              canApprove={canManage && !c.approved}
              canRemove={canRemove(c)}
              onApprove={() => approveComment(c.id)}
              onRemove={() => removeComment(c.id)}
            />
          ))
        )}

        <View style={styles.form}>
          {notice && (
            <View style={styles.notice}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          )}
          {!knownName && (
            <Field
              label="Seu nome"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholder="Como quer aparecer"
              error={tried ? errors.name : null}
            />
          )}
          <Field
            label="Comentário"
            value={text}
            onChangeText={(t) => {
              setText(t);
              setNotice(null);
            }}
            placeholder={canManage ? 'Responda às clientes' : 'Escreva seu comentário'}
            multiline
            maxLength={MAX_COMMENT}
            error={tried ? errors.text : null}
            helper={canManage ? undefined : `Aparece depois que ${settings.professionalName} aprovar.`}
          />
          <Button label={sending ? 'Enviando…' : 'Comentar'} icon="send" onPress={send} disabled={sending} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginVertical: 12 },
  post: { backgroundColor: colors.white, borderRadius: radius.md, padding: 14, marginBottom: 14 },
  postText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  author: { fontFamily: fonts.semibold, color: colors.ink },
  form: { marginTop: 14, gap: 4 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E6F3EC', borderRadius: radius.sm, padding: 12, marginBottom: 10 },
  noticeText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.success },
});
