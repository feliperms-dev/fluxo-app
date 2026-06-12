/**
 * Método do Breno — Types & Constants
 */

export const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const MESES_ABREV = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export const ANO_ATUAL = new Date().getFullYear();
export const MES_ATUAL = new Date().getMonth() + 1; // 1-indexed

/**
 * Cria uma estrutura de dados vazia para um ano financeiro
 * @param {number} ano
 * @param {number} saldoInicial
 * @returns {Object}
 */
export function criarAnoFinanceiro(ano = ANO_ATUAL, saldoInicial = 0) {
  return {
    ano,
    saldoInicial,
    meses: Array.from({ length: 12 }, (_, i) => criarMesFinanceiro(i + 1))
  };
}

/**
 * Cria uma estrutura de dados vazia para um mês
 * @param {number} mes - 1 to 12
 * @returns {Object}
 */
export function criarMesFinanceiro(mes) {
  return {
    mes,
    entradas: [],
    saidasFixas: [],
    orcamentoDiario: 0,
    gastosDiarios: []
  };
}

/**
 * Cria uma transação
 */
export function criarTransacao(descricao, valor, tipo) {
  return {
    id: crypto.randomUUID(),
    descricao,
    valor: parseFloat(valor) || 0,
    tipo, // 'entrada' | 'saida_fixa'
    recorrente: false,
    criadoEm: new Date().toISOString()
  };
}

/**
 * Cria um gasto diário
 */
export function criarGastoDiario(dia, valor, descricao = '') {
  return {
    id: crypto.randomUUID(),
    dia,
    valor: parseFloat(valor) || 0,
    descricao,
    criadoEm: new Date().toISOString()
  };
}
