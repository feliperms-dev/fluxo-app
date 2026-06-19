'use strict';

function changeMonth(delta) { 
  curDate.setMonth(curDate.getMonth() + delta); 
  renderMensal(); 
}

function renderMensal() {
  const y = curDate.getFullYear(); const m = curDate.getMonth();
  const monthLabel = $('month-label');
  if (monthLabel) {
    monthLabel.textContent = curDate.toLocaleDateString('pt-BR', {month:'long', year:'numeric'}).replace(/^./, c => c.toUpperCase());
  }
  const insts = getInstances(new Date(y, m, 1), new Date(y, m+1, 0));

  let ent = 0, sai = 0;
  insts.forEach(i => {
    if(i.tipo === 'entrada') ent += i.valor;
    else if(i.tipo !== 'economia') sai += i.valor;
  });

  if ($('m-rec')) $('m-rec').textContent = fmt(ent); 
  if ($('m-des')) $('m-des').textContent = fmt(sai);
  const mLiq = $('m-liq');
  if (mLiq) {
    mLiq.textContent = fmt(ent - sai); 
    mLiq.style.color = (ent - sai) >= 0 ? 'var(--apple-blue)' : 'var(--apple-red)';
  }

  const list = $('month-tx-list'); 
  if (!list) return;
  list.innerHTML = '';
  if(insts.length === 0) { list.innerHTML = '<div style="padding:20px; text-align:center;">Sem lançamentos no mês.</div>'; return; }

  insts.sort((a,b) => b.instanceDate - a.instanceDate);

  const entradas = insts.filter(i => i.tipo === 'entrada');
  const saidas = insts.filter(i => i.tipo === 'saida' || i.tipo === 'diario');
  const economias = insts.filter(i => i.tipo === 'economia');

  function makeTxItem(i) {
    const valColor = i.tipo === 'entrada' ? 'var(--apple-green)' : i.tipo === 'economia' ? '#4CD964' : 'var(--apple-red)';
    const valSign = i.tipo === 'entrada' || i.tipo === 'economia' ? '+' : '-';
    let typeBadge = '↗', badgeBg = 'var(--apple-red)';
    if (i.tipo === 'entrada') { typeBadge = '↙'; badgeBg = 'var(--apple-green)'; }
    else if (i.tipo === 'diario') { typeBadge = 'D'; badgeBg = '#FF2D55'; }
    else if (i.tipo === 'economia') { typeBadge = 'E'; badgeBg = '#4CD964'; }
    return `<div class="tx-item" style="cursor:pointer;display:flex;align-items:center;gap:12px;" onclick="openEditTxModal('${i.id}')">
      <div style="background:${badgeBg};color:white;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:11px;flex-shrink:0;">${typeBadge}</div>
      <div class="tx-info" style="flex:1;overflow:hidden;">
        <div class="tx-desc" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;justify-content:space-between;">
          <span>${i.desc}</span>
          <span style="font-size:11px;color:var(--text-3);font-weight:normal;margin-left:8px;flex-shrink:0;">Dia ${i.instanceDate.getDate()}</span>
        </div>
        <div class="tx-meta">${i.macro || ''} • ${i.formaPagamento || ''}</div>
      </div>
      <div class="tx-val" style="color:${valColor};flex-shrink:0;font-weight:800;">${valSign} ${fmt(i.valor)}</div>
    </div>`;
  }

  function makeAccordion(id, title, color, icon, items, totalVal, startOpen = true) {
    if (items.length === 0) return '';
    const itemsHtml = items.map(makeTxItem).join('');
    return `
      <div style="margin-bottom:12px;border:1.5px solid ${color}22;border-radius:12px;overflow:hidden;">
        <div onclick="toggleAccordion('acc-${id}')" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:${color}0D;cursor:pointer;user-select:none;">
          <span style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px;color:${color};">
            <span style="background:${color};color:white;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;">${icon}</span>
            ${title} <span style="font-size:12px;font-weight:500;color:var(--text-3);">(${items.length})</span>
          </span>
          <span style="display:flex;align-items:center;gap:10px;">
            <span style="font-weight:800;font-size:14px;color:${color};">${fmt(totalVal)}</span>
            <span id="acc-${id}-chevron" style="font-size:14px;color:${color};transition:transform 0.25s;display:inline-block;transform:rotate(${startOpen?'0':'180deg'});">▲</span>
          </span>
        </div>
        <div id="acc-${id}" style="${startOpen ? '' : 'display:none;'}padding:8px 8px 4px;background:var(--card-bg);">
          ${itemsHtml}
        </div>
      </div>`;
  }

  list.innerHTML = 
    makeAccordion('ent', 'Entradas', 'var(--apple-green)', '↙', entradas, ent) +
    makeAccordion('sai', 'Saídas', 'var(--apple-red)', '↗', saidas, sai, false) +
    makeAccordion('eco', 'Economias', '#4CD964', 'E', economias, economias.reduce((s,i) => s+i.valor,0), false);
}

