'use strict';

// ─── FIREBASE CONFIG (CLOUD SYNC) ───
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCACYJEwQ2GPj5gjTAIcxQW_K6Cplv1M-o",
  authDomain: "weekly-flow-bb73d.firebaseapp.com",
  projectId: "weekly-flow-bb73d",
  storageBucket: "weekly-flow-bb73d.firebasestorage.app",
  messagingSenderId: "1014937869337",
  appId: "1:1014937869337:web:0debedc2fa66fdbc80de88"
};

let activeFirebaseConfig = null;
try {
  const customConfig = localStorage.getItem('pland_firebase_config');
  if (customConfig) {
    activeFirebaseConfig = JSON.parse(customConfig);
  } else {
    activeFirebaseConfig = DEFAULT_FIREBASE_CONFIG;
  }
} catch (e) {
  activeFirebaseConfig = DEFAULT_FIREBASE_CONFIG;
}

let useFirebase = false;
if (typeof firebase !== 'undefined' && activeFirebaseConfig.apiKey && activeFirebaseConfig.apiKey !== "SUA_API_KEY") {
  try {
    firebase.initializeApp(activeFirebaseConfig);
    useFirebase = true;
    console.log("Firebase inicializado!");
  } catch (err) {
    console.error("Erro ao inicializar o Firebase:", err);
  }
}

// ─── STATE & DB ───
const USERS_KEY = 'pland_users';
let currentUser = null;
let appData = { saldoInicial: 0, transacoes: [] };

let curDate = new Date();
let selectedDateForModal = null; 
let curNewTxType = 'saida';
let curMdType = 'saida';
let weeklyViewType = 'saida';
let weeklyViewMode = 'semana'; // 'semana' ou 'mes'
let chartDash = null; 
let chartAnnual = null;

// ─── UTILS ───
function $(id) { return document.getElementById(id); }
function uuid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function fmt(val) { return 'R$ ' + parseFloat(val).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function toast(msg) {
  const t = $('toast'); 
  if (t) {
    t.textContent = msg; 
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  } else {
    console.log("[Toast fallback] " + msg);
  }
}
function dtKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function parseDt(k) { const [y,m,d] = k.split('-'); return new Date(y, m-1, d); }

function getEmailKey() {
  let email = '';
  if (currentUser && currentUser.email) {
    email = currentUser.email;
  } else if (useFirebase && firebase.auth().currentUser && firebase.auth().currentUser.email) {
    email = firebase.auth().currentUser.email;
  }
  return email ? email.toLowerCase().trim() : 'default';
}

// ─── MACRO CATEGORIAS POR TIPO ───
const MACRO_CATS = {
  saida: [
    { v: 'Moradia', l: '🏠 Moradia' },
    { v: 'Alimentação', l: '🍔 Alimentação' },
    { v: 'Transporte', l: '🚗 Transporte' },
    { v: 'Saúde', l: '❤️ Saúde' },
    { v: 'Lazer', l: '🎉 Lazer' },
    { v: 'Educação', l: '📚 Educação' },
    { v: 'Vestuário', l: '👕 Vestuário' },
    { v: 'Assinaturas', l: '📱 Assinaturas' },
    { v: 'Outros', l: '📦 Outros' }
  ],
  entrada: [
    { v: 'Salário', l: '💰 Salário' },
    { v: '13º (1ª Parcela)', l: '🎁 13º (1ª Parcela)' },
    { v: '13º (2ª Parcela)', l: '🎁 13º (2ª Parcela)' },
    { v: 'Bônus', l: '⭐ Bônus' },
    { v: 'PLR', l: '📊 PLR' },
    { v: 'Freelance', l: '💻 Freelance' },
    { v: 'Venda Pontual', l: '🛒 Venda Pontual' },
    { v: 'Férias', l: '🏖️ Férias' },
    { v: '1/3 de Férias', l: '✈️ 1/3 de Férias' }
  ],
  economia: [
    { v: 'Reserva de Emergência', l: '🛡️ Reserva de Emergência' },
    { v: 'Investimentos', l: '📈 Investimentos' },
    { v: 'Projeto Pessoal', l: '🎯 Projeto Pessoal' }
  ],
  diario: [
    { v: 'Variáveis', l: '📅 Variáveis' },
    { v: 'Outros', l: '📦 Outros' }
  ]
};
