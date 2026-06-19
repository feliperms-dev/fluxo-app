'use strict';

// ─── GAMIFICAÇÃO 2.0 & LOJA ENGINE ───
function initGamificationState() {
  if (!currentUser) return;
  if (currentUser.xp === undefined) currentUser.xp = 0;
  if (currentUser.dindins === undefined) currentUser.dindins = 0;
  if (currentUser.streakFreezes === undefined) currentUser.streakFreezes = 0;
  if (currentUser.unlockedThemes === undefined) currentUser.unlockedThemes = ['classico'];
  if (currentUser.activeTheme === undefined) currentUser.activeTheme = 'classico';
  if (currentUser.duels === undefined) currentUser.duels = [];
  if (currentUser.onboardingCompleted === undefined) currentUser.onboardingCompleted = false;
  
  applyTheme(currentUser.activeTheme);
  renderShop();
  renderDuels();
  checkOnboarding();
  updateStreakFreezesAuto();
  renderGamificationUI();
}

function updateStreakFreezesAuto() {
  const email = currentUser.email;
  const todayKey = dtKey(new Date());
  const lastAccess = localStorage.getItem(`pland_last_access_${email}`);
  if (lastAccess) {
    const lastDate = parseDt(lastAccess);
    const todayDate = new Date();
    todayDate.setHours(0,0,0,0);
    lastDate.setHours(0,0,0,0);
    const diffTime = Math.abs(todayDate - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 1 && currentUser.streakFreezes > 0) {
      const freezesToUse = Math.min(diffDays - 1, currentUser.streakFreezes);
      currentUser.streakFreezes -= freezesToUse;
      let streak = parseInt(localStorage.getItem(`pland_streak_count_${email}`)) || 0;
      localStorage.setItem(`pland_streak_count_${email}`, streak.toString());
      localStorage.setItem(`pland_last_access_${email}`, todayKey);
      saveUserProfile();
      toast(`❄️ Seu Gelador de Ofensiva protegeu sua sequência! (${freezesToUse} usados)`);
    }
  }
}

function addXP(amount) {
  if (!currentUser) return;
  currentUser.xp = (currentUser.xp || 0) + amount;
  const oldLevel = getLevel(currentUser.xp - amount);
  const newLevel = getLevel(currentUser.xp);
  
  if (newLevel > oldLevel) {
    currentUser.dindins = (currentUser.dindins || 0) + 100;
    toast(`🎉 PARABÉNS! Você subiu para o Nível ${newLevel}! +100 DinDins 🪙`);
  } else {
    toast(`+${amount} XP ganho! 💪`);
  }
  saveUserProfile();
  renderGamificationUI();
}

function addDinDins(amount) {
  if (!currentUser) return;
  currentUser.dindins = (currentUser.dindins || 0) + amount;
  saveUserProfile();
  renderGamificationUI();
}

function getLevel(xp) {
  return Math.floor(xp / 100) + 1;
}

function getLevelTitle(level) {
  if (level <= 2) return 'Bronze';
  if (level <= 5) return 'Prata';
  if (level <= 10) return 'Ouro';
  if (level <= 20) return 'Platina';
  return 'Diamante';
}

function renderGamificationUI() {
  if (!currentUser) return;
  const level = getLevel(currentUser.xp || 0);
  const xpInCurrentLevel = (currentUser.xp || 0) % 100;
  
  if ($('dash-level')) $('dash-level').textContent = level;
  if ($('dash-level-title')) $('dash-level-title').textContent = getLevelTitle(level);
  if ($('dash-xp')) $('dash-xp').textContent = xpInCurrentLevel;
  if ($('dash-xp-progress')) $('dash-xp-progress').style.width = `${xpInCurrentLevel}%`;
  if ($('dash-dindins')) $('dash-dindins').textContent = currentUser.dindins || 0;
  if ($('shop-dindins-count')) $('shop-dindins-count').textContent = currentUser.dindins || 0;
  if ($('shop-streak-freezes')) $('shop-streak-freezes').textContent = currentUser.streakFreezes || 0;
}

// ─── LOJA ───
const THEME_NAMES = {
  classico: 'Padrão Apple',
  cyberpunk: 'Cyberpunk Neon',
  ouro: 'Ouro Luxury',
  duolingo: 'Verde Duolingo'
};

