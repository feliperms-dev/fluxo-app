'use strict';

// ─── DATA ENGINE ───
// ─── PERSISTÊNCIA: localStorage é a fonte primária; Firestore é backup de nuvem ───
function loadData(callback) {
  if (currentUser && !currentUser.email && useFirebase && firebase.auth().currentUser) {
    currentUser.email = firebase.auth().currentUser.email;
  }
  if (currentUser && currentUser.email) {
    currentUser.email = currentUser.email.toLowerCase().trim();
  }

  const profileFields = ['nome','sobrenome','nascimento','cpf','telefone','profissao','salario','geminiKey','metaReserva','orcamentoDiario','reservaMeses','diarioBreakdown'];

  // PASSO 1: Carrega imediatamente do localStorage
  const localDataStr = localStorage.getItem(`pland_data_${getEmailKey()}`);
  const localData = localDataStr ? (() => { try { return JSON.parse(localDataStr); } catch(e) { return null; } })() : null;
  const localLastUpdated = (localData && localData.lastUpdated) ? localData.lastUpdated : 0;

  // Restaura perfil local
  if (currentUser && currentUser.email) {
    const localProfile = localStorage.getItem('pland_profile_' + getEmailKey());
    if (localProfile) {
      const pData = (() => { try { return JSON.parse(localProfile); } catch(e) { return {}; } })();
      profileFields.forEach(f => { if (pData[f] !== undefined) currentUser[f] = pData[f]; });
    }
  }

  // Inicializa appData com dados locais imediatamente
  if (localData && (localData.transacoes || localData.saldoInicial !== undefined)) {
    appData = {
      saldoInicial: localData.saldoInicial !== undefined ? localData.saldoInicial : 0,
      transacoes: localData.transacoes || [],
      lastUpdated: localLastUpdated
    };
  } else {
    appData = { saldoInicial: 0, transacoes: [], lastUpdated: 0 };
  }

  if (useFirebase && currentUser && currentUser.uid) {
    // PASSO 2: Tenta sincronizar com Firestore em background (sem bloquear a UI)
    if (callback && typeof callback === 'function') callback();

    firebase.firestore().collection('users').doc(currentUser.uid).get()
      .then(doc => {
        if (doc.exists) {
          const data = doc.data();
          const dbTransacoes = data.transacoes || [];
          const dbLastUpdated = data.lastUpdated || 0;

          // Lógica de merge: prefere a versão mais recente
          const localTxCount = (localData && localData.transacoes) ? localData.transacoes.length : 0;
          const dbTxCount = dbTransacoes.length;

          const useLocal = localData && localData.transacoes && (
            localLastUpdated > dbLastUpdated ||
            (localLastUpdated === dbLastUpdated && localTxCount >= dbTxCount) ||
            (localTxCount > 0 && dbTxCount === 0)
          );

          if (useLocal) {
            appData = {
              saldoInicial: localData.saldoInicial !== undefined ? localData.saldoInicial : (data.saldoInicial || 0),
              transacoes: localData.transacoes,
              lastUpdated: localLastUpdated
            };
            console.log(`[DinDimpass] Local mais recente (${localTxCount} tx). Sincronizando no Firestore...`);
            firebase.firestore().collection('users').doc(currentUser.uid).set({
              transacoes: appData.transacoes,
              saldoInicial: appData.saldoInicial || 0,
              lastUpdated: appData.lastUpdated,
              email: currentUser.email || ''
            }, { merge: true }).catch(err => console.error('[DinDimpass] Erro sync Firestore:', err));
          } else if (dbTxCount > localTxCount) {
            appData = {
              saldoInicial: data.saldoInicial || 0,
              transacoes: dbTransacoes,
              lastUpdated: dbLastUpdated
            };
            console.log(`[DinDimpass] Firestore mais completo (${dbTxCount} tx). Atualizando localStorage e UI...`);
            localStorage.setItem(`pland_data_${getEmailKey()}`, JSON.stringify(appData));
            
            // Re-renderiza a página ativa
            try {
              const activePage = document.querySelector('.page.active');
              if (activePage) {
                const pageId = activePage.id.replace('page-', '');
                if (pageId === 'dash') renderDash();
                else if (pageId === 'semanal') renderSemanal();
                else if (pageId === 'mensal') renderMensal();
                else if (pageId === 'anual') renderAnual();
                else if (pageId === 'horizonte') renderHorizonte();
                else if (pageId === 'totais') renderTotais();
              }
            } catch(e) { console.warn('[DinDimpass] Re-render após sync:', e); }
          } else {
            console.log(`[DinDimpass] Dados sincronizados (${dbTxCount} tx).`);
          }

          // Restaura perfil do usuário
          profileFields.forEach(f => { if (data[f] !== undefined) currentUser[f] = data[f]; });
          localStorage.setItem('pland_profile_' + getEmailKey(), JSON.stringify(currentUser));
          if (currentUser.geminiKey)
            localStorage.setItem('gemini_api_key_' + getEmailKey(), currentUser.geminiKey);

          const displayName = (currentUser.nome || currentUser.email.split('@')[0]) + (currentUser.sobrenome ? ' ' + currentUser.sobrenome : '');
          const uiName = $('ui-name');
          if (uiName) uiName.textContent = displayName;
          const uiAvatar = $('ui-avatar');
          if (uiAvatar) uiAvatar.textContent = (currentUser.nome || currentUser.email).charAt(0).toUpperCase();
        } else {
          if (localData && localData.transacoes && localData.transacoes.length > 0) {
            console.log('[DinDimpass] Documento inexistente no Firestore. Sincronizando backup local...');
            firebase.firestore().collection('users').doc(currentUser.uid).set({
              transacoes: appData.transacoes,
              saldoInicial: appData.saldoInicial || 0,
              lastUpdated: appData.lastUpdated || Date.now(),
              email: currentUser.email || ''
            }, { merge: true }).catch(err => console.error('[DinDimpass] Erro ao criar doc Firestore:', err));
          }
        }
      })
      .catch(err => {
        console.error('[DinDimpass] Firestore indisponível, usando localStorage:', err.message || err);
      });
  } else {
    const localKey = localStorage.getItem('gemini_api_key_' + getEmailKey());
    if (localKey) currentUser.geminiKey = localKey;
    if (callback && typeof callback === 'function') callback();
  }
}

