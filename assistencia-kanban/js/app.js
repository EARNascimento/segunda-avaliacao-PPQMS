/* =========================================================
   app.js — localStorage, autenticação simulada e utilitários
   Depende de status.js (carregue status.js ANTES deste arquivo)
   ========================================================= */

const CHAVES = {
  usuario: 'usuario_logado',
  agendamentos: 'agendamentos',
  ordens: 'ordens_servico',
  orcamentos: 'orcamentos'
};

/* ---------- Acesso ao localStorage ---------- */
const DB = {
  ler(chave, padrao = []) {
    try {
      const bruto = localStorage.getItem(chave);
      return bruto ? JSON.parse(bruto) : padrao;
    } catch (e) {
      console.warn('Falha ao ler', chave, e);
      return padrao;
    }
  },
  gravar(chave, valor) {
    localStorage.setItem(chave, JSON.stringify(valor));
  },
  remover(chave) {
    localStorage.removeItem(chave);
  }
};

/* ---------- Autenticação simulada ---------- */
const Auth = {
  usuario() {
    return DB.ler(CHAVES.usuario, null);
  },
  entrar(nome, perfil) {
    DB.gravar(CHAVES.usuario, { nome: nome.trim(), perfil });
  },
  sair() {
    DB.remover(CHAVES.usuario);
  },
  /** Use no topo das páginas protegidas. Redireciona se o perfil não confere. */
  exigirPerfil(perfisPermitidos) {
    const u = this.usuario();
    if (!u || !perfisPermitidos.includes(u.perfil)) {
      sessionStorage.setItem('acesso_negado', '1');
      window.location.href = 'index.html';
      return null;
    }
    return u;
  }
};

/* ---------- Ordens de serviço ---------- */
const OS = {
  todas() {
    return DB.ler(CHAVES.ordens, []);
  },
  salvarTodas(lista) {
    DB.gravar(CHAVES.ordens, lista);
  },
  buscar(id) {
    return this.todas().find(o => o.id === id);
  },
  proximoId() {
    const nums = this.todas().map(o => parseInt(o.id.replace('#OS-', ''), 10));
    return '#OS-' + (nums.length ? Math.max(...nums) + 1 : 1001);
  },
  /** Registra uma entrada na trilha de auditoria da OS (mutação em memória). */
  registrarHistorico(os, acao, autor) {
    const agora = new Date();
    os.historico.push({
      data: agora.toLocaleDateString('pt-BR'),
      hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      autor: autor || (Auth.usuario() ? Auth.usuario().nome : 'Sistema'),
      acao,
      iso: agora.toISOString()
    });
  }
};

/* ---------- Dados de exemplo (seed) ---------- */
function diasAtras(n, horas = 0) {
  return new Date(Date.now() - n * 86400000 - horas * 3600000).toISOString();
}
function emHoras(h) {
  return new Date(Date.now() + h * 3600000).toISOString();
}

function criarOSSeed(num, cliente, marca, modelo, defeito, classe, coluna, diasNaColuna, extra = {}) {
  const entrada = diasAtras(diasNaColuna);
  const os = {
    id: '#OS-' + num,
    cliente, marca, modelo, defeito, classe, coluna,
    dataLimite: extra.dataLimite || null,
    etiqueta: extra.etiqueta || null,
    tecnico: coluna >= 2 ? 'Marina' : null,
    criadaEm: diasAtras(diasNaColuna + 2),
    entradaColunaEm: entrada,
    historico: [
      { data: new Date(diasAtras(diasNaColuna + 2)).toLocaleDateString('pt-BR'), hora: '09:00', autor: 'Marina', acao: 'OS criada em Recebido / Triagem', iso: diasAtras(diasNaColuna + 2) }
    ]
  };
  if (coluna > 1) {
    os.historico.push({
      data: new Date(entrada).toLocaleDateString('pt-BR'), hora: '14:30', autor: 'Marina',
      acao: `Movida para ${getColuna(coluna).nome}`, iso: entrada
    });
  }
  return os;
}

function gerarDadosExemplo() {
  const o = criarOSSeed;
  const lista = [
    o(1001, 'Carlos', 'Samsung', 'Galaxy A54', 'Tela trincada', 'padrao', 1, 0),
    o(1002, 'Ana Souza', 'Apple', 'iPhone 11', 'Bateria não carrega', 'dataFixa', 1, 0, { dataLimite: emHoras(12) }),
    o(1003, 'Carlos', 'Motorola', 'Moto G32', 'Não liga', 'padrao', 2, 5),
    o(1004, 'Bruno Lima', 'Xiaomi', 'Redmi Note 12', 'Sem áudio', 'urgente', 2, 1),
    o(1005, 'Carlos', 'Apple', 'iPhone 13', 'Câmera embaçada', 'padrao', 3, 1),
    o(1006, 'Julia Reis', 'Samsung', 'Galaxy S21', 'Molhou', 'dataFixa', 4, 2, { dataLimite: emHoras(72) }),
    o(1007, 'Pedro Alves', 'Motorola', 'Edge 30', 'Botão power', 'padrao', 4, 1),
    o(1008, 'Carlos', 'Xiaomi', 'Poco X5', 'Touch falhando', 'padrao', 4, 1),
    o(1009, 'Lia Santos', 'Samsung', 'Galaxy A32', 'Tela trincada', 'padrao', 5, 1),
    o(1010, 'Rafa Dias', 'Apple', 'iPhone 12', 'Face ID', 'dataFixa', 5, 1, { dataLimite: emHoras(30) }),
    o(1011, 'Marta Cruz', 'Motorola', 'Moto E22', 'Bateria viciada', 'padrao', 5, 0),
    o(1012, 'Carlos', 'Samsung', 'Galaxy J7', 'Conector de carga', 'padrao', 6, 1)
  ];
  OS.salvarTodas(lista);
  DB.gravar(CHAVES.agendamentos, []);
  DB.gravar(CHAVES.orcamentos, []);
}

function garantirDados() {
  if (!localStorage.getItem(CHAVES.ordens)) gerarDadosExemplo();
}

function resetarTudo() {
  Object.values(CHAVES).forEach(c => localStorage.removeItem(c));
  gerarDadosExemplo();
}

/* ---------- Utilitários de formatação ---------- */
const Fmt = {
  dinheiro(v) {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },
  dataHora(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  },
  escapar(txt) {
    const d = document.createElement('div');
    d.textContent = txt == null ? '' : String(txt);
    return d.innerHTML;
  }
};