'use strict';

function renderHorizonte() {
  const container = $('horizon-columns-wrapper');
  if (!container) return;
  container.innerHTML = '<div style="padding: 20px; color: var(--text-3); font-size: 14px; text-align: center;">Projetando horizonte de saldos... ⏳</div>';

  requestAnimationFrame(() => {
    const m1 = new Date(curDate.getFullYear(), curDate.getMonth(), 1);
    const m12 = new Date(curDate.getFullYear(), curDate.getMonth() + 11, 1);
    const endOf12Months = new Date(m12.getFullYear(), m12.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const all12MonthInsts = getInstances(m1, endOf12Months);

    const months = [];
    for (let i = 0; i < 12; i++) {
      months.push(new Date(curDate.getFullYear(), curDate.getMonth() + i, 1));
    }
    
    const prevEnd = new Date(m1.getFullYear(), m1.getMonth(), 0, 23, 59, 59, 999);
    const pastInsts = getInstances(new Date(2000, 0, 1), prevEnd);
    let te = 0, ts = 0;
    pastInsts.forEach(x => {
      if (x.tipo === 'entrada') te += x.valor;
      else ts += x.valor;
    });
    let runningBalance = (appData.saldoInicial || 0) + te - ts;

    function fmtHorizonValue(val) {
      if (val === 0) return '0';
      const absVal = Math.abs(val);
      if (absVal >= 1000) {
        const kVal = val / 1000;
        return kVal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + 'K';
      }
      if (Number.isInteger(val)) return val.toString();
      return val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    let finalHTML = '';

    months.forEach((monthDate, idx) => {
      const y = monthDate.getFullYear();
      const m = monthDate.getMonth();
      const monthNamesAbbr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const labelText = `${monthNamesAbbr[m]}/${String(y).slice(-2)}`;
      
      const end = new Date(y, m + 1, 0);
      const daysInMonth = end.getDate();
      
      const isActive = idx === 0 ? 'active' : '';
      let columnHTML = `
        <div class="horizon-col">
          <div class="horizon-col-header ${isActive}">${labelText}</div>
          <div class="horizon-day-list">
      `;

      // Otimização: pré-filtra as instâncias desse mês específico para evitar filtrar 30 vezes no loop interno
      const monthInsts = all12MonthInsts.filter(x => {
        const d = x.instanceDate;
        return d.getFullYear() === y && d.getMonth() === m;
      });

      for (let day = 1; day <= daysInMonth; day++) {
        const dayInsts = monthInsts.filter(x => x.instanceDate.getDate() === day);
        
        let dayEnt = 0;
        let dayOut = 0;
        dayInsts.forEach(x => {
          if (x.tipo === 'entrada') dayEnt += x.valor;
          else dayOut += x.valor;
        });

        runningBalance += dayEnt - dayOut;

        let colorClass = 'val-yellow';
        if (runningBalance >= 1000) colorClass = 'val-green';
        else if (runningBalance < 0) colorClass = 'val-red';

        columnHTML += `
          <div class="horizon-day-row">
            <div class="horizon-day-num">${day}</div>
            <div class="horizon-day-val ${colorClass}">${fmtHorizonValue(runningBalance)}</div>
          </div>
        `;
      }

      columnHTML += `
          </div>
        </div>
      `;
      finalHTML += columnHTML;
    });

    container.innerHTML = finalHTML;
  });
}