function saveData() {
  if (currentUser) {
    if (!currentUser.email && useFirebase && firebase.auth().currentUser) {
      currentUser.email = firebase.auth().currentUser.email;
    }
    if (currentUser.email) {
      currentUser.email = currentUser.email.toLowerCase().trim();
    }
    iaInsightsCached = null;
    appData.lastUpdated = Date.now();
    localStorage.setItem(`pland_data_${getEmailKey()}`, JSON.stringify(appData));
    if (useFirebase && currentUser.uid) {
      firebase.firestore().collection('users').doc(currentUser.uid).set({
        transacoes: appData.transacoes,
        saldoInicial: appData.saldoInicial || 0,
        lastUpdated: appData.lastUpdated,
        email: currentUser.email || ''
      }, { merge: true }).catch(err => console.error('Erro ao salvar transacoes no Firestore:', err));
    }
  }
}

function saveUserProfile() {
  if (!currentUser) return;
  if (currentUser.email) {
    currentUser.email = currentUser.email.toLowerCase().trim();
  }

  const profileData = {
    nome:            currentUser.nome            || '',
    sobrenome:       currentUser.sobrenome       || '',
    nascimento:      currentUser.nascimento      || '',
    cpf:             currentUser.cpf             || '',
    telefone:        currentUser.telefone        || '',
    profissao:       currentUser.profissao       || '',
    salario:         currentUser.salario         || 0,
    geminiKey:       currentUser.geminiKey       || '',
    email:           currentUser.email           || '',
    metaReserva:     currentUser.metaReserva     || 0,
    orcamentoDiario: currentUser.orcamentoDiario || 0,
    reservaMeses:    currentUser.reservaMeses    || 6,
    diarioBreakdown: currentUser.diarioBreakdown || { comida: 0, transporte: 0, lazer: 0, compras: 0, saude: 0, outros: 0 }
  };

  localStorage.setItem('pland_profile_' + getEmailKey(), JSON.stringify(profileData));
  
  const users = loadUsers();
  const idx = users.findIndex(u => u.email.toLowerCase().trim() === getEmailKey());
  if (idx !== -1) {
    users[idx] = { ...users[idx], ...profileData };
  } else {
    users.push({ ...profileData });
  }
  saveUsers(users);

  if (currentUser.geminiKey)
    localStorage.setItem('gemini_api_key_' + getEmailKey(), currentUser.geminiKey);

  if (useFirebase && currentUser.uid) {
    firebase.firestore().collection('users').doc(currentUser.uid)
      .set(profileData, { merge: true })
      .catch(err => console.error('Erro ao salvar perfil no Firestore:', err));
  }
}