function renderAnual() {
  const y = curDate.getFullYear(); 
  if ($('year-label')) $('year-label').textContent = y;
  const filterVal = $('annual-month-filter') ? $('annual-month-filter').value : 'all';
  
  const yearStart = new Date(y, 0, 1);
  const yearEnd = new Date(y, 11, 31, 23, 59, 59, 999);
  const yearInsts = getInstances(yearStart, yearEnd);
  
  let yearEntradas = 0;
  let yearSaidas = 0;
  const categoryTotals = {};
  
  let filteredInsts = yearInsts;
  if (filterVal !== 'all') {
    const filterMonth = parseInt(filterVal);
    filteredInsts = yearInsts.filter(inst => inst.instanceDate.getMonth() === filterMonth);
    const labels = document.querySelectorAll('#page-anual .stat-label');
    if (labels.length >= 3) {
      labels[0].textContent = 'Receitas no Mês';
      labels[1].textContent = 'Despesas no Mês';
      labels[2].textContent = 'Saldo Líquido no Mês';
    }
  } else {
    const labels = document.querySelectorAll('#page-anual .stat-label');
    if (labels.length >= 3) {
      labels[0].textContent = 'Receitas Anuais';
      labels[1].textContent = 'Despesas Anuais';
      labels[2].textContent = 'Saldo Líquido Anual';
    }
  }
  
  filteredInsts.forEach(inst => {
    if (inst.tipo === 'entrada') {
      yearEntradas += inst.valor;
    } else {
      yearSaidas += inst.valor;
      const cat = inst.macro || 'Outros';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + inst.valor;
    }
  });
  
  if ($('an-rec')) $('an-rec').textContent = fmt(yearEntradas);
  if ($('an-des')) $('an-des').textContent = fmt(yearSaidas);
  const anLiq = $('an-liq');
  if (anLiq) {
    anLiq.textContent = fmt(yearEntradas - yearSaidas);
    anLiq.style.color = (yearEntradas - yearSaidas) >= 0 ? 'var(--apple-blue)' : 'var(--apple-red)';
  }
  
  const sortedCategories = Object.keys(categoryTotals).map(cat => ({
    name: cat,
    total: categoryTotals[cat]
  })).sort((a, b) => b.total - a.total);
  
  const catList = $('annual-category-list');
  if (!catList) return;
  catList.innerHTML = '';
  
  if (sortedCategories.length === 0) {
    catList.innerHTML = `<div style="text-align:center; color:var(--text-3); font-size:14px; padding:20px;">Sem saídas registradas ${filterVal !== 'all' ? 'neste mês' : 'neste ano'}.</div>`;
  } else {
    sortedCategories.forEach(item => {
      const pct = yearSaidas > 0 ? (item.total / yearSaidas) * 100 : 0;
      const icons = {
        'Moradia': '🏠',
        'Alimentação': '🍔',
        'Transporte': '🚗',
        'Saúde': '❤️',
        'Lazer': '🎉',
        'Educação': '📚',
        'Salário': '💰',
        'Outros': '📦'
      };
      const icon = icons[item.name] || '📦';
      
      catList.innerHTML += `
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:14px; font-weight:500;">
            <span style="display:flex; align-items:center; gap:6px; color:var(--text-1); font-weight:600;">
              <span>${icon}</span>
              <span>${item.name}</span>
            </span>
            <span style="color:var(--text-2); font-weight:500;">
              ${fmt(item.total)} <span style="font-size:12px; color:var(--text-3); margin-left:4px;">(${pct.toFixed(1)}%)</span>
            </span>
          </div>
          <div style="width:100%; height:8px; background:#E5E5EA; border-radius:4px; overflow:hidden; border:1px solid rgba(0,0,0,0.02);">
            <div style="width:${pct}%; height:100%; background:var(--apple-blue); border-radius:4px; transition: width 0.5s ease-out;"></div>
          </div>
        </div>
      `;
    });
  }

  // Gráfico de Saldo Histórico Anual
  const chartEl = $('chart-annual');
  if (chartEl) {
    const labels = []; const data = []; const colors = [];
    for(let m=0; m<12; m++) {
      const pastInsts = getInstances(new Date(2000,0,1), new Date(y, m+1, 0));
      let te=0, ts=0; pastInsts.forEach(x=>{
        const isCredit = x.formaPagamento === 'Crédito';
        if (!isCredit) {
          if(x.tipo==='entrada') te+=x.valor; 
          else ts+=x.valor;
        } else {
          ts += x.valor;
        }
      });
      const s = appData.saldoInicial + te - ts;
      labels.push(new Date(y, m, 1).toLocaleDateString('pt-BR', {month:'short'})); data.push(s);
      
      const isFiltered = filterVal !== 'all' && parseInt(filterVal) === m;
      const opacity = (filterVal === 'all' || isFiltered) ? '0.7' : '0.15';
      colors.push(s >= 0 ? `rgba(52, 199, 89, ${opacity})` : `rgba(255, 59, 48, ${opacity})`);
    }
    const ctx = chartEl.getContext('2d');
    if(chartAnnual) chartAnnual.destroy();
    chartAnnual = new Chart(ctx, { 
      type: 'bar', 
      data: { 
        labels, 
        datasets: [{ label: 'Saldo', data, backgroundColor: colors, borderRadius: 6 }] 
      }, 
      options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        plugins: { legend: { display: false } }, 
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

function toggleAccordion(id) {
  const el = $(id);
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  const chevron = $(id + '-chevron');
  if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}
