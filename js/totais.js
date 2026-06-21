'use strict';

function renderTotais() {
  const y = curDate.getFullYear(); const m = curDate.getMonth();
  const monthNamesAbbr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  if ($('totais-month-label')) $('totais-month-label').textContent = `${monthNamesAbbr[m]}/${String(y).slice(-2)}`;
  
  const today = new Date();
  let calendarDay = today.getDate();
  if (today.getFullYear() !== y || today.getMonth() !== m) {
    calendarDay = new Date(y, m + 1, 0).getDate();
  }
  if ($('totais-calendar-day')) $('totais-calendar-day').textContent = calendarDay;
  if ($('totais-diario-days-label')) $('totais-diario-days-label').textContent = calendarDay;

  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const insts = getInstances(start, end);

  let entTotal = 0;
  let saiTotal = 0;
  let diaTotal = 0;
  let ecoTotal = 0;
  let creTotal = 0;

  insts.forEach(i => {
    const isCredit = i.formaPagamento === 'Crédito';
    if (isCredit) {
      creTotal += i.valor;
    } else {
      if (i.tipo === 'entrada') entTotal += i.valor;
      else if (i.tipo === 'saida') saiTotal += i.valor;
      else if (i.tipo === 'diario') diaTotal += i.valor;
      else if (i.tipo === 'economia') ecoTotal += i.valor;
    }
  });

  const hasMovements = (entTotal > 0 || saiTotal > 0 || diaTotal > 0 || ecoTotal > 0 || creTotal > 0);
  const monthIncome = hasMovements ? (entTotal > 0 ? entTotal : (parseFloat(currentUser.salario) || 0)) : 0;
  const totalDaysInMonth = new Date(y, m + 1, 0).getDate();
  const availableForDaily = monthIncome - saiTotal - ecoTotal - creTotal;

  // Previsão de Diário: Se existir diário breakdown configurado, calcula com base na composição
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

  const dottedD = hasDiarioBreakdown 
    ? (totalMensalProjetado / totalDaysInMonth) 
    : ((availableForDaily > 0) ? (availableForDaily / totalDaysInMonth) : 0);

  const custoDeVida = hasMovements ? (saiTotal + diaTotal + creTotal) : 0;
  const performance = hasMovements ? (monthIncome - custoDeVida - ecoTotal) : 0;

  if ($('totais-perf-val')) $('totais-perf-val').textContent = fmt(performance);
  if ($('totais-perf-desc')) {
    if (performance < 0) {
      $('totais-perf-val').style.color = 'var(--apple-red)';
      $('totais-perf-desc').textContent = 'Faltou dinheiro';
      $('totais-perf-desc').style.color = 'var(--apple-red)';
    } else if (performance > 0) {
      $('totais-perf-val').style.color = 'var(--apple-green)';
      $('totais-perf-desc').textContent = 'Sobrou dinheiro';
      $('totais-perf-desc').style.color = 'var(--apple-green)';
    } else {
      $('totais-perf-val').style.color = 'var(--text-1)';
      $('totais-perf-desc').textContent = 'Equilibrado';
      $('totais-perf-desc').style.color = 'var(--text-3)';
    }
  }

  const econPct = monthIncome > 0 ? Math.round((ecoTotal / monthIncome) * 100) : 0;
  if ($('totais-econ-val')) $('totais-econ-val').textContent = `${econPct}%`;
  if ($('totais-econ-bar')) $('totais-econ-bar').style.width = `${Math.min(econPct, 100)}%`;
  let econDesc = 'Nada guardado';
  if (econPct > 0 && econPct < 10) econDesc = 'Guardando um pouco';
  else if (econPct >= 10 && econPct < 20) econDesc = 'Bom ritmo de poupança!';
  else if (econPct >= 20) econDesc = 'Excelente poupador! 🚀';
  if ($('totais-econ-desc')) $('totais-econ-desc').textContent = econDesc;

  if ($('totais-custo-val')) $('totais-custo-val').textContent = fmt(custoDeVida);
  if ($('totais-custo-desc')) {
    if (custoDeVida > monthIncome) {
      $('totais-custo-desc').textContent = 'Acima da renda';
      $('totais-custo-desc').style.color = 'var(--apple-red)';
    } else {
      $('totais-custo-desc').textContent = 'Dentro do planejado';
      $('totais-custo-desc').style.color = 'var(--apple-green)';
    }
  }

  const diaMedio = diaTotal / calendarDay;
  if ($('totais-diario-val')) $('totais-diario-val').textContent = fmt(diaMedio);
  if ($('totais-diario-meta')) $('totais-diario-meta').textContent = fmt(dottedD);

  if ($('totais-row-ent')) $('totais-row-ent').textContent = fmt(entTotal);
  if ($('totais-row-sai')) $('totais-row-sai').textContent = fmt(saiTotal);
  if ($('totais-row-dia')) $('totais-row-dia').textContent = fmt(diaTotal);
  if ($('totais-row-eco')) $('totais-row-eco').textContent = fmt(ecoTotal);
  if ($('totais-row-cre')) $('totais-row-cre').textContent = fmt(creTotal);

  // Alerta de cartão de crédito (limite prudent de 30% da renda)
  const cardAlert = $('totais-card-alert');
  if (cardAlert) {
    if (monthIncome > 0 && creTotal > 0.3 * monthIncome) {
      const pctCar = Math.round((creTotal / monthIncome) * 100);
      cardAlert.style.display = 'block';
      cardAlert.style.backgroundColor = 'rgba(255, 90, 54, 0.08)';
      cardAlert.style.border = '1.5px solid #FF5A36';
      cardAlert.style.borderRadius = 'var(--r-md)';
      cardAlert.style.padding = '16px';
      cardAlert.style.color = '#FF5A36';
      cardAlert.style.fontSize = '14px';
      cardAlert.style.fontWeight = '600';
      cardAlert.style.lineHeight = '1.5';
      cardAlert.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <span style="font-size: 20px;">💡</span>
          <div>
            <strong>Alerta de Segurança Financeira (Breno Nogueira):</strong><br/>
            Seus gastos na coluna <strong>Cartão (Crédito)</strong> somaram <strong>${fmt(creTotal)}</strong> (${pctCar}% da sua renda de ${fmt(monthIncome)}).<br/>
            Isso excede o limite prudente de 30% recomendado para evitar o endividamento por impulso. Considere migrar temporariamente suas compras diárias para <strong>Pix ou Débito</strong>, forçando o fluxo de caixa a ser sentido na hora!
          </div>
        </div>
      `;
    } else {
      cardAlert.style.display = 'none';
    }
  }

  renderReservaEmergencia();
}

function renderReservaEmergencia() {
  const allInsts = getInstances(new Date(2000, 0, 1), new Date(2099, 11, 31));
  const reservaAcumulado = allInsts
    .filter(i => i.tipo === 'economia' && i.macro === 'Reserva de Emergência')
    .reduce((sum, i) => sum + i.valor, 0);

  const metaReserva = parseFloat(currentUser.metaReserva) || 0;

  if ($('reserva-acumulado')) $('reserva-acumulado').textContent = fmt(reservaAcumulado);
  if ($('reserva-meta')) $('reserva-meta').textContent = metaReserva > 0 ? fmt(metaReserva) : '—';

  const pct = metaReserva > 0 ? Math.min((reservaAcumulado / metaReserva) * 100, 100) : 0;
  const pctBar = $('reserva-progress-bar');
  if (pctBar) {
    pctBar.style.width = pct.toFixed(1) + '%';
    pctBar.style.background = pct >= 100
      ? 'linear-gradient(90deg, #34C759, #30D158)'
      : 'linear-gradient(90deg, #0071E3, #34C759)';
  }

  const pctLabel = $('reserva-pct-label');
  const faltaLabel = $('reserva-falta-label');
  if (pctLabel) pctLabel.textContent = pct >= 100 ? '✅ Meta atingida!' : `${pct.toFixed(0)}% atingido`;
  if (faltaLabel) {
    if (metaReserva <= 0) faltaLabel.textContent = 'Configure uma meta em Ajustes';
    else if (pct >= 100) faltaLabel.textContent = 'Parabéns!';
    else faltaLabel.textContent = `Faltam ${fmt(metaReserva - reservaAcumulado)}`;
  }

  const projecaoEl = $('reserva-projecao');
  if (projecaoEl) {
    if (metaReserva <= 0) {
      projecaoEl.textContent = '💡 Configure uma meta de reserva em Ajustes & IA para ver a projeção de quando você atingirá o objetivo.';
    } else if (pct >= 100) {
      projecaoEl.innerHTML = '🏆 <strong>Meta atingida!</strong> Você concluiu sua reserva de emergência. Considere expandir para novos investimentos.';
    } else {
      const now = new Date();
      let totalAportes = 0;
      let mesesComAporte = 0;
      for (let i = 0; i < 6; i++) {
        const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const mInsts = getInstances(mStart, mEnd);
        const mAporte = mInsts
          .filter(x => x.tipo === 'economia' && x.macro === 'Reserva de Emergência')
          .reduce((s, x) => s + x.valor, 0);
        if (mAporte > 0) { totalAportes += mAporte; mesesComAporte++; }
      }
      const mediaMensal = mesesComAporte > 0 ? totalAportes / mesesComAporte : 0;
      const falta = metaReserva - reservaAcumulado;

      if (mediaMensal > 0) {
        const mesesRestantes = Math.ceil(falta / mediaMensal);
        const dataProjecao = new Date(now.getFullYear(), now.getMonth() + mesesRestantes, 1);
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        projecaoEl.innerHTML = `📅 Com aporte médio de <strong>${fmt(mediaMensal)}/mês</strong>, você atingirá a meta em aproximadamente <strong>${mesesRestantes} ${mesesRestantes === 1 ? 'mês' : 'meses'}</strong> — por volta de <strong>${meses[dataProjecao.getMonth()]}/${dataProjecao.getFullYear()}</strong>.`;
      } else {
        projecaoEl.textContent = '💡 Adicione lançamentos de Economia > Reserva de Emergência para calcular sua projeção.';
      }
    }
  }
}

function sugerirMetaReserva() {
  const mesesSug = parseInt($('cfg-reserva-meses') ? $('cfg-reserva-meses').value : 6) || 6;
  const now = new Date();
  let totalSaidas = 0;
  let mesesCalc = 0;
  for (let i = 1; i <= 3; i++) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const mInsts = getInstances(mStart, mEnd);
    const mSai = mInsts.filter(x => x.tipo === 'saida' || x.tipo === 'diario').reduce((s, x) => s + x.valor, 0);
    if (mSai > 0) { totalSaidas += mSai; mesesCalc++; }
  }
  const mediaMensal = mesesCalc > 0 ? totalSaidas / mesesCalc : (parseFloat(currentUser.salario) || 3000);
  const sugestao = Math.round(mediaMensal * mesesSug / 100) * 100;
  const input = $('cfg-meta-reserva');
  if (input) {
    input.value = sugestao;
    currentUser.metaReserva = sugestao;
    saveUserProfile();
    toast(`💡 Meta sugerida: ${fmt(sugestao)} (${mesesSug}x custo de vida médio)`);
  }
}


function showMovimentacaoDetalhes(tipo) {
  const y = curDate.getFullYear(); const m = curDate.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const insts = getInstances(start, end);

  let filtered = [];
  let title = '';

  if (tipo === 'credito') {
    filtered = insts.filter(i => i.formaPagamento === 'Crédito');
    title = 'Lançamentos no Crédito';
  } else {
    filtered = insts.filter(i => i.tipo === tipo && i.formaPagamento !== 'Crédito');
    if (tipo === 'entrada') title = 'Lançamentos de Entrada';
    else if (tipo === 'saida') title = 'Lançamentos de Saída';
    else if (tipo === 'diario') title = 'Orçamentos Diários';
    else if (tipo === 'economia') title = 'Economias / Investimentos';
  }

  const listContainer = $('mov-detalhes-list');
  const titleEl = $('mov-detalhes-title');
  if (!listContainer || !titleEl) return;

  titleEl.textContent = title;
  listContainer.innerHTML = '';

  if (filtered.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center; color:var(--text-3); padding: 20px;">Nenhum lançamento encontrado nesta categoria.</div>';
  } else {
    filtered.forEach(i => {
      const c = i.tipo === 'entrada' ? 'var(--apple-green)' : (i.tipo === 'economia' ? 'var(--apple-blue)' : 'var(--apple-red)');
      const dateStr = parseDt(i.data).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
      listContainer.innerHTML += `
        <div class="tx-item" style="cursor: pointer; padding: 12px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;" onclick="closeModal('modal-mov-detalhes'); openEditTxModal('${i.id}')">
          <div class="tx-info">
            <div class="tx-desc" style="font-weight: 600;">${i.desc}</div>
            <div class="tx-meta" style="font-size: 11px; color: var(--text-3); margin-top: 4px;">${dateStr} • ${i.macro} • ${i.formaPagamento}</div>
          </div>
          <div class="tx-val" style="color: ${c}; font-weight: 700;">
            ${fmt(i.valor)}
          </div>
        </div>
      `;
    });
  }

  openModal('modal-mov-detalhes');
}

function showIndicatorInfo(indicator) {
  const titleEl = $('indicator-info-title');
  const contentEl = $('indicator-info-content');
  if (!titleEl || !contentEl) return;

  let title = '';
  let content = '';

  if (indicator === 'performance') {
    title = 'ℹ️ Performance Financeira';
    content = `
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 14px;">
        <p>A <strong>Performance</strong> mede o resultado financeiro líquido do seu mês, indicando se sobrou ou faltou dinheiro.</p>
        <div style="background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-md); padding: 12px; font-family: monospace; font-size: 13px; color: var(--apple-blue);">
          Fórmula:<br/>
          Performance = Entradas − Custo de Vida − Economizado
        </div>
        <p>Onde:</p>
        <ul style="padding-left: 20px; display: flex; flex-direction: column; gap: 6px;">
          <li><strong>Entradas (↙):</strong> Ganhos reais no mês (salário, freelance, etc.).</li>
          <li><strong>Custo de Vida:</strong> Soma de Saídas, Diários e Crédito.</li>
          <li><strong>Economizado (E):</strong> Valores enviados para investimentos ou reserva de emergência.</li>
        </ul>
      </div>
    `;
  } else if (indicator === 'economizado') {
    title = 'ℹ️ Percentual Economizado';
    content = `
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 14px;">
        <p>O indicador <strong>Economizado</strong> exibe a taxa de poupança (savings rate) em relação às suas entradas totais.</p>
        <div style="background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-md); padding: 12px; font-family: monospace; font-size: 13px; color: var(--apple-blue);">
          Fórmula:<br/>
          Taxa = (Economias / Entradas) × 100
        </div>
        <p><strong>Meta recomendada:</strong> Tente guardar no mínimo <strong>10% a 20%</strong> da sua renda mensal para construir patrimônio e sua reserva de emergência.</p>
      </div>
    `;
  } else if (indicator === 'custo_vida') {
    title = 'ℹ️ Custo de Vida';
    content = `
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 14px;">
        <p>O <strong>Custo de Vida</strong> representa tudo o que foi consumido no mês para manter seu padrão de vida.</p>
        <div style="background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-md); padding: 12px; font-family: monospace; font-size: 13px; color: var(--apple-blue);">
          Fórmula:<br/>
          Custo de Vida = Saídas + Diários + Crédito
        </div>
        <p>Onde:</p>
        <ul style="padding-left: 20px; display: flex; flex-direction: column; gap: 6px;">
          <li><strong>Saídas (↗):</strong> Gastos fixos e contas pontuais pagas à vista.</li>
          <li><strong>Diários (D):</strong> Gastos variáveis diários acumulados.</li>
          <li><strong>Crédito (C):</strong> Faturas e despesas de cartão de crédito.</li>
        </ul>
      </div>
    `;
  } else if (indicator === 'diario_medio') {
    title = 'ℹ️ Diário Médio';
    content = `
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 14px;">
        <p>O <strong>Diário Médio</strong> mostra a média real gasta por dia do seu Orçamento Diário.</p>
        <div style="background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-md); padding: 12px; font-family: monospace; font-size: 13px; color: var(--apple-blue);">
          Fórmula:<br/>
          Diário Médio = Total gasto em Diários / Dias passados do mês
        </div>
        <p><strong>Comparação:</strong> Idealmente, seu diário médio deve ficar abaixo da <strong>Meta Diária</strong> calculada ou do orçamento que você estipulou em Ajustes.</p>
      </div>
    `;
  }

  titleEl.textContent = title;
  contentEl.innerHTML = content;
  openModal('modal-indicator-info');
}