function applyTheme(theme) {
  document.body.className = '';
  if (theme !== 'classico') {
    document.body.classList.add(`theme-${theme}`);
  }
}

function renderShop() {
  const container = $('themes-activation-area');
  if (!container) return;
  
  const unlocked = currentUser.unlockedThemes || ['classico'];
  const active = currentUser.activeTheme || 'classico';
  
  let html = '';
  ['classico', 'cyberpunk', 'ouro', 'duolingo'].forEach(t => {
    const isUnlocked = unlocked.includes(t);
    const isActive = active === t;
    
    if (isUnlocked) {
      if (isActive) {
        html += `<span class="badge b-green" style="cursor:default; font-size:11px; margin-right:4px;">${THEME_NAMES[t]} (Ativo)</span>`;
      } else {
        html += `<button class="btn btn-secondary btn-sm" onclick="activateTheme('${t}')" style="padding:4px 8px; font-size:11px; margin-right:4px; margin-bottom:4px;">Ativar ${THEME_NAMES[t]}</button>`;
      }
    } else {
      html += `<span class="badge b-gray" style="font-size:11px; opacity:0.7; margin-right:4px; margin-bottom:4px;">🔒 ${THEME_NAMES[t]}</span>`;
    }
  });
  container.innerHTML = html;
  
  const btnBuyThemes = $('btn-buy-themes');
  if (btnBuyThemes) {
    const allUnlocked = unlocked.length >= 4;
    btnBuyThemes.disabled = allUnlocked;
    if (allUnlocked) btnBuyThemes.textContent = 'Adquiridos';
  }
}

function buyItem(itemType, price) {
  if (!currentUser) return;
  if ((currentUser.dindins || 0) < price) {
    toast('🪙 DinDins insuficientes para comprar este item.');
    return;
  }
  
  if (itemType === 'streak_freeze') {
    currentUser.dindins -= price;
    currentUser.streakFreezes = (currentUser.streakFreezes || 0) + 1;
    toast('🧊 Gelador de Ofensiva adquirido! Proteção ativada.');
  } else if (itemType === 'themes') {
    const allThemes = ['cyberpunk', 'ouro', 'duolingo'];
    const locked = allThemes.filter(t => !(currentUser.unlockedThemes || []).includes(t));
    if (locked.length === 0) {
      toast('Todos os temas já foram desbloqueados!');
      return;
    }
    const chosen = locked[Math.floor(Math.random() * locked.length)];
    currentUser.dindins -= price;
    if (!currentUser.unlockedThemes) currentUser.unlockedThemes = ['classico'];
    currentUser.unlockedThemes.push(chosen);
    toast(`🎨 Tema "${THEME_NAMES[chosen]}" desbloqueado na Loja!`);
  }
  
  saveUserProfile();
  renderShop();
  renderGamificationUI();
}

function activateTheme(theme) {
  if (!currentUser || !(currentUser.unlockedThemes || []).includes(theme)) return;
  currentUser.activeTheme = theme;
  applyTheme(theme);
  saveUserProfile();
  renderShop();
  toast(`🎨 Tema ${THEME_NAMES[theme]} aplicado!`);
}

// ─── DUELOS ───
const BOTS = [
  { name: 'Mestre da Poupança 🦉', streak: 6, winRate: 0.8 },
  { name: 'Duobot das Moedas 🤖', streak: 4, winRate: 0.6 },
  { name: 'PoupaBot Ninja 🥷', streak: 8, winRate: 0.9 },
  { name: 'Investidor Iniciante 👶', streak: 2, winRate: 0.4 }
];

function openCreateDuelModal() {
  const container = $('duel-opponents-list');
  if (!container) return;
  
  let html = '<strong>Robôs Simuladores:</strong>';
  BOTS.forEach((bot, idx) => {
    html += `
      <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer; margin-top:4px;">
        <input type="checkbox" name="duel_opp" value="bot_${idx}" style="accent-color:var(--apple-red);" checked />
        <span>${bot.name} (Streak Atual: ${bot.streak} dias)</span>
      </label>
    `;
  });
  
  const users = loadUsers().filter(u => u.email !== currentUser.email);
  if (users.length > 0) {
    html += '<strong style="margin-top:8px; display:block;">Outros Usuários no Dispositivo:</strong>';
    users.forEach(u => {
      html += `
        <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer; margin-top:4px;">
          <input type="checkbox" name="duel_opp" value="user_${u.email}" style="accent-color:var(--apple-red);" />
          <span>${u.nome} (E-mail: ${u.email})</span>
        </label>
      `;
    });
  }
  
  container.innerHTML = html;
  openModal('modal-duelo-criar');
}

