'use strict';

// ─── CONFIG & IMPORT IA CSV ───
// Alterna visibilidade da chave de API
function toggleApiKeyVisibility() {
  const input = $('cfg-gemini-key');
  const btn = $('btn-toggle-apikey');
  if (!input) return;
  const isHidden = input.style.filter === 'blur(4px)';
  if (isHidden) {
    input.style.filter = 'none';
    input.style.letterSpacing = '0.03em';
    if (btn) btn.textContent = '👁️';
    if (btn) btn.title = 'Ocultar chave';
  } else {
    input.style.filter = 'blur(4px)';
    input.style.letterSpacing = '0.3em';
    if (btn) btn.textContent = '🙈';
    if (btn) btn.title = 'Mostrar chave';
  }
}

// Aplica blur inicial na chave
function initApiKeyField() {
  const input = $('cfg-gemini-key');
  if (input && input.value) {
    input.style.filter = 'blur(4px)';
    input.style.letterSpacing = '0.3em';
    const btn = $('btn-toggle-apikey');
    if (btn) { btn.textContent = '🙈'; btn.title = 'Mostrar chave'; }
  }
}

function processCSV() {
  const fileInput = $('csv-upload');
  if(!fileInput || !fileInput.files.length) { toast('Selecione um arquivo primeiro.'); return; }
  
  if(typeof XLSX === 'undefined') { toast('Erro: Biblioteca de Planilha não carregou. Recarregue a página.'); return; }
  
  const apiKey = localStorage.getItem('gemini_api_key_' + currentUser.email);
  if(!apiKey) { toast('Por favor, configure sua chave do Gemini nos Ajustes primeiro!'); return; }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, {header: 1});
      
      if(rows.length <= 1) { toast('Planilha vazia ou sem dados.'); return; }
      
      const rowsToProcess = rows.slice(0, 500); // Limita a 500 linhas
      
      const btn = document.querySelector('button[onclick="processCSV()"]');
      const oldText = btn ? btn.textContent : '';
      if (btn) {
        btn.textContent = 'IA Gemini Processando... ⏳';
        btn.disabled = true;
      }

      const prompt = `Você é a inteligência financeira do app DinDimpass.
Analise os seguintes dados brutos extraídos de uma planilha financeira (CSV/Excel).
Seus objetivos:
1. Identificar se a planilha representa uma lista simples de transações ou uma matriz/grade de orçamento mensal.
2. Se a planilha for uma grade de orçamento mensal:
   - As linhas contêm categorias/descrições (como Condominio, Parcela Larissa Ex, Luz, Internet, Entradas total Salario, etc.) e as colunas representam os meses (como Abril, Maio, Junho, Julho, Agosto, Setembro, Outubro, Novembro, Dezembro) com os respectivos valores.
   - Há também colunas 'Dia' (ex: "Todo dia 10", "Todo dia 5", "Mesmo dia do salario", "Ultimo dia util de cada mês") e 'Frequência' (ex: "Sem data pra acabar", "Apenas uma vez", "até Outubro de 2026").
   - Ignore linhas de totais consolidados como 'Saidas total' ou 'Saldo'.
   - A linha 'Entradas total Salario' (ou similar contendo Salário) deve ser processada como tipo 'entrada' e categoria 'Salário'.
   - Outras linhas (ex: 'Condominio', 'Luz') são despesas do tipo 'saida' (ou 'diario' se for variável).
   - Para cada mês com valor maior que 0, crie uma transação individual. A data deve ser formada combinando o ano atual (2026), o mês correspondente da coluna (ex: Julho -> 07, Agosto -> 08, etc.) e o dia do mês extraído da coluna 'Dia' (ex: 'Todo dia 10' -> dia 10, 'Todo dia 5' -> dia 5, 'Mesmo dia do salario' -> dia 28/30/31 dependendo do mês, 'Ultimo dia util' -> último dia do mês).
   - As categorias (macro) para cada item devem ser atribuídas de forma inteligente (ex: 'Condominio' -> 'Moradia', 'Luz'/'Internet'/'Vivo' -> 'Moradia', 'Transporte Metro'/'Gasolina' -> 'Transporte', 'Fiel Torcedor'/'Barbeiro'/'Jogo' -> 'Lazer', 'Acordo Nubank'/'Larissa' -> 'Outros').
3. Se a planilha for uma lista tradicional de transações (uma transação por linha):
   - Mapeie cada linha para uma transação. Se a data for incompleta ou apenas o mês, assuma o dia 1 daquele mês no ano atual (2026).
4. Retorne a resposta estritamente como um array JSON de objetos no formato exato:
{
  "data": "YYYY-MM-DD",
  "desc": "descrição limpa da transação (ex: Condominio, Luz)",
  "valor": número positivo (float),
  "tipo": "entrada" | "saida" | "diario" | "economia",
  "macro": "Moradia" | "Alimentação" | "Transporte" | "Saúde" | "Lazer" | "Educação" | "Salário" | "Outros",
  "formaPagamento": "Pix" | "Crédito" | "Débito" | "Dinheiro"
}

Retorne APENAS o JSON limpo, sem markdown, sem explicações.

Dados brutos da planilha:
${JSON.stringify(rowsToProcess)}`;

      fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      })
      .then(async res => {
        if(!res.ok) {
          let errMsg = 'Erro status ' + res.status;
          try {
            const errJson = await res.json();
            if(errJson && errJson.error && errJson.error.message) {
              errMsg = errJson.error.message;
            }
          } catch(e) {}
          throw new Error(errMsg);
        }
        return res.json();
      })
      .then(result => {
        let jsonText = result.candidates[0].content.parts[0].text.trim();
        const startIdx = jsonText.indexOf('[');
        const endIdx = jsonText.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          jsonText = jsonText.substring(startIdx, endIdx + 1);
        } else {
          const startObj = jsonText.indexOf('{');
          const endObj = jsonText.lastIndexOf('}');
          if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
            jsonText = jsonText.substring(startObj, endObj + 1);
          }
        }
        
        let list = JSON.parse(jsonText);
        if (!Array.isArray(list) && list && typeof list === 'object') {
          for (const key in list) {
            if (Array.isArray(list[key])) {
              list = list[key];
              break;
            }
          }
        }
        
        if(Array.isArray(list)) {
          let imported = 0;
          list.forEach(item => {
            const valor = Math.abs(parseFloat(item.valor));
            if(isNaN(valor) || valor === 0) return;
            
            const tipo = ['entrada', 'saida', 'diario', 'economia'].includes(item.tipo) ? item.tipo : 'saida';
            const data = item.data || dtKey(new Date());
            const desc = item.desc || 'Transação';
            const macro = item.macro || 'Outros';
            const formaPagamento = item.formaPagamento || 'Pix';
            
            appData.transacoes.push({
              id: uuid(), tipo, valor, desc, data, frequencia: 'none', macro, formaPagamento
            });
            imported++;
          });
          saveData();
          toast(`Gemini IA processou ${imported} registros com sucesso!`);
          if (fileInput) fileInput.value = '';
          navTo('mensal');
        } else {
          throw new Error('Retorno da IA não é um formato de lista esperado.');
        }
      })
      .catch(err => {
        console.error(err);
        toast('Erro Gemini IA: ' + err.message);
      })
      .finally(() => {
        if (btn) {
          btn.textContent = oldText;
          btn.disabled = false;
        }
      });
      
    } catch(err) {
      console.error(err);
      toast('Erro ao carregar arquivo.');
    }
  };
  reader.readAsArrayBuffer(fileInput.files[0]);
}

