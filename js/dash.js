'use strict';

let iaInsightsCached = null;

function renderDash() {
  const displayName = currentUser && currentUser.nome ? currentUser.nome.split(' ')[0] : 'Usuário';
  if ($('dash-greeting')) $('dash-greeting').textContent = `Olá, ${displayName}!`;
  
  const dashStreak = $('dash-streak-count');
  if (dashStreak) dashStreak.textContent = appData.streakCount || 1;
  
  const today = new Date();
  const dayStr = today.getDate();
  const monthStr = today.toLocaleDateString('pt-BR', { month: 'long' });
  const yearStr = today.getFullYear();
  const formattedDate = `${dayStr} de ${monthStr.charAt(0).toUpperCase() + monthStr.slice(1)} de ${yearStr}`;
  if ($('dash-subtitle')) $('dash-subtitle').textContent = `Seu resumo financeiro atual — ${formattedDate}`;

  const y = curDate.getFullYear(); const m = curDate.getMonth();
  const start = new Date(y, m, 1); const end = new Date(y, m+1, 0);
  const insts = getInstances(start, end);
  let ent=0, sai=0;
  insts.forEach(i => { if(i.tipo==='entrada') ent+=i.valor; else sai+=i.valor; });
  
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const allPastToday = getInstances(new Date(2000, 0, 1), todayEnd);
  let totalEntToday = 0, totalSaiToday = 0;
  allPastToday.forEach(i => { if(i.tipo==='entrada') totalEntToday+=i.valor; else totalSaiToday+=i.valor; });
  const saldoToday = appData.saldoInicial + totalEntToday - totalSaiToday;
  
  if ($('dash-ent')) $('dash-ent').textContent = fmt(ent); 
  if ($('dash-sai')) $('dash-sai').textContent = fmt(sai);
  if ($('dash-saldo')) $('dash-saldo').textContent = fmt(saldoToday);
  
  const alertBox = $('dash-balance-alert');
  if (alertBox) {
    if (saldoToday < 0) {
      alertBox.style.display = 'block';
      alertBox.style.backgroundColor = 'rgba(255, 59, 48, 0.1)';
      alertBox.style.color = 'var(--apple-red)';
      alertBox.style.border = '1px solid rgba(255, 59, 48, 0.2)';
      alertBox.textContent = 'Atenção: Seu saldo está negativo. Evite fazer novos gastos para manter suas finanças sob controle.';
    } else if (saldoToday > 0) {
      alertBox.style.display = 'block';
      alertBox.style.backgroundColor = 'rgba(52, 199, 89, 0.1)';
      alertBox.style.color = 'var(--apple-green)';
      alertBox.style.border = '1px solid rgba(52, 199, 89, 0.2)';
      alertBox.textContent = 'Parabéns! Seu saldo está positivo. Lembre-se de gastar de forma consciente.';
    } else {
      alertBox.style.display = 'none';
    }
  }

  // Lógica da Frequência Semanal
  const curDay = today.getDay();
  const diffToMon = today.getDate() - curDay + (curDay === 0 ? -6 : 1);
  const mon = new Date(today.getFullYear(), today.getMonth(), diffToMon);
  mon.setHours(0,0,0,0);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  sun.setHours(23,59,59,999);

  const weekInsts = getInstances(mon, sun);
  const uniqueDays = new Set();
  weekInsts.forEach(inst => {
    uniqueDays.add(dtKey(inst.instanceDate));
  });
  const daysCount = uniqueDays.size;

  let rank = '';
  let phrase = '';
  if (daysCount <= 1) {
    rank = 'Sedentário Financeiro 💤';
    phrase = 'Você ainda não registrou quase nada esta semana. Lembre-se: consistência é a chave para o sucesso financeiro! 💤';
  } else if (daysCount <= 3) {
    rank = 'Caminhada Consciente 🚶‍♂️';
    phrase = 'Bom começo! Você está criando o hábito de registrar seus gastos. Continue assim para dominar suas finanças! 🚶‍♂️';
  } else if (daysCount <= 5) {
    rank = 'Atleta da Poupança 🏃‍♂️';
    phrase = 'Consistência incrível! Você está no controle quase diário das suas finanças. Continue focado! 🏃‍♂️';
  } else {
    rank = 'Monstro da Gestão 🏋️‍♂️';
    phrase = 'Nível Monstro! Você registra tudo e tem controle total do seu fluxo financeiro. Estilo Gym Rat das finanças! 🏋️‍♂️';
  }

  if ($('gamification-rank')) $('gamification-rank').textContent = rank;
  if ($('gamification-score')) $('gamification-score').textContent = `${daysCount}/7 dias`;
  if ($('gamification-progress')) $('gamification-progress').style.width = `${(daysCount / 7) * 100}%`;
  if ($('gamification-phrase')) $('gamification-phrase').textContent = phrase;
  
  if (iaInsightsCached && $('ia-insights-container')) {
    $('ia-insights-container').innerHTML = iaInsightsCached;
  } else {
    const apiKey = (currentUser && currentUser.geminiKey) || localStorage.getItem('gemini_api_key_' + (currentUser ? currentUser.email : '')) || '';
    if (apiKey) {
      generateIAInsights();
    } else if ($('ia-insights-container')) {
      $('ia-insights-container').innerHTML = 'Adicione sua chave de API do Gemini nos Ajustes para obter insights automatizados sobre seus gastos.';
    }
  }

  // Gráfico de Evolução (Fixado a partir de hoje até +11 meses)
  const labels = []; 
  const monthlyNetVals = []; 
  const cumulativeVals = [];
  
  const chartY = today.getFullYear();
  const chartM = today.getMonth();
  
  for(let i=0; i<12; i++) {
    const monthStart = new Date(chartY, chartM + i, 1);
    const monthEnd = new Date(chartY, chartM + i + 1, 0, 23, 59, 59, 999);
    
    const monthInsts = getInstances(monthStart, monthEnd);
    let me = 0, ms = 0;
    monthInsts.forEach(x => { if(x.tipo === 'entrada') me += x.valor; else ms += x.valor; });
    monthlyNetVals.push(me - ms);
    
    const pastInsts = getInstances(new Date(2000, 0, 1), monthEnd);
    let te = 0, ts = 0;
    pastInsts.forEach(x => { if(x.tipo === 'entrada') te += x.valor; else ts += x.valor; });
    cumulativeVals.push(appData.saldoInicial + te - ts);
    
    labels.push(monthStart.toLocaleDateString('pt-BR', {month: 'short', year: '2-digit'}).replace('.', ''));
  }
  
  const chartEl = $('chart-dash');
  if (chartEl) {
    const ctx = chartEl.getContext('2d');
    if(chartDash) chartDash.destroy();
    chartDash = new Chart(ctx, {
      data: { 
        labels, 
        datasets: [
          { 
            type: 'line',
            label: 'Saldo Acumulado', 
            data: cumulativeVals, 
            borderColor: '#0071E3', 
            backgroundColor: 'rgba(0,113,227,0.1)', 
            fill: false, 
            tension: 0.4, 
            borderWidth: 3, 
            pointRadius: 4,
            order: 1
          },
          {
            type: 'bar',
            label: 'Resultado Mensal',
            data: monthlyNetVals,
            backgroundColor: monthlyNetVals.map(val => val >= 0 ? 'rgba(52, 199, 89, 0.65)' : 'rgba(255, 59, 48, 0.65)'),
            borderRadius: 4,
            order: 2
          }
        ] 
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        plugins: { 
          legend: { 
            display: true,
            position: 'top',
            labels: { boxWidth: 12, font: { size: 10 } }
          } 
        }, 
        scales: { 
          x: { grid: { display: false } }, 
          y: { 
            grid: { color: 'rgba(0,0,0,0.05)' },
            suggestedMin: 0,
            suggestedMax: 1000,
            ticks: {
              callback: function(value) {
                return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
              }
            }
          } 
        } 
      }
    });
  }
}

function updateNtxMacroOptions(tipo) {
  const sel = $('ntx-cat');
  if (!sel) return;
  const cats = MACRO_CATS[tipo] || MACRO_CATS.saida;
  sel.innerHTML = cats.map((c, i) => `<option value="${c.v}"${i === 0 ? ' selected' : ''}>${c.l}</option>`).join('');
}

function updateMdMacroOptions(tipo) {
  const sel = $('md-cat');
  if (!sel) return;
  const cats = MACRO_CATS[tipo] || MACRO_CATS.saida;
  sel.innerHTML = cats.map((c, i) => `<option value="${c.v}"${i === 0 ? ' selected' : ''}>${c.l}</option>`).join('');
}

function setNewTxType(tipo) {
  curNewTxType = tipo;
  document.querySelectorAll('.tx-type-card').forEach(c => c.classList.remove('active'));
  const card = $(`type-card-${tipo}`);
  if (card) card.classList.add('active');
  updateNtxMacroOptions(tipo);
}
