// Dados de exemplo da página de teste: gerados no navegador, com datas relativas a hoje.
// Clientes fictícias; não há avaliações de exemplo (para não inventar opiniões).
(function () {
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var day = function (offset) { var d = new Date(); d.setDate(d.getDate() + offset); return d; };
  var now = new Date();
  var thisMonth = pad(now.getMonth() + 1);
  var nowIso = now.toISOString();

  var clients = [
    { id: 'demo-mariana', plan: 'premium', createdAt: day(-120).toISOString(), name: 'Mariana Alves', phone: '11987650001', phoneVerified: true,
      privacyConsent: true, remindersConsent: true, email: 'mariana.alves@email.com', birthDate: '14/03/1992',
      contactChannel: 'whatsapp', preferredShape: 'amendoada', preferredLength: 'media', favoriteColors: ['vinho', 'nude-rose'],
      preferredPeriods: ['Tarde'], referralSource: 'Instagram', healthConsent: true, allergies: ['Acetona'], healthConditions: [],
      healthNotes: '', loyalty: { stamps: 7, totalVisits: 12, rewardsRedeemed: 1 } },
    { id: 'demo-ana', plan: 'premium', createdAt: day(-40).toISOString(), name: 'Ana Souza', phone: '11976540002', phoneVerified: true,
      privacyConsent: true, remindersConsent: true, email: 'ana.souza@email.com', birthDate: '22/' + thisMonth + '/1998',
      contactChannel: 'whatsapp', preferredShape: 'quadrada', preferredLength: 'curta', favoriteColors: ['rubi', 'noir'],
      preferredPeriods: ['Manhã', 'Sábado'], referralSource: 'Indicação de amiga', referredBy: 'Mariana Alves',
      healthConsent: false, allergies: [], healthConditions: [], healthNotes: '', loyalty: { stamps: 3, totalVisits: 3, rewardsRedeemed: 0 } },
    { id: 'demo-camila', plan: 'rapido', createdAt: day(-25).toISOString(), name: 'Camila Rocha', phone: '21998760003', phoneVerified: true, privacyConsent: true, remindersConsent: true },
    { id: 'demo-leticia', plan: 'rapido', createdAt: day(-10).toISOString(), name: 'Letícia Prado', phone: '31991230004', privacyConsent: true, remindersConsent: false },
  ];

  var services = [
    ['manicure', 'Manicure tradicional', 35, 45], ['gel', 'Esmaltação em gel', 70, 60], ['mao-pe', 'Mão e pé', 70, 90],
    ['alongamento', 'Alongamento em fibra', 160, 120], ['manutencao', 'Manutenção de alongamento', 100, 90],
    ['nail-art', 'Nail art', 95, 75], ['pedicure', 'Pedicure', 40, 50],
  ];
  var methods = ['pix', 'pix', 'pix', 'credito', 'debito', 'dinheiro'];
  var times = ['09:00', '10:30', '13:00', '14:30', '16:00', '17:30'];
  var appointments = [];
  var transactions = [];
  var n = 0;
  var add = function (offset, time, ci, si, status) {
    var c = clients[ci], s = services[si], date = iso(day(offset)), id = 'demo-a' + (n++);
    var a = { id: id, createdAt: nowIso, clientId: c.id, clientName: c.name, clientPhone: c.phone, serviceId: s[0], serviceName: s[1],
      price: s[2], duration: s[3], date: date, time: time, status: status };
    if (status === 'concluido') {
      a.paidAmount = s[2]; a.paymentMethod = methods[n % methods.length];
      transactions.push({ id: 'demo-t' + n, createdAt: nowIso, type: 'entrada', amount: s[2], description: s[1] + ' · ' + c.name,
        category: 'Atendimento', method: a.paymentMethod, date: date, appointmentId: id });
    }
    appointments.push(a);
  };
  // Últimos 35 dias: atendimentos concluídos (com algumas faltas e cancelamentos).
  for (var d = -35; d <= -1; d++) {
    if (day(d).getDay() === 0) continue;
    var count = 1 + (Math.abs(d * 7) % 3);
    for (var k = 0; k < count; k++) {
      var status = (d + k) % 13 === 0 ? 'faltou' : (d + k) % 17 === 0 ? 'cancelado' : 'concluido';
      add(d, times[(k * 2 + (d & 1)) % times.length], Math.abs(d + k) % 4, Math.abs(d * 3 + k) % services.length, status);
    }
  }
  // Hoje e próximos dias.
  if (day(0).getDay() !== 0) { add(0, '10:30', 0, 1, 'confirmado'); add(0, '14:30', 2, 0, 'agendado'); add(0, '16:30', 1, 3, 'agendado'); }
  if (day(1).getDay() !== 0) { add(1, '09:00', 3, 2, 'agendado'); add(1, '13:00', 1, 5, 'confirmado'); }
  if (day(3).getDay() !== 0) { add(3, '16:00', 0, 4, 'agendado'); }
  if (day(5).getDay() !== 0) { add(5, '10:30', 2, 1, 'agendado'); }

  // Despesas do mês atual e do anterior.
  var expense = function (offset, amount, description, category) {
    transactions.push({ id: 'demo-e' + (n++), createdAt: nowIso, type: 'saida', amount: amount, description: description, category: category, date: iso(day(offset)) });
  };
  var first = new Date(now.getFullYear(), now.getMonth(), 1);
  var sinceFirst = Math.round((now - first) / 86400000);
  expense(-sinceFirst, 800, 'Aluguel da sala', 'Aluguel');
  expense(-Math.min(sinceFirst, 3), 320, 'Kit de esmaltes em gel', 'Materiais');
  expense(-Math.min(sinceFirst, 2), 210, 'Luz e internet', 'Contas');
  expense(-Math.min(sinceFirst, 1), 90, 'Impulsionamento no Instagram', 'Marketing');
  expense(-sinceFirst - 1, 800, 'Aluguel da sala', 'Aluguel');
  expense(-sinceFirst - 12, 180, 'Lixas, algodão e acetona', 'Materiais');

  window.__CORES_DEMO_SEED__ = {
    'cores:clients:v1': clients,
    'cores:appointments:v1': appointments,
    'cores:transactions:v1': transactions,
  };
})();
