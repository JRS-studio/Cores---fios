import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chips, Field, ScreenHeader, SectionTitle, Stars, ratingLabel } from '@/components/ui';
import { designs } from '@/data/catalog';
import { persistPhoto } from '@/data/photoStorage';
import { useFeedback } from '@/features/feedback/FeedbackContext';
import { colors, fonts, radius } from '@/theme';
import { pickImage } from '@/utils/pickImage';

const MAX_COMMENT = 500;
const SERVICES = [...designs.map((d) => ({ id: d.name, label: d.name })), { id: 'Alongamento', label: 'Alongamento' }];

export default function NovaAvaliacaoScreen() {
  const insets = useSafeAreaInsets();
  const { addFeedback } = useFeedback();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [service, setService] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const errors = {
    rating: rating === 0 ? 'Escolha de 1 a 5 estrelas.' : null,
    name: !anonymous && name.trim().length < 2 ? 'Digite seu nome ou escolha publicar como anônima.' : null,
  };
  const valid = !errors.rating && !errors.name;

  async function choosePhoto(fromCamera: boolean) {
    const asset = await pickImage(fromCamera);
    if (!asset) return;
    setPhotoUri(await persistPhoto(asset, 'avaliacoes'));
  }

  function submit() {
    setSubmitted(true);
    if (!valid || saving) return;
    setSaving(true);
    addFeedback({
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      rating,
      comment: comment.trim(),
      photoUri: photoUri ?? undefined,
      displayName: anonymous ? null : name.trim(),
      service: service ?? undefined,
    });
    // Volta para a lista que já está aberta (ou a abre), sem empilhar uma cópia dela.
    router.dismissTo({ pathname: '/avaliacoes', params: { publicada: '1' } });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
      >
        <ScreenHeader title="Avaliar atendimento" subtitle="Sua opinião ajuda outras clientes" />

        <SectionTitle hint="Mostre como suas unhas ficaram.">Foto do resultado</SectionTitle>
        {photoUri ? (
          <View>
            <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" accessibilityLabel="Foto escolhida" />
            <View style={styles.photoActions}>
              <Pressable style={styles.photoAction} onPress={() => choosePhoto(false)}>
                <Ionicons name="swap-horizontal" size={16} color={colors.plum} />
                <Text style={styles.photoActionText}>Trocar</Text>
              </Pressable>
              <Pressable style={styles.photoAction} onPress={() => setPhotoUri(null)}>
                <Ionicons name="trash-outline" size={16} color={colors.wine} />
                <Text style={[styles.photoActionText, { color: colors.wine }]}>Remover</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.photoEmpty}>
            <Ionicons name="images-outline" size={30} color={colors.wine} />
            <Text style={styles.photoEmptyText}>Adicione uma foto das unhas prontas</Text>
            <View style={styles.photoButtons}>
              <Button label="Câmera" icon="camera" onPress={() => choosePhoto(true)} style={{ flex: 1 }} />
              <Button label="Galeria" icon="images-outline" variant="secondary" onPress={() => choosePhoto(false)} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        <SectionTitle>Sua nota</SectionTitle>
        <View style={styles.ratingBox}>
          <Stars value={rating} size={40} onChange={setRating} />
          <Text style={[styles.ratingLabel, !rating && { color: colors.muted }]}>
            {rating ? ratingLabel(rating) : 'Toque nas estrelas'}
          </Text>
        </View>
        {submitted && errors.rating && <Text style={styles.error}>{errors.rating}</Text>}

        <SectionTitle hint="Opcional">Serviço realizado</SectionTitle>
        <Chips options={SERVICES} selected={service ? [service] : []} onToggle={(id) => setService(service === id ? null : id)} />

        <SectionTitle>Comentário</SectionTitle>
        <Field
          label="Conte como foi"
          optional
          value={comment}
          onChangeText={(t) => setComment(t.slice(0, MAX_COMMENT))}
          placeholder="Atendimento, acabamento, durabilidade…"
          multiline
          maxLength={MAX_COMMENT}
          helper={`${comment.length}/${MAX_COMMENT}`}
        />

        <SectionTitle>Como quer aparecer?</SectionTitle>
        <View style={styles.segment}>
          {[
            { id: false, label: 'Com meu nome', icon: 'person-outline' as const },
            { id: true, label: 'Anônima', icon: 'eye-off-outline' as const },
          ].map((o) => (
            <Pressable
              key={o.label}
              style={[styles.segmentItem, anonymous === o.id && styles.segmentActive]}
              onPress={() => setAnonymous(o.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: anonymous === o.id }}
            >
              <Ionicons name={o.icon} size={16} color={anonymous === o.id ? colors.white : colors.plum} />
              <Text style={[styles.segmentText, anonymous === o.id && { color: colors.white }]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
        {anonymous ? (
          <Text style={styles.anonNote}>Sua avaliação aparece como “Cliente anônima”. Nenhum dado seu é exibido.</Text>
        ) : (
          <View style={{ marginTop: 14 }}>
            <Field
              label="Seu nome"
              value={name}
              onChangeText={setName}
              placeholder="Como quer ser identificada"
              autoCapitalize="words"
              maxLength={40}
              error={submitted ? errors.name : null}
            />
          </View>
        )}

        <Button label="Publicar avaliação" icon="send" onPress={submit} disabled={saving} style={{ marginTop: 22 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  photo: { width: '100%', aspectRatio: 4 / 5, borderRadius: radius.md, backgroundColor: colors.blush },
  photoActions: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 10 },
  photoAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  photoActionText: { fontFamily: fonts.medium, fontSize: 13, color: colors.plum },
  photoEmpty: {
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.roseGold,
    borderRadius: radius.md,
    padding: 22,
    backgroundColor: colors.white,
  },
  photoEmptyText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  photoButtons: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 4 },
  ratingBox: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.wine },
  error: { fontFamily: fonts.medium, fontSize: 12, color: '#C2410C', marginTop: 6 },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  segmentActive: { backgroundColor: colors.plum },
  segmentText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.plum },
  anonNote: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 10 },
});
