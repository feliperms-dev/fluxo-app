'use strict';

// ─── UI CONTROLLERS ───
function startApp() {
  const runLoadData = () => {
    loadData(() => {
      curDate = new Date();
      const ntxData = $('ntx-data');
      if (ntxData) ntxData.value = dtKey(curDate);
      updateStreak();
      initGamificationState();
      navTo('dash');
    });
  };

  try {
    // Restaura backup do perfil local antes de renderizar
    if (currentUser && currentUser.email) {
      try {
        const localProfile = localStorage.getItem('pland_profile_' + getEmailKey());
        if (localProfile) {
          const pData = JSON.parse(localProfile);
          const profileFields = ['nome','sobrenome','nascimento','cpf','telefone','profissao','salario','geminiKey','metaReserva','orcamentoDiario','reservaMeses','diarioBreakdown'];
          profileFields.forEach(f => { if (pData[f] !== undefined) currentUser[f] = pData[f]; });
        }
      } catch(e) { console.warn('[DinDimpass] Erro ao restaurar perfil local:', e); }
    }

    const authWrapper = $('auth-wrapper');
    if (authWrapper) authWrapper.classList.add('hidden');
    const appLayout = $('app-layout');
    if (appLayout) appLayout.style.display = 'flex';

    const displayName = (currentUser.nome || currentUser.email.split('@')[0]) + (currentUser.sobrenome ? ' ' + currentUser.sobrenome : '');
    if ($('ui-name')) $('ui-name').textContent = displayName;
    if ($('ui-email')) $('ui-email').textContent = currentUser.email;
    if ($('ui-avatar')) $('ui-avatar').textContent = (currentUser.nome || currentUser.email).charAt(0).toUpperCase();

    const ntxDataInput = $('ntx-data');
    if (ntxDataInput) {
      ntxDataInput.addEventListener('change', () => {
        const selectedVal = ntxDataInput.value;
        if (selectedVal) {
          try {
            const d = parseDt(selectedVal);
            const elDiaSemana = $('ntx-dia-semana');
            const elDiaMes = $('ntx-dia-mes');
            if (elDiaSemana) elDiaSemana.value = d.getDay().toString();
            if (elDiaMes) elDiaMes.value = d.getDate().toString();
          } catch(e) { console.warn('[DinDimpass] Erro ao setar dia padrão:', e); }
        }
      });
      try {
        const d = new Date();
        const elDiaSemana = $('ntx-dia-semana');
        const elDiaMes = $('ntx-dia-mes');
        if (elDiaSemana) elDiaSemana.value = d.getDay().toString();
        if (elDiaMes) elDiaMes.value = d.getDate().toString();
      } catch(e) { console.warn('[DinDimpass] Erro ao inicializar campos de dia:', e); }
    }
  } catch(e) {
    console.error('[DinDimpass] Erro no setup da UI em startApp():', e);
  } finally {
    runLoadData();
  }
}

function navTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  const targetPage = $(`page-${page}`);
  if (targetPage) targetPage.classList.add('active');
  
  const navItem = document.querySelector(`[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');
  
  if(window.innerWidth <= 768) { 
    const sidebar = $('sidebar');
    if (sidebar) sidebar.classList.remove('open'); 
    const sidebarOverlay = $('sidebar-overlay');
    if (sidebarOverlay) sidebarOverlay.classList.remove('visible'); 
  }

  const mic = $('fab-mic');
  if (mic) {
    if (['semanal', 'mensal', 'anual', 'config', 'totais', 'frequencia', 'horizonte'].includes(page)) {
      mic.style.display = 'none';
    } else {
      mic.style.display = 'flex';
    }
  }

  if (page === 'dash') renderDash();
  if (page === 'semanal') renderSemanal();
  if (page === 'mensal') renderMensal();
  if (page === 'anual') renderAnual();
  if (page === 'totais') renderTotais();
  if (page === 'frequencia') renderFrequencia();
  if (page === 'horizonte') renderHorizonte();
  if (page === 'config') { 
    $('cfg-nome').value = currentUser.nome || ''; 
    $('cfg-sobrenome').value = currentUser.sobrenome || '';
    $('cfg-email').value = currentUser.email || '';
    $('cfg-nascimento').value = currentUser.nascimento || '';
    $('cfg-cpf').value = currentUser.cpf || '';
    $('cfg-telefone').value = currentUser.telefone || '';
    $('cfg-profissao').value = currentUser.profissao || '';
    $('cfg-salario').value = currentUser.salario || 0;
    $('cfg-gemini-key').value = currentUser.geminiKey || localStorage.getItem('gemini_api_key_' + getEmailKey()) || '';
    if ($('cfg-meta-reserva')) $('cfg-meta-reserva').value = currentUser.metaReserva || '';
    if ($('cfg-orcamento-diario')) $('cfg-orcamento-diario').value = currentUser.orcamentoDiario || '';
    if ($('cfg-reserva-meses')) $('cfg-reserva-meses').value = currentUser.reservaMeses || 6;
    
    // Popula o widget de Previsão de Diário
    const db = currentUser.diarioBreakdown || { comida: 0, transporte: 0, lazer: 0, compras: 0, saude: 0, outros: 0 };
    if ($('cfg-diario-comida')) $('cfg-diario-comida').value = db.comida || '';
    if ($('cfg-diario-transporte')) $('cfg-diario-transporte').value = db.transporte || '';
    if ($('cfg-diario-lazer')) $('cfg-diario-lazer').value = db.lazer || '';
    if ($('cfg-diario-compras')) $('cfg-diario-compras').value = db.compras || '';
    if ($('cfg-diario-saude')) $('cfg-diario-saude').value = db.saude || '';
    if ($('cfg-diario-outros')) $('cfg-diario-outros').value = db.outros || '';
    
    initApiKeyField();
    
    const config = JSON.parse(localStorage.getItem('pland_firebase_config')) || DEFAULT_FIREBASE_CONFIG;
    $('fb-api-key').value = config.apiKey === 'SUA_API_KEY' ? '' : config.apiKey;
    $('fb-auth-domain').value = config.authDomain === 'SEU_AUTH_DOMAIN' ? '' : config.authDomain;
    $('fb-project-id').value = config.projectId === 'SEU_PROJECT_ID' ? '' : config.projectId;
    $('fb-app-id').value = config.appId === 'SEU_APP_ID' ? '' : config.appId;
  }
}

function toggleSidebar() { 
  const sidebar = $('sidebar');
  if (sidebar) sidebar.classList.toggle('collapsed'); 
}
function toggleMobileSidebar() { 
  const sidebar = $('sidebar');
  if (sidebar) sidebar.classList.toggle('open'); 
  const sidebarOverlay = $('sidebar-overlay');
  if (sidebarOverlay) sidebarOverlay.classList.toggle('visible'); 
}
function closeModal(id) { 
  const el = $(id);
  if (el) el.classList.remove('active'); 
}
function openModal(id) { 
  const el = $(id);
  if (el) el.classList.add('active'); 
}

function toggleRepeatOptions(val) {
  const wrapper = $('ntx-repeat-wrapper');
  if (wrapper) wrapper.style.display = val === 'custom' ? 'block' : 'none';
}

function toggleCustomUnitOptions(unit) {
  const wk = $('ntx-custom-weekdays');
  const mt = $('ntx-custom-monthdays');
  if (wk) wk.style.display = unit === 'semanas' ? 'block' : 'none';
  if (mt) mt.style.display = unit === 'meses' ? 'block' : 'none';
}

function toggleEndCondition(type) {
  const fim = $('ntx-data-fim');
  const pc = $('ntx-parcelas-wrap');
  if (fim) fim.style.display = type === 'data' ? 'block' : 'none';
  if (pc) pc.style.display = type === 'parcelas' ? 'flex' : 'none';
}

function toggleFreqBaseOptions() {}
function toggleMonthlyPatternOptions() {}

function updateCfg() {
  const nome = $('cfg-nome').value.trim();
  const sobrenome = $('cfg-sobrenome').value.trim();
  const nascimento = $('cfg-nascimento').value;
  const cpf = $('cfg-cpf').value.trim();
  const telefone = $('cfg-telefone').value.trim();
  const profissao = $('cfg-profissao').value.trim();
  const salario = parseFloat($('cfg-salario').value) || 0;
  const geminiKey = $('cfg-gemini-key').value.trim();
  const metaReserva = parseFloat($('cfg-meta-reserva') ? $('cfg-meta-reserva').value : 0) || 0;
  const reservaMeses = parseInt($('cfg-reserva-meses') ? $('cfg-reserva-meses').value : 6) || 6;

  // Lógica dos inputs do widget de diário
  const comida = parseFloat($('cfg-diario-comida') ? $('cfg-diario-comida').value : 0) || 0;
  const transporte = parseFloat($('cfg-diario-transporte') ? $('cfg-diario-transporte').value : 0) || 0;
  const lazer = parseFloat($('cfg-diario-lazer') ? $('cfg-diario-lazer').value : 0) || 0;
  const compras = parseFloat($('cfg-diario-compras') ? $('cfg-diario-compras').value : 0) || 0;
  const saude = parseFloat($('cfg-diario-saude') ? $('cfg-diario-saude').value : 0) || 0;
  const outros = parseFloat($('cfg-diario-outros') ? $('cfg-diario-outros').value : 0) || 0;

  const totalMensalProjetado = comida + transporte + lazer + compras + saude + outros;
  const totalDaysInMonth = new Date(curDate.getFullYear(), curDate.getMonth() + 1, 0).getDate();
  const orcamentoCalculado = totalMensalProjetado > 0 ? (totalMensalProjetado / totalDaysInMonth) : (parseFloat($('cfg-orcamento-diario') ? $('cfg-orcamento-diario').value : 0) || 0);

  if ($('cfg-orcamento-diario')) {
    $('cfg-orcamento-diario').value = Math.round(orcamentoCalculado * 100) / 100;
  }

  if (!nome) { toast('O nome não pode estar vazio.'); return; }

  currentUser.nome = nome;
  currentUser.sobrenome = sobrenome;
  currentUser.nascimento = nascimento;
  currentUser.cpf = cpf;
  currentUser.telefone = telefone;
  currentUser.profissao = profissao;
  currentUser.salario = salario;
  currentUser.geminiKey = geminiKey;
  currentUser.metaReserva = metaReserva;
  currentUser.orcamentoDiario = Math.round(orcamentoCalculado * 100) / 100;
  currentUser.reservaMeses = reservaMeses;
  currentUser.diarioBreakdown = { comida, transporte, lazer, compras, saude, outros };

  saveUserProfile();

  if ($('ui-name')) $('ui-name').textContent = nome + (sobrenome ? ' ' + sobrenome : '');
  if ($('dash-greeting')) $('dash-greeting').textContent = `Olá, ${nome.split(' ')[0]}!`;

  toast('✅ Ajustes salvos e sincronizados!');
}

function exportData() {
  const blob = new Blob([JSON.stringify(appData, null, 2)], {type: 'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dindimpass_data_${currentUser.email}.json`; a.click();
}