// ─── IA DE VOZ (Speech Recognition Local) ───
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'pt-BR';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript.toLowerCase();
    console.log("Voz capturada: ", transcript);
    $('voice-overlay').classList.remove('active');
    
    let tipo = 'saida';
    if(transcript.includes('receb') || transcript.includes('ganhe') || transcript.includes('entrada')) tipo = 'entrada';
    
    const valueMatch = transcript.match(/(?:r\$)?\s?(\d+(?:[.,]\d+)?)/);
    let valor = 0;
    if(valueMatch) valor = parseFloat(valueMatch[1].replace(',', '.'));
    
    let macro = 'Outros';
    const catRules = { 'Alimentação': ['comida', 'ifood', 'pizza', 'mercado'], 'Transporte': ['uber', 'gasolina', 'onibus', 'posto'], 'Saúde': ['farmácia', 'remédio', 'médico'] };
    for(const [cat, kws] of Object.entries(catRules)) {
      if(kws.some(kw => transcript.includes(kw))) { macro = cat; break; }
    }
    
    if(valor > 0) {
      const tx = { id: uuid(), data: dtKey(new Date()), tipo, valor, desc: transcript, macro, frequencia: 'none', formaPagamento: 'Pix' };
      appData.transacoes.push(tx);
      saveData();
      addXP(20);
      addDinDins(5);
      renderDash();
      toast(`Registrado via voz: ${tipo} de ${fmt(valor)}`);
    } else {
      toast('Não consegui identificar um valor. Tente novamente.');
    }
  };

  recognition.onerror = function(event) {
    $('voice-overlay').classList.remove('active');
    toast('Erro no reconhecimento de voz: ' + event.error);
  };
}

