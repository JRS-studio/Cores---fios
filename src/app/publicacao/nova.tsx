import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chips, Field, OwnerOnly, ScreenHeader, SectionTitle } from '@/components/ui';
import { storePhoto } from '@/data/photoUpload';
import { MAX_POST_PHOTOS, POST_KINDS, usePosts, type PostKind } from '@/features/feed/PostsContext';
import { useSession } from '@/features/session/SessionContext';
import { colors, fonts, radius } from '@/theme';
import { newId } from '@/utils/id';
import { pickImage } from '@/utils/pickImage';

const MAX_CAPTION = 1000;

export default function NovaPublicacaoScreen() {
  const { canManage } = useSession();
  return canManage ? <NovaPublicacaoContent /> : <OwnerOnly title="Nova publicação" />;
}

function NovaPublicacaoContent() {
  const insets = useSafeAreaInsets();
  const { addPost } = usePosts();
  const [photos, setPhotos] = useState<string[]>([]);
  const [kind, setKind] = useState<PostKind>('trabalho');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  const error = !photos.length && caption.trim().length < 3 ? 'Adicione uma foto ou escreva o texto da publicação.' : null;

  async function addPhoto(fromCamera: boolean) {
    const asset = await pickImage(fromCamera);
    if (!asset) return;
    setUploading(true);
    const uri = await storePhoto(asset, 'publicacoes');
    setUploading(false);
    if (uri) setPhotos((list) => [...list, uri].slice(0, MAX_POST_PHOTOS));
  }

  async function publish() {
    setTried(true);
    if (error || saving || uploading) return;
    setSaving(true);
    const ok = await addPost({ id: newId(), createdAt: new Date().toISOString(), kind, caption: caption.trim(), photos });
    setSaving(false);
    if (ok) router.dismissTo('/');
  }

  const canAddMore = photos.length < MAX_POST_PHOTOS;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
      >
        <ScreenHeader title="Nova publicação" subtitle="Aparece para as clientes na página inicial" />

        <SectionTitle hint={`Até ${MAX_POST_PHOTOS} fotos. As clientes passam para o lado para ver todas.`}>Fotos</SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
          {photos.map((uri, i) => (
            <View key={uri}>
              <Image source={{ uri }} style={styles.thumb} accessibilityLabel={`Foto ${i + 1}`} />
              <Pressable
                style={styles.thumbRemove}
                onPress={() => setPhotos(photos.filter((p) => p !== uri))}
                hitSlop={6}
                accessibilityLabel={`Remover foto ${i + 1}`}
              >
                <Ionicons name="close" size={14} color={colors.white} />
              </Pressable>
              {i === 0 && photos.length > 1 && (
                <View style={styles.cover}>
                  <Text style={styles.coverText}>Capa</Text>
                </View>
              )}
            </View>
          ))}
          {uploading && (
            <View style={[styles.thumb, styles.addTile]}>
              <ActivityIndicator color={colors.wine} />
            </View>
          )}
          {canAddMore && !uploading && (
            <>
              <Pressable style={[styles.thumb, styles.addTile]} onPress={() => addPhoto(true)}>
                <Ionicons name="camera-outline" size={24} color={colors.wine} />
                <Text style={styles.addText}>Câmera</Text>
              </Pressable>
              <Pressable style={[styles.thumb, styles.addTile]} onPress={() => addPhoto(false)}>
                <Ionicons name="images-outline" size={24} color={colors.wine} />
                <Text style={styles.addText}>Galeria</Text>
              </Pressable>
            </>
          )}
        </ScrollView>

        <SectionTitle>Tipo</SectionTitle>
        <Chips options={POST_KINDS.map((k) => ({ id: k.id, label: k.label }))} selected={[kind]} onToggle={(id) => setKind(id as PostKind)} />

        <SectionTitle hint={photos.length ? 'Opcional' : 'Sem foto, o texto aparece em destaque.'}>Texto</SectionTitle>
        <Field
          label="Legenda"
          value={caption}
          onChangeText={(t) => setCaption(t.slice(0, MAX_CAPTION))}
          placeholder={
            kind === 'promocao'
              ? 'Ex.: Pé e mão por R$ 60 nesta semana!'
              : kind === 'aviso'
                ? 'Ex.: Feriado: atendimento até 14h.'
                : 'Conte sobre o trabalho, cores usadas…'
          }
          multiline
          maxLength={MAX_CAPTION}
          helper={`${caption.length}/${MAX_CAPTION}`}
        />

        {tried && error && <Text style={styles.error}>{error}</Text>}
        <Button label={saving ? 'Publicando…' : 'Publicar'} icon="send" onPress={publish} disabled={saving || uploading} style={{ marginTop: 22 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  photoRow: { gap: 10, paddingVertical: 2 },
  thumb: { width: 104, height: 130, borderRadius: radius.sm, backgroundColor: colors.blush },
  thumbRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(43,18,32,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: 'rgba(43,18,32,0.7)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  coverText: { fontFamily: fonts.medium, fontSize: 10, color: colors.white },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.roseGold,
    backgroundColor: colors.white,
  },
  addText: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: 10 },
});