function createDuel() {
  const title = $('duel-title').value.trim() || 'Duelo Financeiro';
  const duration = parseInt($('duel-duration').value) || 7;
  const checkboxes = document.querySelectorAll('input[name="duel_opp"]:checked');
  
  if (checkboxes.length === 0) {
    toast('Selecione pelo menos um oponente!');
    return;
  }
  
  const opponents = [];
  checkboxes.forEach(cb => {
    opponents.push(cb.value);
  });
  
  const newDuel = {
    id: uuid(),
    title,
    duration,
    startDate: dtKey(new Date()),
    opponents,
    active: true,
    results: {}
  };
  
  if (!currentUser.duels) currentUser.duels = [];
  currentUser.duels.push(newDuel);
  saveUserProfile();
  closeModal('modal-duelo-criar');
  
  addXP(30);
  addDinDins(10);
  
  toast('⚔️ Duelo criado com sucesso! Mostre sua ofensiva!');
  renderDuels();
}

function simulateBotStreakProgress(bot, daysPassed) {
  let botStreak = bot.streak;
  for(let i=0; i<daysPassed; i++) {
    if(Math.random() < bot.winRate) {
      botStreak++;
    } else {
      botStreak = 0;
    }
  }
  return botStreak;
}

function renderDuels() {
  const container = $('duels-list-container');
  if (!container) return;
  
  const duels = currentUser.duels || [];
  if (duels.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:var(--text-3); font-size:13px; padding:12px;">Nenhum duelo ativo. Criar desafio acima!</div>';
    return;
  }
  
  let html = '';
  duels.forEach(duel => {
    const start = parseDt(duel.startDate);
    const today = new Date(); today.setHours(0,0,0,0);
    const diffTime = Math.abs(today - start);
    const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const isFinished = daysPassed >= duel.duration;
    const userStreak = appData.streakCount || 1;
    
    const leaderboard = [
      { name: currentUser.nome.split(' ')[0] + ' (Você)', streak: userStreak, isUser: true }
    ];
    
    duel.opponents.forEach(opp => {
      if (opp.startsWith('bot_')) {
        const botIdx = parseInt(opp.split('_')[1]);
        const bot = BOTS[botIdx];
        const botSimulatedStreak = simulateBotStreakProgress(bot, daysPassed);
        leaderboard.push({ name: bot.name, streak: botSimulatedStreak, isUser: false });
      } else if (opp.startsWith('user_')) {
        const oppEmail = opp.split('_')[1];
        const oppUser = loadUsers().find(u => u.email === oppEmail);
        const oppStreak = parseInt(localStorage.getItem(`pland_streak_count_${oppEmail}`)) || 1;
        leaderboard.push({ name: (oppUser ? oppUser.nome : 'Jogador'), streak: oppStreak, isUser: false });
      }
    });
    
    leaderboard.sort((a,b) => b.streak - a.streak);
    const winner = leaderboard[0];
    const statusText = isFinished ? `🏆 Vencedor: ${winner.name}` : `⏳ Faltam ${duel.duration - daysPassed} dias`;
    
    html += `
      <div style="padding:12px; background:rgba(0,0,0,0.02); border-radius:var(--r-md); border:1px solid var(--border); margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong style="font-size:14px;">⚔️ ${duel.title}</strong>
          <span class="badge ${isFinished ? 'b-green' : 'b-blue'}" style="font-size:10px;">${statusText}</span>
        </div>
        <div style="font-size:12px; color:var(--text-2); display:flex; flex-direction:column; gap:4px;">
          ${leaderboard.map((player, rank) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:2px 0; ${player.isUser ? 'font-weight:bold; color:var(--apple-blue);' : ''}">
              <span>${rank + 1}º ${player.name}</span>
              <span>🔥 ${player.streak} dias</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function getBadgeArtworkHTML(badgeId) {
  if (badgeId === 'b_carteira') {
    return `<div class="badge-artwork"><div class="pk-wallet"><div class="pk-wallet-strap"></div><div class="pk-wallet-buckle"></div></div></div>`;
  }
  if (badgeId === 'b_moeda') {
    return `<div class="badge-artwork"><div class="pk-coin"><div class="pk-coin-inner">🪙</div></div></div>`;
  }
  if (badgeId === 'b_nota') {
    return `<div class="badge-artwork"><div class="pk-bill-wings"><div class="pk-wing-l"></div><div class="pk-bill">$$</div><div class="pk-wing-r"></div></div></div>`;
  }
  if (badgeId === 'b_poupanca') {
    return `<div class="badge-artwork"><div class="pk-pig"><div class="pk-pig-ear-l"></div><div class="pk-pig-ear-r"></div><div class="pk-pig-snout"></div></div></div>`;
  }
  if (badgeId === 'b_reserva') {
    return `<div class="badge-artwork"><div class="pk-shield"><div class="pk-shield-inner">🛡️</div></div></div>`;
  }
  if (badgeId === 'b_investimento') {
    return `<div class="badge-artwork"><div class="pk-sapphire"></div></div>`;
  }
  if (badgeId === 'b_duelo') {
    return `<div class="badge-artwork"><div class="pk-flame"></div></div>`;
  }
  if (badgeId === 'b_riqueza') {
    return `<div class="badge-artwork"><div class="pk-diamond"><div class="pk-diamond-inner"></div></div></div>`;
  }
  return '';
}

const POKEMON_INSIGNIAS = [
  { id: 'b_carteira', name: 'Insígnia da Carteira 💼', req: 'Estilo Pedra Cinza Metálico. Primeira transação registrada.', desc: 'Entrada na liga das finanças!', key: 'carteira', emoji: '💼' },
  { id: 'b_moeda', name: 'Insígnia da Moeda 🪙', req: 'Estilo Cascata/Bronze Cobre. Ofensiva de 7 dias.', desc: 'Consistência de bronze polido!', key: 'moeda', emoji: '🪙' },
  { id: 'b_nota', name: 'Insígnia da Nota 💵', req: 'Estilo Trovão/Esmeralda Metálico. Entrada e saída na mesma semana.', desc: 'Fluxo verde elétrico!', key: 'nota', emoji: '💵' },
  { id: 'b_poupanca', name: 'Insígnia da Poupança 🐷', req: 'Estilo Arco-Íris/Rosa Metalizado. Primeira economia guardada.', desc: 'Poupador holográfico!', key: 'poupanca', emoji: '🐷' },
  { id: 'b_reserva', name: 'Insígnia da Reserva 🛡️', req: 'Estilo Alma/Prata Escovado. Configurar meta de reserva.', desc: 'Escudo de aço financeiro!', key: 'reserva', emoji: '🛡' },
  { id: 'b_investimento', name: 'Insígnia do Investimento 📈', req: 'Estilo Pântano/Azul Safira. Fechar o mês com saldo positivo.', desc: 'Mestre da Safira!', key: 'investimento', emoji: '📈' },
  { id: 'b_duelo', name: 'Insígnia do Duelo ⚔️', req: 'Estilo Vulcão/Rubi Fogo. Criar ou vencer seu primeiro duelo.', desc: 'Guerreiro de Rubi!', key: 'duelo', emoji: '⚔️' },
  { id: 'b_riqueza', name: 'Insígnia da Riqueza 💎', req: 'Estilo Terra/Diamante Dourado. Atingir 100% da Reserva de Emergência.', desc: 'Mestre da liga DinDimpass!', key: 'riqueza', emoji: '💎' }
];

function checkUnlockedBadges() {
  const unlocked = [];
  const transacoes = appData.transacoes || [];
  
  if (transacoes.length > 0) unlocked.push('b_carteira');
  
  const activeStreak = simulatedStreakCount !== null ? simulatedStreakCount : (appData.streakCount || 1);
  if (activeStreak >= 7) unlocked.push('b_moeda');
  
  let hasIn = false; let hasOut = false;
  transacoes.forEach(t => {
    if (t.tipo === 'entrada') hasIn = true;
    if (t.tipo === 'saida' || t.tipo === 'diario') hasOut = true;
  });
  if (hasIn && hasOut) unlocked.push('b_nota');
  
  const hasEco = transacoes.some(t => t.tipo === 'economia');
  if (hasEco) unlocked.push('b_poupanca');
  
  if (currentUser.metaReserva && currentUser.metaReserva > 0) unlocked.push('b_reserva');
  
  const y = curDate.getFullYear(); const m = curDate.getMonth();
  const start = new Date(y, m, 1); const end = new Date(y, m+1, 0);
  const insts = getInstances(start, end);
  let ent=0, sai=0;
  insts.forEach(i => { if(i.tipo==='entrada') ent+=i.valor; else sai+=i.valor; });
  if (ent - sai > 0) unlocked.push('b_investimento');
  
  if (currentUser.duels && currentUser.duels.length > 0) unlocked.push('b_duelo');
  
  const allInsts = getInstances(new Date(2000, 0, 1), new Date(2099, 11, 31));
  const totalReserva = allInsts
    .filter(i => i.tipo === 'economia' && i.macro === 'Reserva de Emergência')
    .reduce((sum, i) => sum + i.valor, 0);
  if (currentUser.metaReserva > 0 && totalReserva >= currentUser.metaReserva) unlocked.push('b_riqueza');
  
  return unlocked;
}

function updateStreak() {
  if (!currentUser || !currentUser.email) return;
  const email = currentUser.email;
  const todayKey = dtKey(new Date());
  
  const lastAccess = localStorage.getItem(`pland_last_access_${email}`);
  let streak = parseInt(localStorage.getItem(`pland_streak_count_${email}`)) || 0;
  
  if (lastAccess) {
    if (lastAccess === todayKey) {
      if (streak === 0) streak = 1;
    } else {
      const lastDate = parseDt(lastAccess);
      const todayDate = new Date();
      todayDate.setHours(0,0,0,0);
      lastDate.setHours(0,0,0,0);
      
      const diffTime = Math.abs(todayDate - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        streak += 1;
      } else if (diffDays > 1) {
        streak = 1;
      }
    }
  } else {
    streak = 1;
  }
  
  localStorage.setItem(`pland_last_access_${email}`, todayKey);
  localStorage.setItem(`pland_streak_count_${email}`, streak.toString());
  
  appData.streakCount = streak;
  
  const sidebarStreak = $('sidebar-streak-count');
  if (sidebarStreak) sidebarStreak.textContent = streak;
  const dashStreak = $('dash-streak-count');
  if (dashStreak) dashStreak.textContent = streak;
}

function renderFrequencia() {
  const activeStreak = simulatedStreakCount !== null ? simulatedStreakCount : (appData.streakCount || 1);
  
  const today = new Date();
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

  if ($('freq-rank')) $('freq-rank').textContent = rank;
  if ($('freq-score')) $('freq-score').textContent = `${daysCount}/7 dias`;
  if ($('freq-progress')) $('freq-progress').style.width = `${(daysCount / 7) * 100}%`;
  if ($('freq-phrase')) $('freq-phrase').textContent = phrase;
  
  const container = $('badges-container');
  if (container) {
    container.innerHTML = '';
    const unlockedBadges = checkUnlockedBadges();
    
    POKEMON_INSIGNIAS.forEach(badge => {
      const isUnlocked = unlockedBadges.includes(badge.id);
      const statusText = isUnlocked ? 'Desbloqueada' : 'Bloqueada';
      const cardClass = isUnlocked ? 'badge-card unlocked' : 'badge-card locked';
      
      container.innerHTML += `
        <div class="${cardClass}" title="${badge.req}">
          <div class="badge-wrapper-outer ${isUnlocked ? '' : 'locked'}">
            <div class="badge-border-mask ${badge.id}"></div>
            <div class="pokemon-badge ${badge.id}">
              ${getBadgeArtworkHTML(badge.id)}
            </div>
          </div>
          <div class="badge-title" style="margin-top: 12px;">${badge.name}</div>
          <div class="badge-desc">${badge.req}</div>
          <div class="badge-status">${statusText}</div>
        </div>
      `;
    });
  }

  if (simulatedStreakCount !== null) {
    if ($('sim-streak-indicator')) $('sim-streak-indicator').style.display = 'block';
    if ($('sim-streak-val')) $('sim-streak-val').textContent = simulatedStreakCount;
  } else {
    if ($('sim-streak-indicator')) $('sim-streak-indicator').style.display = 'none';
  }
}

function simulateStreak(days) {
  simulatedStreakCount = days;
  renderFrequencia();
  toast(`🧪 Simulando ofensiva de ${days} dias!`);
}

function clearStreakSimulation() {
  simulatedStreakCount = null;
  renderFrequencia();
  toast('🧹 Simulação limpa. Ofensiva real restaurada.');
}
