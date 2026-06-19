'use strict';

function changeYear(delta) {
  curDate.setFullYear(curDate.getFullYear() + delta);
  renderSemanal();
}

function onSaldosMonthSelectChange(val) {
  curDate.setMonth(parseInt(val));
  renderSemanal();
}

function toggleSidebarMenuDropdown(event) {
  event.stopPropagation();
  const dropdown = $('sidebar-menu-dropdown');
  if (dropdown) {
    const isHidden = dropdown.style.display === 'none';
    dropdown.style.display = isHidden ? 'flex' : 'none';
  }
}

document.addEventListener('click', function() {
  const dropdown = $('sidebar-menu-dropdown');
  if (dropdown) dropdown.style.display = 'none';
});

function openAddTxForToday() {
  const todayStr = dtKey(new Date());
  openDayDetail(todayStr);
}

function scrollToTodayRow() {
  const todayStr = dtKey(new Date());
  const row = $('row-day-' + todayStr);
  if (row) {
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.style.transition = 'background-color 0.5s ease';
    row.style.backgroundColor = 'rgba(255, 90, 54, 0.15)';
    setTimeout(() => {
      row.style.backgroundColor = '';
    }, 2000);
  } else {
    curDate = new Date();
    renderSemanal();
    setTimeout(() => {
      const newRow = $('row-day-' + todayStr);
      if (newRow) {
        newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        newRow.style.transition = 'background-color 0.5s ease';
        newRow.style.backgroundColor = 'rgba(255, 90, 54, 0.15)';
        setTimeout(() => {
          newRow.style.backgroundColor = '';
        }, 2000);
      }
    }, 150);
  }
}

