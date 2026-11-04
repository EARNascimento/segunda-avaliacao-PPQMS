/* =========================================================
   status.js — Regras do fluxo Kanban (sem acesso a DOM/localStorage)
   Contém: colunas, limites WIP, classes de serviço, podeMover(),
   ordenação de fila e alertas de risco.
   ========================================================= */

const COLUNAS = [
  { id: 1, nome: 'Recebido / Triagem',   wip: null },
  { id: 2, nome: 'Em Diagnóstico',       wip: 5 },
  { id: 3, nome: 'Aguardando Aprovação', wip: null },
  { id: 4, nome: 'Em Conserto',          wip: 4 },
  { id: 5, nome: 'Testes Finais',        wip: 3 },
  { id: 6, nome: 'Pronto / Finalizado',  wip: null }
];

const CLASSES = {
  urgente:  { rotulo: 'Urgente',   icone: '🔴', peso: 1 },
  dataFixa: { rotulo: 'Data Fixa', icone: '🟡', peso: 2 },
  padrao:   { rotulo: 'Padrão',    icone: '🔵', peso: 3 }
};

const ETIQUETA_SEM_CONSERTO = 'Devolver sem conserto';
const VALIDADE_ORCAMENTO_DIAS = 5;

function getColuna(id) {
  return COLUNAS.find(c => c.id === id);
}

function contarNaColuna(lista, colunaId) {
  return lista.filter(os => os.coluna === colunaId).length;
}

/**
 * Decide se uma OS pode ir para a coluna de destino.
 * @param {object} os            OS com { coluna, classe }
 * @param {number} destino       id da coluna de destino (1..6)
 * @param {Array}  lista         todas as OS (para contar o WIP)
 * @param {object} opts          { recusa: true } quando o cliente recusa o orçamento
 * @returns {{ok:boolean, motivo:string, excedeWip:boolean}}
 */
function podeMover(os, destino, lista, opts = {}) {
  const atual = os.coluna;
  const nomeDestino = getColuna(destino) ? getColuna(destino).nome : '?';

  if (!getColuna(destino)) {
    return { ok: false, motivo: 'Coluna de destino inexistente.', excedeWip: false };
  }

  // 1) Transições estruturais
  const avancoNormal = destino === atual + 1 && !(atual === 3); // 3 -> 4 só por aprovação (tratado abaixo)
  const aprovacao    = atual === 3 && destino === 4 && opts.aprovacao === true;
  const recusa       = atual === 3 && destino === 6 && opts.recusa === true;
  const retorno      = atual === 5 && destino === 4;

  if (atual === 3 && destino === 4 && !opts.aprovacao) {
    return { ok: false, motivo: 'Só o cliente aprovando o orçamento move a OS para Em Conserto.', excedeWip: false };
  }
  if (atual === 3 && destino === 6 && !opts.recusa) {
    return { ok: false, motivo: 'Só a recusa do orçamento leva a OS direto para Pronto.', excedeWip: false };
  }
  if (atual === 2 && destino === 3 && !opts.orcamento) {
    return { ok: false, motivo: 'Para mover a OS para Aguardando Aprovação, registre o diagnóstico e envie o orçamento.', excedeWip: false };
  }
  if (!(avancoNormal || aprovacao || recusa || retorno)) {
    let motivo = `Movimento não permitido: a OS só avança para a coluna seguinte.`;
    if (destino < atual) motivo = 'Voltar etapas não é permitido (exceto Testes Finais → Em Conserto).';
    if (destino > atual + 1) motivo = 'Não é permitido pular etapas do fluxo.';
    if (destino === atual) motivo = 'A OS já está nessa coluna.';
    return { ok: false, motivo, excedeWip: false };
  }

  // 2) Limite WIP
  const colDestino = getColuna(destino);
  if (colDestino.wip !== null) {
    const qtd = contarNaColuna(lista, destino);
    if (qtd >= colDestino.wip) {
      if (os.classe === 'urgente') {
        return {
          ok: true,
          excedeWip: true,
          motivo: `WIP excedido em "${nomeDestino}" (${qtd + 1}/${colDestino.wip}) — permitido por ser Urgente.`
        };
      }
      return {
        ok: false,
        excedeWip: false,
        motivo: `"${nomeDestino}" está no limite WIP (${qtd}/${colDestino.wip}). Só chamados Urgentes podem exceder.`
      };
    }
  }

  return { ok: true, motivo: 'Movimento permitido.', excedeWip: false };
}

/* ---------- Datas e alertas de risco ---------- */

// Conta dias úteis (seg–sex) entre duas datas
function diasUteisEntre(inicio, fim) {
  const a = new Date(inicio), b = new Date(fim);
  if (b <= a) return 0;
  let dias = 0;
  const cursor = new Date(a);
  cursor.setHours(0, 0, 0, 0);
  const limite = new Date(b);
  limite.setHours(0, 0, 0, 0);
  while (cursor < limite) {
    cursor.setDate(cursor.getDate() + 1);
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) dias++;
  }
  return dias;
}

/**
 * Retorna o motivo do risco ou null se a OS está tranquila.
 * - Data Fixa: faltam < 24h (ou já venceu)
 * - Padrão: parada > 3 dias úteis na mesma coluna
 * OS na coluna 6 não entram em risco.
 */
function riscoDaOS(os, agora = new Date()) {
  if (os.coluna === 6) return null;
  if (os.classe === 'dataFixa' && os.dataLimite) {
    const faltam = new Date(os.dataLimite) - agora;
    if (faltam < 0) return 'Prazo vencido';
    if (faltam < 24 * 60 * 60 * 1000) return 'Prazo em risco (< 24h)';
  }
  if (os.classe === 'padrao') {
    if (diasUteisEntre(os.entradaColunaEm, agora) > 3) return 'Parada há mais de 3 dias úteis';
  }
  return null;
}

/* ---------- Ordenação da fila por classe de serviço ---------- */
function ordenarFila(lista) {
  return [...lista].sort((a, b) => {
    const pa = CLASSES[a.classe].peso, pb = CLASSES[b.classe].peso;
    if (pa !== pb) return pa - pb;
    // Data Fixa: o prazo mais próximo primeiro
    if (a.classe === 'dataFixa' && a.dataLimite && b.dataLimite) {
      const d = new Date(a.dataLimite) - new Date(b.dataLimite);
      if (d !== 0) return d;
    }
    // Desempate: ordem de chegada na coluna (FIFO)
    return new Date(a.entradaColunaEm) - new Date(b.entradaColunaEm);
  });
}