function startVoice() {
  if(!recognition) { toast('Reconhecimento de voz não suportado neste navegador.'); return; }
  $('voice-overlay').classList.add('active');
  recognition.start();
}

function startVoiceAI() {
  startVoice();
}

// ─── IA INSIGHTS (Gemini) ───
function generateIAInsights() {
  const apiKey = (currentUser && currentUser.geminiKey) || localStorage.getItem('gemini_api_key_' + (currentUser ? currentUser.email : '')) || '';
  if (!apiKey) {
    toast('Configure sua chave de API do Gemini nos Ajustes primeiro!');
    return;
  }
  
  const container = $('ia-insights-container');
  if (container) {
    container.innerHTML = '<div style="display:flex; align-items:center; gap:8px;"><span>Analisando perfil de gastos com Gemini IA...</span><span style="font-size: 16px;">⏳</span></div>';
  }
  
  const btn = $('btn-generate-insights');
  if (btn) btn.disabled = true;
  
  const txSummary = appData.transacoes.map(t => ({
    data: t.data,
    tipo: t.tipo,
    valor: t.valor,
    macro: t.macro,
    desc: t.desc,
    frequencia: t.frequencia
  }));

  const type = $('ia-insight-type') ? $('ia-insight-type').value : 'completo';
  let focusPrompt = '';
  if (type === 'completo') {
    focusPrompt = 'Faça um Diagnóstico Completo do perfil financeiro. Analise o saldo acumulado, as maiores categorias de despesa e dê um panorama geral do comportamento de consumo.';
  } else if (type === 'mes_atual') {
    focusPrompt = 'Faça um Diagnóstico do Mês Atual. Foque estritamente nas receitas, despesas e saldo do mês corrente. Aponte picos de gastos e como fechar o mês no azul.';
  } else if (type === 'proj_3') {
    focusPrompt = 'Faça uma Projeção Financeira para os próximos 3 meses com base na média de receitas e despesas atuais. Aponte tendências e o saldo acumulado projetado.';
  } else if (type === 'proj_6') {
    focusPrompt = 'Faça uma Projeção Financeira para os próximos 6 meses com base na média de receitas e despesas atuais. Aponte tendências de longo prazo.';
  } else if (type === 'proj_12') {
    focusPrompt = 'Faça uma Projeção Financeira para os próximos 12 meses com base na média de receitas e despesas atuais. Aponte metas de poupança futuras.';
  } else if (type === 'sugestoes') {
    focusPrompt = 'Forneça Sugestões de Ações práticas, como opções de investimentos (Ex: Tesouro, CDB), diversificação (Ex: criptomoedas se adequado), e corte de gastos supérfluos recorrentes sem utilidade.';
  }
  
  const prompt = `Você é a inteligência artificial financeira oficial do app DinDimpass.
Analise o histórico financeiro e o perfil deste usuário para gerar um resumo de desempenho de forma inteligente.
Dados do usuário:
- Nome: ${currentUser.nome} ${currentUser.sobrenome || ''}
- Salário Mensal Cadastrado: R$ ${currentUser.salario || 0}
- Profissão: ${currentUser.profissao || 'Não informada'}
- Histórico de Lançamentos: ${JSON.stringify(txSummary)}
 
Foco da Análise: ${focusPrompt}

Objetivos da sua análise:
1. Seja direto, empático e extremamente analítico.
2. Gere insights bem enxutos, focados e resumidos em poucos bullet points fáceis de ler.
3. Use tags HTML limpas (<ul>, <li>, <strong>, <p>) para estruturar o texto. Não use blocos de código markdown (\`\`\`html) ou qualquer introdução/conclusão longa. Vá direto ao ponto.`;
 
  fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    })
  })
  .then(res => {
    if (!res.ok) throw new Error('Falha na API: ' + res.status);
    return res.json();
  })
  .then(result => {
    let htmlText = result.candidates[0].content.parts[0].text.trim();
    if (htmlText.startsWith('```')) {
      htmlText = htmlText.replace(/^```html\s*/i, '').replace(/```$/, '').trim();
    }
    if (container) container.innerHTML = htmlText;
    iaInsightsCached = htmlText;
  })
  .catch(err => {
    console.error(err);
    if (container) container.innerHTML = '<span style="color:var(--apple-red);">Erro ao gerar insights. Tente novamente ou verifique sua API Key nos Ajustes.</span>';
  })
  .finally(() => {
    if (btn) btn.disabled = false;
  });
}