function renderSemanal() {
  let startDate, endDate, loopDays;
  const y = curDate.getFullYear(); const m = curDate.getMonth();
  
  const startMonth = new Date(y, m, 1);
  startMonth.setHours(0,0,0,0);
  const endMonth = new Date(y, m + 1, 0);
  endMonth.setHours(23,59,59,999);
  
  startDate = startMonth;
  endDate = endMonth;
  loopDays = endMonth.getDate();
  
  if ($('saldos-year-range')) $('saldos-year-range').textContent = `Jan/${y} - Dez/${y}`;
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  if ($('saldos-month-label')) {
    $('saldos-month-label').innerHTML = `${monthNames[m]} de ${y} <span style="font-size: 11px; color: var(--text-3); vertical-align: middle;">▼</span>`;
  }
  if ($('saldos-month-select')) $('saldos-month-select').value = m;
  
  if ($('sidebar-today-num')) $('sidebar-today-num').textContent = new Date().getDate();

  const tbody = $('week-tbody'); 
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const tfoot = $('week-tfoot'); 
  if (tfoot) tfoot.innerHTML = '';
  
  const insts = getInstances(startDate, endDate);
  
  let totalPeriodEnt = 0;
  let totalPeriodSai = 0;
  let totalPeriodDia = 0;
  let totalPeriodEco = 0;
  let totalPeriodCar = 0;

  let runningBalance = (appData.saldoInicial || 0) + getSaldoAntesDe(startDate);

  for(let i=0; i<loopDays; i++) {
    const curD = new Date(startDate); curD.setDate(curD.getDate() + i);
    const k = dtKey(curD); const isToday = k === dtKey(new Date());
    const isWeekend = curD.getDay() === 0 || curD.getDay() === 6;
    
    const dayInsts = insts.filter(x => dtKey(x.instanceDate) === k);
    let dEnt = 0, dSai = 0, dDia = 0, dEco = 0, dCar = 0;
    
    dayInsts.forEach(x => {
      const isCredit = x.formaPagamento === 'Crédito';
      if (isCredit) {
        dCar += x.valor;
      } else {
        if (x.tipo === 'entrada') dEnt += x.valor;
        else if (x.tipo === 'saida') dSai += x.valor;
        else if (x.tipo === 'diario') dDia += x.valor;
        else if (x.tipo === 'economia') dEco += x.valor;
      }
    });
    
    totalPeriodEnt += dEnt;
    totalPeriodSai += dSai;
    totalPeriodDia += dDia;
    totalPeriodEco += dEco;
    totalPeriodCar += dCar;
    
    runningBalance += (dEnt - dSai - dDia - dEco - dCar);
    const dayRunningBalance = runningBalance;
    
    let diaClass = '';
    if (isToday) {
      diaClass = 'dia-today';
    } else if (isWeekend) {
      diaClass = 'dia-weekend';
    }
    
    let saldoClass = 'sal-zero';
    if (dayRunningBalance > 0) {
      saldoClass = 'sal-pos';
    } else if (dayRunningBalance < 0) {
      if (dayRunningBalance <= -1000) {
        saldoClass = 'sal-neg-critical';
      } else {
        saldoClass = 'sal-neg';
      }
    }
    
    const getCellHTML = (dateKey, colType, valor, iconChar, colorClass) => {
      const hasValue = valor > 0;
      const iconBgClass = hasValue ? `circle-${colorClass}` : 'circle-neutral';
      const textClass = hasValue ? '' : 'muted';
      return `
        <div class="t-val-block">
          <span class="t-val-icon-circle ${iconBgClass}">${iconChar}</span>
          <span class="t-val-text ${textClass}">${fmt(valor)}</span>
        </div>
        <input type="number" step="any" class="t-input" style="display:none;" placeholder="0.00" onblur="saveInlineInput('${dateKey}', '${colType}', this)" onkeydown="if(event.key==='Enter') this.blur();" />
      `;
    };

    const tr = document.createElement('tr');
    tr.id = `row-day-${k}`;
    
    tr.innerHTML = `
      <td class="w-col-dia ${diaClass}" onclick="openDayDetail('${k}')" style="cursor: pointer;">
        <div class="t-day-block">
          <div class="t-day-num">${curD.getDate()}</div>
        </div>
      </td>
      <td class="w-col-ent" onclick="event.stopPropagation(); showInlineInput(this)">
        ${getCellHTML(k, 'entrada', dEnt, '✓', 'entrada')}
      </td>
      <td class="w-col-sai" onclick="event.stopPropagation(); showInlineInput(this)">
        ${getCellHTML(k, 'saida', dSai, '↗', 'saida')}
      </td>
      <td class="w-col-dia-exp" onclick="event.stopPropagation(); showInlineInput(this)">
        ${getCellHTML(k, 'diario', dDia, 'D', 'diario')}
      </td>
      <td class="w-col-eco" onclick="event.stopPropagation(); showInlineInput(this)">
        ${getCellHTML(k, 'economia', dEco, 'E', 'economia')}
      </td>
      <td class="w-col-car" onclick="event.stopPropagation(); showInlineInput(this)">
        ${getCellHTML(k, 'cartao', dCar, 'C', 'cartao')}
      </td>
      <td class="w-col-sal ${saldoClass}">
        <div style="font-weight: 700;">
          ${dayRunningBalance > 0 ? '+ ' : (dayRunningBalance < 0 ? '− ' : '')}${fmt(Math.abs(dayRunningBalance))}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }
  
  if (tfoot) {
    const trFoot = document.createElement('tr');
    trFoot.style.fontWeight = '700';
    trFoot.style.background = '#FAFAFC';
    trFoot.style.borderTop = '2px solid var(--border)';
    
    trFoot.innerHTML = `
      <td class="w-col-dia" style="text-align: center; font-size: 11px; text-transform: uppercase; color: var(--text-3);">Total</td>
      <td class="w-col-ent">
        <div style="display: flex; align-items: center;">
          <span class="t-val-icon-circle ${totalPeriodEnt > 0 ? 'circle-entrada' : 'circle-neutral'}">✓</span>
          <span class="t-val-text">${fmt(totalPeriodEnt)}</span>
        </div>
      </td>
      <td class="w-col-sai">
        <div style="display: flex; align-items: center;">
          <span class="t-val-icon-circle ${totalPeriodSai > 0 ? 'circle-saida' : 'circle-neutral'}">↗</span>
          <span class="t-val-text">${fmt(totalPeriodSai)}</span>
        </div>
      </td>
      <td class="w-col-dia-exp">
        <div style="display: flex; align-items: center;">
          <span class="t-val-icon-circle ${totalPeriodDia > 0 ? 'circle-diario' : 'circle-neutral'}">D</span>
          <span class="t-val-text">${fmt(totalPeriodDia)}</span>
        </div>
      </td>
      <td class="w-col-eco">
        <div style="display: flex; align-items: center;">
          <span class="t-val-icon-circle ${totalPeriodEco > 0 ? 'circle-economia' : 'circle-neutral'}">E</span>
          <span class="t-val-text">${fmt(totalPeriodEco)}</span>
        </div>
      </td>
      <td class="w-col-car">
        <div style="display: flex; align-items: center;">
          <span class="t-val-icon-circle ${totalPeriodCar > 0 ? 'circle-cartao' : 'circle-neutral'}">C</span>
          <span class="t-val-text">${fmt(totalPeriodCar)}</span>
        </div>
      </td>
      <td class="w-col-sal" style="text-align: right; padding-right: 8px;">
        <div style="font-weight: 800; color: ${runningBalance >= 0 ? 'var(--apple-blue)' : 'var(--apple-red)'};">
          ${runningBalance > 0 ? '+ ' : (runningBalance < 0 ? '− ' : '')}${fmt(Math.abs(runningBalance))}
        </div>
      </td>
    `;
    tfoot.appendChild(trFoot);
  }
}

function showInlineInput(td) {
  const block = td.querySelector('.t-val-block');
  const input = td.querySelector('.t-input');
  if (block && input && input.style.display === 'none') {
    block.style.display = 'none';
    input.style.display = 'block';
    input.value = '';
    input.focus();
  }
}

function saveInlineInput(dateStr, colType, input) {
  const val = parseFloat(input.value);
  const td = input.parentElement;
  const block = td.querySelector('.t-val-block');
  
  input.style.display = 'none';
  if (block) block.style.display = 'flex';
  
  if(isNaN(val) || val <= 0) return;

  let tipo = 'saida';
  let formaPagamento = 'Pix';
  let macro = 'Outros';
  
  if (colType === 'entrada') {
    tipo = 'entrada';
    formaPagamento = 'Pix';
    macro = 'Outros';
  } else if (colType === 'saida') {
    tipo = 'saida';
    formaPagamento = 'Pix';
    macro = 'Outros';
  } else if (colType === 'diario') {
    tipo = 'diario';
    formaPagamento = 'Dinheiro';
    macro = 'Variáveis';
  } else if (colType === 'economia') {
    tipo = 'economia';
    formaPagamento = 'Pix';
    macro = 'Investimentos';
  } else if (colType === 'cartao') {
    tipo = 'saida';
    formaPagamento = 'Crédito';
    macro = 'Outros';
  }
  
  appData.transacoes.push({
    id: uuid(),
    tipo,
    valor: val,
    desc: 'Lançamento Rápido',
    data: dateStr,
    frequencia: 'none',
    macro,
    formaPagamento
  });
  saveData();
  addXP(10);
  addDinDins(2);
  toast('Adicionado: ' + fmt(val));
  renderSemanal();
}

function openDayDetail(dateStr) {
  selectedDateForModal = dateStr; const d = parseDt(dateStr);
  $('md-title').textContent = `Detalhes: ${d.toLocaleDateString('pt-BR', {day:'2-digit',month:'short'})}`;
  $('md-val').value = ''; $('md-desc').value = '';
  setMdType('saida');
  renderDayTxList(); openModal('modal-dia');
}

function setMdType(tipo) {
  curMdType = tipo;
  $('md-seg-saida').classList.toggle('active', tipo === 'saida');
  $('md-seg-entrada').classList.toggle('active', tipo === 'entrada');
  const econEl = $('md-seg-economia');
  if (econEl) econEl.classList.toggle('active', tipo === 'economia');
  updateMdMacroOptions(tipo);
}

function toggleMdRepeatOptions(val) {
  const wrapper = $('md-repeat-wrapper');
  if (wrapper) wrapper.style.display = val === 'custom' ? 'block' : 'none';
}

function toggleMdCustomUnitOptions(unit) {
  const wd = $('md-custom-weekdays');
  const md = $('md-custom-monthdays');
  if (wd) wd.style.display = unit === 'semanas' ? 'block' : 'none';
  if (md) md.style.display = unit === 'meses' ? 'block' : 'none';
}

function toggleMdEndCondition(type) {
  const df = $('md-data-fim');
  const pw = $('md-parcelas-wrap');
  if (df) df.style.display = type === 'data' ? 'block' : 'none';
  if (pw) pw.style.display = type === 'parcelas' ? 'flex' : 'none';
}

function saveMdTx() {
  const val = parseFloat($('md-val').value);
  const desc = $('md-desc').value.trim() || (curMdType === 'entrada' ? 'Entrada' : 'Saída');
  if (isNaN(val) || val <= 0) { toast('Valor inválido.'); return; }

  const freq = $('md-freq').value;
  let txObj = {
    id: uuid(),
    tipo: curMdType,
    valor: val,
    desc,
    data: selectedDateForModal,
    frequencia: freq,
    macro: $('md-cat').value,
    formaPagamento: $('md-pag').value
  };

  if (freq === 'custom') {
    const unit = $('md-custom-unit').value;
    const interval = parseInt($('md-custom-interval').value) || 1;
    const endType = $('md-end-type').value;

    let dataFim = null;
    let parcelas = null;

    if (endType === 'data') {
      dataFim = $('md-data-fim').value || null;
      if (!dataFim) { toast('Defina a data de término.'); return; }
    } else if (endType === 'parcelas') {
      parcelas = parseInt($('md-parcelas').value) || null;
      if (!parcelas || parcelas < 2) { toast('Informe o número de parcelas (mínimo 2).'); return; }
    }

    let weekdays = [];
    if (unit === 'semanas') {
      document.querySelectorAll('.md-wd-check:checked').forEach(cb => weekdays.push(parseInt(cb.value)));
      if (!weekdays.length) { toast('Selecione ao menos um dia da semana.'); return; }
    }

    let monthdays = [];
    if (unit === 'meses') {
      const d1 = parseInt($('md-monthday1').value);
      const d2 = parseInt($('md-monthday2').value);
      if (!d1 || d1 < 1 || d1 > 31) { toast('Informe o dia do mês (1–31).'); return; }
      monthdays.push(d1);
      if (d2 >= 1 && d2 <= 31 && d2 !== d1) monthdays.push(d2);
    }

    txObj.recurrence = { unit, interval, dataFim, parcelas, weekdays, monthdays };
  }

  appData.transacoes.push(txObj);
  saveData();
  addXP(15);
  addDinDins(3);

  $('md-val').value = '';
  $('md-desc').value = '';
  $('md-freq').value = 'none';
  toggleMdRepeatOptions('none');

  renderDayTxList();
  renderSemanal();

  const freqLabel = { none:'pontual', diaria:'diária', semanal:'semanal', quinzenal:'quinzenal', mensal:'mensal', custom:'personalizada' }[freq] || freq;
  toast(`✅ Lançamento ${freqLabel} adicionado!`);
}

function renderDayTxList() {
  const list = $('md-tx-list'); 
  if (!list) return;
  list.innerHTML = '';
  const insts = getInstances(parseDt(selectedDateForModal), parseDt(selectedDateForModal));
  if(insts.length === 0) { list.innerHTML = '<div style="text-align:center; color:var(--text-3); font-size: 14px; padding: 20px;">Sem lançamentos neste dia.</div>'; return; }
  
  insts.forEach(i => {
    const isRec = i.frequencia !== 'none';
    const c = i.tipo === 'entrada' ? 'var(--apple-green)' : 'var(--apple-red)';
    list.innerHTML += `
      <div class="tx-item" style="cursor: pointer;" onclick="openEditTxModal('${i.id}')">
        <div class="tx-info">
          <div class="tx-desc">${i.desc} ${isRec ? '🔁' : ''}</div>
          <div class="tx-meta">${i.macro} • ${i.formaPagamento}</div>
        </div>
        <div class="tx-val" style="color: ${c}">
          ${fmt(i.valor)} 
          <div class="tx-del" onclick="event.stopPropagation(); deleteTx('${i.id}')" title="Excluir lançamento">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </div>
        </div>
      </div>
    `;
  });
}

function deleteTx(id) {
  appData.transacoes = appData.transacoes.filter(x => x.id !== id);
  saveData(); renderDayTxList(); renderSemanal();
}
