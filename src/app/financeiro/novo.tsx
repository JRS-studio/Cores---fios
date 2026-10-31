import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chips, Field, ScreenHeader, SectionTitle, OwnerOnly } from '@/components/ui';
import { PAYMENT_LABEL, type PaymentMethod } from '@/features/agenda/AppointmentsContext';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, useFinance, type TransactionType } from '@/features/finance/FinanceContext';
import { useSession } from '@/features/session/SessionContext';
import { colors, fonts, radius } from '@/theme';
import { newId } from '@/utils/id';
import { brToIso, isoToBr, today } from '@/utils/date';
import { formatDate } from '@/utils/format';

export default function NovoLancamentoScreen() {
  const { canManage } = useSession();
  return canManage ? <NovoLancamentoScreenContent /> : <OwnerOnly title="Novo lançamento" />;
}

function NovoLancamentoScreenContent() {
  const insets = useSafeAreaInsets();
  const { addTransaction } = useFinance();
  const [type, setType] = useState<TransactionType>('saida');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [date, setDate] = useState(isoToBr(today()));
  const [tried, setTried] = useState(false);

  const value = Number(amount.replace(/\./g, '').replace(',', '.'));
  const categories = type === 'entrada' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const errors = {
    amount: !(value > 0) ? 'Informe um valor maior que zero.' : null,
    description: description.trim().length < 2 ? 'Descreva o lançamento.' : null,
    category: !category ? 'Escolha a categoria.' : null,
    date: !brToIso(date) ? 'Use o formato DD/MM/AAAA.' : null,
  };

  function save() {
    setTried(true);
    if (Object.values(errors).some(Boolean) || !category) return;
    addTransaction({
      id: newId(),
      createdAt: new Date().toISOString(),
      type,
      amount: value,
      description: description.trim(),
      category,
      method: type === 'entrada' ? method : undefined,
      date: brToIso(date)!,
    });
    router.dismissTo({ pathname: '/financeiro', params: { lancado: '1' } });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
      >
        <ScreenHeader title="Novo lançamento" subtitle="Atendimentos concluídos na agenda entram sozinhos" />

        <View style={styles.segment}>
          {(
            [
              ['saida', 'Saída (despesa)'],
              ['entrada', 'Entrada'],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              style={[styles.segmentItem, type === id && styles.segmentActive]}
              onPress={() => {
                setType(id);
                setCategory(null);
              }}
            >
              <Text style={[styles.segmentText, type === id && { color: colors.white }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: 18 }}>
          <Field
            label="Valor (R$)"
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^\d,]/g, ''))}
            placeholder="0,00"
            keyboardType="decimal-pad"
            error={tried ? errors.amount : null}
          />
          <Field
            label="Descrição"
            value={description}
            onChangeText={setDescription}
            placeholder={type === 'saida' ? 'Ex.: Kit de esmaltes em gel' : 'Ex.: Venda de óleo de cutícula'}
            maxLength={60}
            error={tried ? errors.description : null}
          />
          <Field
            label="Data"
            value={date}
            onChangeText={(t) => setDate(formatDate(t))}
            placeholder="DD/MM/AAAA"
            keyboardType="number-pad"
            error={tried ? errors.date : null}
          />
        </View>

        <SectionTitle>Categoria</SectionTitle>
        <Chips options={categories.map((c) => ({ id: c, label: c }))} selected={category ? [category] : []} onToggle={setCategory} />
        {tried && errors.category && <Text style={styles.error}>{errors.category}</Text>}

        {type === 'entrada' && (
          <>
            <SectionTitle>Forma de pagamento</SectionTitle>
            <Chips
              options={(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((m) => ({ id: m, label: PAYMENT_LABEL[m] }))}
              selected={[method]}
              onToggle={(m) => setMethod(m as PaymentMethod)}
            />
          </>
        )}

        <Button label="Salvar lançamento" icon="checkmark" onPress={save} style={{ marginTop: 26 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.plum },
  segmentText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.plum },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: 6 },
});