// ─── STORIES CARD (CANVAS OFFLINE RENDERER) ───
function openShareCardModal() {
  const select = $('share-badge-select');
  if (!select) return;
  
  const unlocked = checkUnlockedBadges();
  if (unlocked.length === 0) {
    toast('Você precisa desbloquear pelo menos 1 insígnia para compartilhar!');
    return;
  }
  
  select.innerHTML = POKEMON_INSIGNIAS
    .filter(b => unlocked.includes(b.id))
    .map(b => `<option value="${b.id}">${b.name.replace(/[^a-zA-Z0-9\s]/g, '')}</option>`)
    .join('');
    
  updateShareStoriesCardView(select.value);
  openModal('modal-share-stories');
}

function updateShareStoriesCardView(badgeId) {
  const badge = POKEMON_INSIGNIAS.find(b => b.id === badgeId);
  if (!badge) return;
  
  const mask = $('stories-badge-mask');
  const display = $('stories-badge-display');
  const emoji = $('stories-badge-emoji');
  
  if (mask) mask.className = `badge-border-mask ${badgeId}`;
  if (display) display.className = `pokemon-badge ${badgeId}`;
  if (emoji) emoji.innerHTML = getBadgeArtworkHTML(badgeId);
  
  if ($('stories-user-name')) $('stories-user-name').textContent = currentUser.nome || 'Jogador';
  if ($('stories-badge-title')) $('stories-badge-title').textContent = badge.name;
  
  const streak = appData.streakCount || 1;
  if ($('stories-user-streak')) $('stories-user-streak').textContent = `🔥 ${streak} Dias de Ofensiva`;
}