function saveFirebaseConfig() {
  const apiKey = $('fb-api-key').value.trim();
  const authDomain = $('fb-auth-domain').value.trim();
  const projectId = $('fb-project-id').value.trim();
  const appId = $('fb-app-id').value.trim();
  
  if (!apiKey || apiKey === 'SUA_API_KEY') {
    localStorage.removeItem('pland_firebase_config');
    toast("Configuração do Firebase removida. Modo local ativo.");
    setTimeout(() => location.reload(), 1500);
    return;
  }
  
  const config = {
    apiKey,
    authDomain,
    projectId,
    storageBucket: `${projectId}.appspot.com`,
    messagingSenderId: "",
    appId
  };
  
  localStorage.setItem('pland_firebase_config', JSON.stringify(config));
  toast("Configurações salvas! Reiniciando para conectar...");
  setTimeout(() => location.reload(), 1500);
}

function isNthWeekdayOfMonth(d, semanaMes, diaSemanaMes) {
  if (d.getDay() !== diaSemanaMes) return false;
  if (semanaMes === 'L') {
    const nextWeek = new Date(d);
    nextWeek.setDate(d.getDate() + 7);
    return nextWeek.getMonth() !== d.getMonth();
  } else {
    const nth = parseInt(semanaMes);
    return Math.ceil(d.getDate() / 7) === nth;
  }
}

function getSaldoAntesDe(targetDate) {
  const prevEnd = new Date(targetDate);
  prevEnd.setHours(0,0,0,0);
  prevEnd.setDate(prevEnd.getDate() - 1);
  prevEnd.setHours(23,59,59,999);
  
  const pastInsts = getInstances(new Date(2000, 0, 1), prevEnd);
  let balance = 0;
  pastInsts.forEach(x => {
    const isCredit = x.formaPagamento === 'Crédito';
    if (isCredit) {
      balance -= x.valor;
    } else {
      if (x.tipo === 'entrada') balance += x.valor;
      else balance -= x.valor;
    }
  });
  return balance;
}