// ─── ONBOARDING RÁPIDO ───
function checkOnboarding() {
  if (!currentUser) return;
  const key = `pland_onboarding_completed_${currentUser.email}`;
  const onboardingCompleted = localStorage.getItem(key);
  
  if (!onboardingCompleted) {
    openModal('modal-onboarding');
  }
}

function nextOnboardStep(step) {
  const s1 = $('onboard-step-1');
  const s2 = $('onboard-step-2');
  if (s1) s1.style.display = step === 1 ? 'block' : 'none';
  if (s2) s2.style.display = step === 2 ? 'block' : 'none';
}

function suggestOnboardReserva() {
  const mesesSug = parseInt($('onboard-reserva-meses').value) || 6;
  const salario = parseFloat($('onboard-salario').value) || 3000;
  const sugestao = Math.round((salario * 0.7) * mesesSug / 100) * 100;
  $('onboard-meta-reserva').value = sugestao;
  toast(`🤖 Reserva sugerida de ${fmt(sugestao)}`);
}

function saveOnboarding() {
  const profissao = $('onboard-profissao').value.trim();
  const salario = parseFloat($('onboard-salario').value) || 0;
  const metaReserva = parseFloat($('onboard-meta-reserva').value) || 0;
  const orcamentoDiario = parseFloat($('onboard-orcamento-diario').value) || 0;
  const reservaMeses = parseInt($('onboard-reserva-meses').value) || 6;
  
  currentUser.profissao = profissao;
  currentUser.salario = salario;
  currentUser.metaReserva = metaReserva;
  currentUser.orcamentoDiario = orcamentoDiario;
  currentUser.reservaMeses = reservaMeses;
  currentUser.onboardingCompleted = true;
  
  saveUserProfile();
  closeModal('modal-onboarding');
  
  localStorage.setItem(`pland_onboarding_completed_${currentUser.email}`, 'true');
  toast('🌱 Configurações iniciais salvas!');
  startQuickTour();
}

function skipOnboarding() {
  closeModal('modal-onboarding');
  if (currentUser) {
    localStorage.setItem(`pland_onboarding_completed_${currentUser.email}`, 'true');
  }
  startQuickTour();
}

// ─── AUTO-UPDATE (VERIFICADOR DE APK) ───
const APP_VERSION = '2.0.0';

function checkForUpdates() {
  console.log(`[DinDimpass] Verificando atualizações. Versão atual: ${APP_VERSION}`);
  fetch('version.json')
    .then(res => {
      if(res.ok) return res.json();
      throw new Error();
    })
    .then(data => {
      if (data && data.version && isNewerVersion(data.version, APP_VERSION)) {
        displayUpdateAlert(data.version, data.downloadUrl);
      }
    })
    .catch(() => {});
}

function isNewerVersion(vNew, vOld) {
  const newParts = vNew.split('.').map(Number);
  const oldParts = vOld.split('.').map(Number);
  for(let i=0; i<3; i++) {
    if(newParts[i] > oldParts[i]) return true;
    if(newParts[i] < oldParts[i]) return false;
  }
  return false;
}

function displayUpdateAlert(newVersion, downloadUrl) {
  const confirmUpdate = confirm(`Nova versão ${newVersion} disponível! Deseja baixar a atualização gratuita? Seus dados serão mantidos.`);
  if (confirmUpdate) {
    window.open(downloadUrl || 'https://github.com/usuario/dindimpass/releases', '_blank');
  }
}