function drawBadgePath(ctx, cx, cy, r, badgeId) {
  ctx.beginPath();
  let points = [];
  if (badgeId === 'b_carteira') {
    points = [[30, 0], [70, 0], [100, 30], [100, 70], [70, 100], [30, 100], [0, 70], [0, 30]];
  } else if (badgeId === 'b_moeda') {
    points = [[50, 0], [100, 50], [80, 100], [20, 100], [0, 50]];
  } else if (badgeId === 'b_nota') {
    points = [[50, 0], [65, 35], [100, 50], [65, 65], [50, 100], [35, 65], [0, 50], [35, 35]];
  } else if (badgeId === 'b_poupanca') {
    points = [[50, 0], [93, 25], [93, 75], [50, 100], [7, 75], [7, 25]];
  } else if (badgeId === 'b_reserva') {
    points = [[0, 0], [100, 0], [100, 50], [50, 100], [0, 50]];
  } else if (badgeId === 'b_investimento') {
    points = [[50, 0], [100, 38], [82, 100], [18, 100], [0, 38]];
  } else if (badgeId === 'b_duelo') {
    points = [[50, 0], [85, 35], [100, 70], [70, 100], [30, 100], [0, 70], [15, 35]];
  } else if (badgeId === 'b_riqueza') {
    points = [[50, 0], [100, 30], [80, 90], [50, 100], [20, 90], [0, 30]];
  } else {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    return;
  }
  
  const size = r * 2;
  const startX = cx - r;
  const startY = cy - r;
  
  points.forEach((p, idx) => {
    const px = startX + (p[0] / 100) * size;
    const py = startY + (p[1] / 100) * size;
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

function drawBadgeArtworkCanvas(ctx, cx, cy, badgeId) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  if (badgeId === 'b_carteira') {
    const grad = ctx.createLinearGradient(cx - 50, cy - 35, cx + 50, cy + 35);
    grad.addColorStop(0, '#7f8c8d');
    grad.addColorStop(1, '#34495e');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(cx - 50, cy - 35, 100, 70, 8);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.fillRect(cx + 20, cy - 20, 20, 40);
    
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(cx + 20, cy, 6, 0, Math.PI * 2);
    ctx.fill();

  } else if (badgeId === 'b_moeda') {
    const grad = ctx.createRadialGradient(cx - 15, cy - 15, 5, cx, cy, 50);
    grad.addColorStop(0, '#e67e22');
    grad.addColorStop(1, '#b87333');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪙', cx, cy);

  } else if (badgeId === 'b_nota') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = '#bdc3c7';
    ctx.lineWidth = 2;
    
    ctx.save();
    ctx.translate(cx - 40, cy - 10);
    ctx.rotate(-0.4);
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    
    ctx.save();
    ctx.translate(cx + 40, cy - 10);
    ctx.rotate(0.4);
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const grad = ctx.createLinearGradient(cx - 40, cy - 25, cx + 40, cy + 25);
    grad.addColorStop(0, '#2ecc71');
    grad.addColorStop(1, '#27ae60');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(cx - 40, cy - 25, 80, 50, 4);
    ctx.fill();
    ctx.stroke();
    
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$$', cx, cy);

  } else if (badgeId === 'b_poupanca') {
    ctx.fillStyle = '#f368e0';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 40, cy - 40);
    ctx.lineTo(cx - 20, cy - 45);
    ctx.lineTo(cx - 25, cy - 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(cx + 40, cy - 40);
    ctx.lineTo(cx + 20, cy - 45);
    ctx.lineTo(cx + 25, cy - 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const grad = ctx.createRadialGradient(cx - 15, cy - 15, 5, cx, cy, 50);
    grad.addColorStop(0, '#ff9ff3');
    grad.addColorStop(1, '#f368e0');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#ff9ff3';
    ctx.beginPath();
    ctx.roundRect(cx - 18, cy + 10, 36, 24, 12);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.arc(cx - 6, cy + 22, 3, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy + 22, 3, 0, Math.PI * 2);
    ctx.fill();

  } else if (badgeId === 'b_reserva') {
    const grad = ctx.createLinearGradient(cx - 45, cy - 50, cx + 45, cy + 50);
    grad.addColorStop(0, '#d2dae2');
    grad.addColorStop(1, '#485460');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 45, cy - 50);
    ctx.lineTo(cx + 45, cy - 50);
    ctx.lineTo(cx + 45, cy);
    ctx.lineTo(cx, cy + 50);
    ctx.lineTo(cx - 45, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#1e272e';
    ctx.beginPath();
    ctx.moveTo(cx - 25, cy - 35);
    ctx.lineTo(cx + 25, cy - 35);
    ctx.lineTo(cx + 25, cy - 5);
    ctx.lineTo(cx, cy + 30);
    ctx.lineTo(cx - 25, cy - 5);
    ctx.closePath();
    ctx.fill();
    
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#54a0ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛡️', cx, cy - 5);

  } else if (badgeId === 'b_investimento') {
    const grad = ctx.createLinearGradient(cx - 45, cy - 50, cx + 45, cy + 50);
    grad.addColorStop(0, '#54a0ff');
    grad.addColorStop(1, '#2e86de');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 50);
    ctx.lineTo(cx + 45, cy - 20);
    ctx.lineTo(cx + 30, cy + 45);
    ctx.lineTo(cx - 30, cy + 45);
    ctx.lineTo(cx - 45, cy - 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 50); ctx.lineTo(cx, cy + 45);
    ctx.moveTo(cx - 45, cy - 20); ctx.lineTo(cx + 45, cy - 20);
    ctx.moveTo(cx - 45, cy - 20); ctx.lineTo(cx, cy + 10); ctx.lineTo(cx + 45, cy - 20);
    ctx.stroke();

  } else if (badgeId === 'b_duelo') {
    const grad = ctx.createLinearGradient(cx, cy - 50, cx, cy + 50);
    grad.addColorStop(0, '#ff2a2a');
    grad.addColorStop(0.5, '#ee5253');
    grad.addColorStop(1, '#ff9f43');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy - 50);
    ctx.bezierCurveTo(cx + 35, cy - 25, cx + 45, cy + 15, cx + 25, cy + 45);
    ctx.bezierCurveTo(cx + 5, cy + 55, cx - 25, cy + 45, cx - 35, cy + 15);
    ctx.bezierCurveTo(cx - 45, cy - 25, cx, cy - 50, cx, cy - 50);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    const innerGrad = ctx.createLinearGradient(cx, cy - 10, cx, cy + 40);
    innerGrad.addColorStop(0, '#ffeaa7');
    innerGrad.addColorStop(1, '#fecb2f');
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 15);
    ctx.bezierCurveTo(cx + 15, cy, cx + 20, cy + 20, cx + 10, cy + 35);
    ctx.bezierCurveTo(cx, cy + 40, cx - 15, cy + 35, cx - 10, cy + 20);
    ctx.bezierCurveTo(cx - 20, cy, cx, cy - 15, cx, cy - 15);
    ctx.closePath();
    ctx.fill();

  } else {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    
    const grad = ctx.createLinearGradient(-35, -35, 35, 35);
    grad.addColorStop(0, '#ffeaa7');
    grad.addColorStop(0.5, '#fdcb6e');
    grad.addColorStop(1, '#ffeaa7');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.rect(-35, -35, 70, 70);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.strokeStyle = '#d39e00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-18, -18, 36, 36);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function downloadStoriesCard() {
  const badgeId = $('share-badge-select').value;
  const badge = POKEMON_INSIGNIAS.find(b => b.id === badgeId);
  if (!badge) return;
  
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 1280;
  const ctx = canvas.getContext('2d');
  
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 1280);
  bgGrad.addColorStop(0, '#111827');
  bgGrad.addColorStop(1, '#030712');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 720, 1280);
  
  const holoGrad = ctx.createLinearGradient(0, 0, 720, 1280);
  holoGrad.addColorStop(0, 'rgba(255, 0, 128, 0.05)');
  holoGrad.addColorStop(0.5, 'rgba(0, 255, 255, 0.08)');
  holoGrad.addColorStop(1, 'rgba(255, 255, 0, 0.05)');
  ctx.fillStyle = holoGrad;
  ctx.fillRect(0, 0, 720, 1280);
  
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#facc15';
  ctx.strokeRect(20, 20, 680, 1240);
  
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(32, 32, 656, 1216);

  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = '#facc15';
  ctx.textAlign = 'center';
  ctx.fillText('CLASSIFICADO', 360, 120);
  
  ctx.font = '24px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('JORNADA DINDIMPASS', 360, 170);

  const cx = 360;
  const cy = 480;
  const r = 160;
  
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 12;

  const borderGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  if (badgeId === 'b_carteira') {
    borderGrad.addColorStop(0, '#e2e8f0'); borderGrad.addColorStop(0.5, '#94a3b8'); borderGrad.addColorStop(1, '#475569');
  } else if (badgeId === 'b_moeda') {
    borderGrad.addColorStop(0, '#fbcfe8'); borderGrad.addColorStop(0.5, '#f472b6'); borderGrad.addColorStop(1, '#db2777');
  } else if (badgeId === 'b_nota') {
    borderGrad.addColorStop(0, '#fef08a'); borderGrad.addColorStop(0.5, '#facc15'); borderGrad.addColorStop(1, '#ca8a04');
  } else if (badgeId === 'b_poupanca') {
    borderGrad.addColorStop(0, '#fbcfe8'); borderGrad.addColorStop(0.5, '#c084fc'); borderGrad.addColorStop(1, '#818cf8');
  } else if (badgeId === 'b_reserva') {
    borderGrad.addColorStop(0, '#e2e8f0'); borderGrad.addColorStop(0.5, '#94a3b8'); borderGrad.addColorStop(1, '#475569');
  } else if (badgeId === 'b_investimento') {
    borderGrad.addColorStop(0, '#93c5fd'); borderGrad.addColorStop(0.5, '#3b82f6'); borderGrad.addColorStop(1, '#1d4ed8');
  } else if (badgeId === 'b_duelo') {
    borderGrad.addColorStop(0, '#fecaca'); borderGrad.addColorStop(0.5, '#ef4444'); borderGrad.addColorStop(1, '#b91c1c');
  } else {
    borderGrad.addColorStop(0, '#ffe066'); borderGrad.addColorStop(0.5, '#facc15'); borderGrad.addColorStop(1, '#d97706');
  }
  
  drawBadgePath(ctx, cx, cy, r + 8, badgeId);
  ctx.fillStyle = borderGrad;
  ctx.fill();
  
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  const badgeGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  if (badgeId === 'b_carteira') {
    badgeGrad.addColorStop(0, '#4b5563'); badgeGrad.addColorStop(0.25, '#9ca3af'); badgeGrad.addColorStop(0.5, '#f3f4f6'); badgeGrad.addColorStop(0.75, '#4b5563'); badgeGrad.addColorStop(1, '#1f2937');
  } else if (badgeId === 'b_moeda') {
    badgeGrad.addColorStop(0, '#b87333'); badgeGrad.addColorStop(0.3, '#cd7f32'); badgeGrad.addColorStop(0.5, '#ffffff'); badgeGrad.addColorStop(0.7, '#b87333'); badgeGrad.addColorStop(1, '#8b4513');
  } else if (badgeId === 'b_nota') {
    badgeGrad.addColorStop(0, '#16a085'); badgeGrad.addColorStop(0.3, '#2ecc71'); badgeGrad.addColorStop(0.5, '#ffffff'); badgeGrad.addColorStop(0.7, '#16a085'); badgeGrad.addColorStop(1, '#064e3b');
  } else if (badgeId === 'b_poupanca') {
    badgeGrad.addColorStop(0, '#ec4899'); badgeGrad.addColorStop(0.25, '#f472b6'); badgeGrad.addColorStop(0.5, '#c084fc'); badgeGrad.addColorStop(0.75, '#60a5fa'); badgeGrad.addColorStop(1, '#34d399');
  } else if (badgeId === 'b_reserva') {
    badgeGrad.addColorStop(0, '#708090'); badgeGrad.addColorStop(0.3, '#c0c0c0'); badgeGrad.addColorStop(0.5, '#ffffff'); badgeGrad.addColorStop(0.7, '#708090'); badgeGrad.addColorStop(1, '#778899');
  } else if (badgeId === 'b_investimento') {
    badgeGrad.addColorStop(0, '#0f172a'); badgeGrad.addColorStop(0.3, '#1e3a8a'); badgeGrad.addColorStop(0.6, '#3b82f6'); badgeGrad.addColorStop(0.85, '#93c5fd'); badgeGrad.addColorStop(1, '#1e3a8a');
  } else if (badgeId === 'b_duelo') {
    badgeGrad.addColorStop(0, '#7f1d1d'); badgeGrad.addColorStop(0.3, '#b91c1c'); badgeGrad.addColorStop(0.6, '#f87171'); badgeGrad.addColorStop(0.85, '#f59e0b'); badgeGrad.addColorStop(1, '#7f1d1d');
  } else {
    badgeGrad.addColorStop(0, '#eab308'); badgeGrad.addColorStop(0.25, '#fef08a'); badgeGrad.addColorStop(0.5, '#60a5fa'); badgeGrad.addColorStop(0.75, '#c084fc'); badgeGrad.addColorStop(1, '#eab308');
  }
  
  drawBadgePath(ctx, cx, cy, r, badgeId);
  ctx.fillStyle = badgeGrad;
  ctx.fill();

  ctx.save();
  drawBadgePath(ctx, cx, cy, r, badgeId);
  ctx.clip();
  const shineGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  shineGrad.addColorStop(0, 'rgba(255,255,255,0)');
  shineGrad.addColorStop(0.4, 'rgba(255,255,255,0)');
  shineGrad.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  shineGrad.addColorStop(0.6, 'rgba(255,255,255,0)');
  shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shineGrad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
  
  drawBadgeArtworkCanvas(ctx, cx, cy, badgeId);

  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(currentUser.nome || 'Jogador', 360, 780);
  
  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = '#facc15';
  ctx.fillText(badge.name.toUpperCase(), 360, 840);
  
  const streak = appData.streakCount || 1;
  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = '#ffa500';
  ctx.fillText(`🔥 ${streak} Dias de Ofensiva`, 360, 920);

  ctx.font = '24px sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('dindimpass.web.app', 360, 1150);
  
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `dindimpass_stories_${badgeId}.png`;
  a.click();
  toast('📸 Card Stories baixado com sucesso!');
}