function getInstances(startDate, endDate) {
  const instances = [];
  if (!appData || !appData.transacoes) return instances;
  const start = new Date(startDate); start.setHours(0,0,0,0);
  const end = new Date(endDate); end.setHours(23,59,59,999);

  appData.transacoes.forEach(tx => {
    if (!tx || !tx.data) return;
    const txDate = parseDt(tx.data); txDate.setHours(0,0,0,0);

    // ── Pontual ──
    if (tx.frequencia === 'none') {
      if (txDate >= start && txDate <= end)
        instances.push(Object.assign({}, tx, { instanceDate: new Date(txDate) }));
      return;
    }

    // ── Diária ──
    if (tx.frequencia === 'diaria') {
      let cur = new Date(Math.max(txDate, start));
      while (cur <= end) { instances.push(Object.assign({}, tx, { instanceDate: new Date(cur) })); cur.setDate(cur.getDate()+1); }
      return;
    }

    // ── Semanal ──
    if (tx.frequencia === 'semanal') {
      let cur = new Date(txDate);
      while (cur <= end) { if (cur >= start) instances.push(Object.assign({}, tx, { instanceDate: new Date(cur) })); cur.setDate(cur.getDate()+7); }
      return;
    }

    // ── Quinzenal ──
    if (tx.frequencia === 'quinzenal') {
      let cur = new Date(txDate);
      while (cur <= end) { if (cur >= start) instances.push(Object.assign({}, tx, { instanceDate: new Date(cur) })); cur.setDate(cur.getDate()+14); }
      return;
    }

    // ── Mensal ──
    if (tx.frequencia === 'mensal') {
      const originalDay = parseDt(tx.data).getDate();
      let curYear = parseDt(tx.data).getFullYear();
      let curMonthIdx = parseDt(tx.data).getMonth();
      while (true) {
        const lastDay = new Date(curYear, curMonthIdx + 1, 0).getDate();
        const clampedDay = Math.min(originalDay, lastDay);
        const cur = new Date(curYear, curMonthIdx, clampedDay);
        cur.setHours(0, 0, 0, 0);
        if (cur > end) break;
        if (cur >= start && cur >= txDate) instances.push(Object.assign({}, tx, { instanceDate: new Date(cur) }));
        curMonthIdx++;
        if (curMonthIdx > 11) { curMonthIdx = 0; curYear++; }
      }
      return;
    }

    // ── Recorrência Customizada ──
    if (tx.frequencia === 'custom' && tx.recurrence) {
      const rec = tx.recurrence;
      const dataFim = rec.dataFim ? new Date(rec.dataFim) : new Date('2099-12-31');
      dataFim.setHours(23,59,59,999);
      const loopEnd = new Date(Math.min(end.getTime(), dataFim.getTime()));

      const unit = rec.unit || 'dias';
      const interval = Math.max(1, parseInt(rec.interval) || 1);
      const maxParcelas = rec.parcelas || Infinity;
      let parcelasCount = 0;

      if (unit === 'dias') {
        let cur = new Date(txDate);
        while (cur <= loopEnd && parcelasCount < maxParcelas) {
          if (cur >= start) { instances.push(Object.assign({}, tx, { instanceDate: new Date(cur) })); parcelasCount++; }
          else if (cur >= txDate) parcelasCount++;
          cur.setDate(cur.getDate() + interval);
        }
      } else if (unit === 'semanas') {
        const weekdays = Array.isArray(rec.weekdays) && rec.weekdays.length ? rec.weekdays : [txDate.getDay()];
        let weekStart = new Date(txDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        weekStart.setHours(0,0,0,0);
        let cycleWeek = new Date(weekStart);
        while (cycleWeek <= loopEnd && parcelasCount < maxParcelas) {
          for (const wd of weekdays.sort((a,b) => a-b)) {
            const dayOffset = (wd - 1 + 7) % 7;
            const candidate = new Date(cycleWeek); candidate.setDate(cycleWeek.getDate() + dayOffset);
            if (candidate >= txDate && candidate >= start && candidate <= loopEnd && parcelasCount < maxParcelas) {
              instances.push(Object.assign({}, tx, { instanceDate: new Date(candidate) })); parcelasCount++;
            }
          }
          cycleWeek.setDate(cycleWeek.getDate() + interval * 7);
        }
      } else if (unit === 'meses') {
        const monthdays = Array.isArray(rec.monthdays) && rec.monthdays.length ? rec.monthdays : [txDate.getDate()];
        let curMonth = new Date(txDate.getFullYear(), txDate.getMonth(), 1);
        while (curMonth <= loopEnd && parcelasCount < maxParcelas) {
          for (const md of monthdays.sort((a,b) => a-b)) {
            const lastDay = new Date(curMonth.getFullYear(), curMonth.getMonth()+1, 0).getDate();
            const targetDay = Math.min(md, lastDay);
            const candidate = new Date(curMonth.getFullYear(), curMonth.getMonth(), targetDay);
            if (candidate >= txDate && candidate >= start && candidate <= loopEnd && parcelasCount < maxParcelas) {
              instances.push(Object.assign({}, tx, { instanceDate: new Date(candidate) })); parcelasCount++;
            }
          }
          curMonth.setMonth(curMonth.getMonth() + interval);
        }
      }
      return;
    }
  });

  // Gerador dinâmico de orçamento diário (Tipo "Diário")
  let totalMensalProjetado = 0;
  let hasDiarioBreakdown = false;

  if (currentUser && currentUser.diarioBreakdown) {
    const db = currentUser.diarioBreakdown;
    totalMensalProjetado = (parseFloat(db.comida) || 0) + 
                           (parseFloat(db.transporte) || 0) + 
                           (parseFloat(db.lazer) || 0) + 
                           (parseFloat(db.compras) || 0) + 
                           (parseFloat(db.saude) || 0) + 
                           (parseFloat(db.outros) || 0);
    if (totalMensalProjetado > 0) {
      hasDiarioBreakdown = true;
    }
  }

  // Fallback para o valor legado
  const orcamentoLegado = currentUser ? (parseFloat(currentUser.orcamentoDiario) || 0) : 0;

  if (hasDiarioBreakdown || orcamentoLegado > 0) {
    const today = new Date(); today.setHours(0,0,0,0);
    let curDay = new Date(start);
    if (curDay < today) {
      curDay = new Date(today);
    }
    while (curDay <= end) {
      const y = curDay.getFullYear();
      const m = curDay.getMonth();
      const totalDaysInMonth = new Date(y, m + 1, 0).getDate();
      
      let dailyBudget = 0;
      if (hasDiarioBreakdown) {
        dailyBudget = totalMensalProjetado / totalDaysInMonth;
      } else {
        dailyBudget = orcamentoLegado;
      }

      if (dailyBudget > 0) {
        instances.push({
          id: 'dynamic-diario-' + dtKey(curDay),
          tipo: 'diario',
          valor: dailyBudget,
          desc: 'Orçamento Diário',
          data: dtKey(curDay),
          frequencia: 'none',
          macro: 'Variáveis',
          formaPagamento: 'Dinheiro',
          instanceDate: new Date(curDay)
        });
      }
      curDay.setDate(curDay.getDate() + 1);
    }
  }

  return instances;
}