// ─── TOUR RÁPIDO DE 3 PASSOS ───
let tourStep = 0;
const TOUR_STEPS = [
  { element: 'page-dash', title: 'Dashboard', desc: 'Acompanhe seu Saldo, Ofensiva, XP e Nível, além dos conselhos automáticos da IA.', arrow: 'arrow-top' },
  { element: 'page-semanal', title: 'Registro Semanal/Mensal', desc: 'Anote receitas e despesas diretamente na tabela de cada dia com um clique rápido.', arrow: 'arrow-top' },
  { element: 'page-config', title: 'Metas, Duelos e Loja', desc: 'Compre molduras, temas premium e geladores com moedas na Loja, além de gerenciar duelos!', arrow: 'arrow-top' }
];

function startQuickTour(forced = false) {
  if (!currentUser) return;
  const tourCompleted = localStorage.getItem(`pland_tour_completed_${currentUser.email}`);
  if (tourCompleted && !forced) return;
  
  tourStep = 0;
  const tourOverlay = $('tour-overlay');
  if (tourOverlay) {
    tourOverlay.classList.add('active');
    showTourStep();
  }
}

function showTourStep() {
  const step = TOUR_STEPS[tourStep];
  navTo(step.element.replace('page-', ''));
  
  const tooltip = $('tour-tooltip');
  if (tooltip) {
    $('tour-step-title').textContent = `${tourStep + 1}/3 - ${step.title}`;
    $('tour-step-desc').textContent = step.desc;
    
    tooltip.style.left = '50%';
    tooltip.style.top = '40%';
    tooltip.style.transform = 'translate(-50%, -50%)';
    tooltip.className = 'tour-tooltip';
  }
  
  const btnNext = $('btn-tour-next');
  if (btnNext) {
    btnNext.textContent = tourStep === 2 ? 'Concluir 🎉' : 'Avançar ➔';
  }
}

function nextTourStep() {
  tourStep++;
  if (tourStep >= TOUR_STEPS.length) {
    endTour();
  } else {
    showTourStep();
  }
}

function endTour() {
  const tourOverlay = $('tour-overlay');
  if (tourOverlay) tourOverlay.classList.remove('active');
  if (currentUser) {
    localStorage.setItem(`pland_tour_completed_${currentUser.email}`, 'true');
  }
  toast('🎉 Tour concluído! Bons registros!');
}
