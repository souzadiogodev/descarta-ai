import { useState, type FormEvent } from "react";
import { Check, Loader2, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import {
  api, ErroApi, mensagemDeErro,
  type MaterialEntrada, type MaterialResumo, type PontoAdmin, type ReporteAdmin, type StatusPonto,
} from "../api";
import { Aviso, AvisoErro, ListaEsqueleto } from "../componentes/Estados";
import { useConsulta } from "../util";
import { Campo } from "./Contas";
import { TEXTO_STATUS } from "../textos";
import { CabecalhoPainel, Selo } from "./Parceiro";

type Aba = "pontos" | "reportes" | "catalogo" | "estatisticas";
const ABAS: { id: Aba; texto: string }[] = [
  { id: "pontos", texto: "Pontos" },
  { id: "reportes", texto: "Avisos de erro" },
  { id: "catalogo", texto: "Materiais" },
  { id: "estatisticas", texto: "Estatísticas" },
];

export default function PainelAdmin() {
  const [aba, setAba] = useState<Aba>("pontos");
  return (
    <section>
      <CabecalhoPainel titulo="Administração" />
      <div className="abas" role="tablist" aria-label="Seções da administração">
        {ABAS.map(a => (
          <button key={a.id} role="tab" id={`aba-${a.id}`} aria-selected={aba === a.id} aria-controls="painel-aba"
            onClick={() => setAba(a.id)}>{a.texto}</button>
        ))}
      </div>
      <div id="painel-aba" role="tabpanel" aria-labelledby={`aba-${aba}`}>
        {aba === "pontos" && <AbaPontos />}
        {aba === "reportes" && <AbaReportes />}
        {aba === "catalogo" && <AbaCatalogo />}
        {aba === "estatisticas" && <AbaEstatisticas />}
      </div>
    </section>
  );
}

// ---------- RF16: moderação de pontos ----------

const FILTROS: (StatusPonto | undefined)[] = ["Pendente", "Aprovado", "Rejeitado", "Inativo", undefined];

function AbaPontos() {
  const [status, setStatus] = useState<StatusPonto | undefined>("Pendente");
  const pontos = useConsulta(s => api.pontosAdmin(status, s), [status]);
  const [erro, setErro] = useState<string>();
  const [ocupado, setOcupado] = useState<string>();

  const mudar = async (p: PontoAdmin, novo: Exclude<StatusPonto, "Pendente">) => {
    setErro(undefined);
    setOcupado(p.id);
    try {
      await api.mudarStatusPonto(p.id, novo);
      pontos.tentarDeNovo();
    } catch (x) {
      setErro(mensagemDeErro(x));
    } finally {
      setOcupado(undefined);
    }
  };

  return (
    <>
      <div className="chips" role="group" aria-label="Filtrar por situação">
        {FILTROS.map(f => (
          <button key={f ?? "todos"} aria-pressed={status === f} onClick={() => setStatus(f)}>
            {f ? TEXTO_STATUS[f] : "Todos"}
          </button>
        ))}
      </div>
      {erro && <p className="erro-campo" role="alert">{erro}</p>}
      {pontos.erro ? <AvisoErro mensagem="Não foi possível carregar os pontos." onTentar={pontos.tentarDeNovo} />
        : !pontos.dados ? <ListaEsqueleto itens={3} alto />
        : pontos.dados.length === 0 ? <Aviso><p>Nenhum ponto nesta situação.</p></Aviso>
        : (
          <ul className="lista">
            {pontos.dados.map(p => (
              <li key={p.id} className="cartao-linha">
                <div>
                  <strong>{p.nome}</strong> <Selo status={p.status} />
                  {p.reportesPendentes > 0 && <span className="selo">{p.reportesPendentes} aviso(s) de erro</span>}
                  <p className="item-meta">{p.endereco} · {p.cidade}/{p.uf}{p.cep && ` · CEP ${p.cep}`}</p>
                  <p className="item-meta">
                    {p.parceiro ? `Parceiro: ${p.parceiro}` : "Carga inicial (OpenStreetMap)"}
                    {p.horario && ` · ${p.horario}`}{p.telefone && ` · ${p.telefone}`}
                  </p>
                  <span className="tags">{p.materiais.map(m => <span key={m} className="tag">{m}</span>)}</span>
                  <p><a href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=18/${p.lat}/${p.lng}`}
                    target="_blank" rel="noreferrer">Conferir localização no mapa</a></p>
                </div>
                <div className="acoes coluna">
                  {p.status !== "Aprovado" && (
                    <button className="botao pequeno" disabled={ocupado === p.id} onClick={() => mudar(p, "Aprovado")}
                      aria-label={`Aprovar ${p.nome}`}><Check size={16} aria-hidden="true" /> Aprovar</button>
                  )}
                  {p.status === "Pendente" && (
                    <button className="botao secundario pequeno" disabled={ocupado === p.id} onClick={() => mudar(p, "Rejeitado")}
                      aria-label={`Rejeitar ${p.nome}`}><X size={16} aria-hidden="true" /> Rejeitar</button>
                  )}
                  {p.status === "Aprovado" && (
                    <button className="botao secundario pequeno" disabled={ocupado === p.id} onClick={() => mudar(p, "Inativo")}
                      aria-label={`Desativar ${p.nome}`}><Power size={16} aria-hidden="true" /> Desativar</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
    </>
  );
}

// ---------- RF19: avisos de informação errada ----------

const TEXTO_MOTIVO: Record<ReporteAdmin["motivo"], string> = {
  Fechado: "Fechou ou não existe",
  EnderecoErrado: "Endereço errado",
  NaoAceitaMaterial: "Não aceita material",
  Outro: "Outro",
};

function AbaReportes() {
  const reportes = useConsulta(s => api.reportesAdmin("Pendente", s), []);
  const [erro, setErro] = useState<string>();

  const mudar = async (r: ReporteAdmin, status: "Resolvido" | "Descartado") => {
    setErro(undefined);
    try { await api.mudarStatusReporte(r.id, status); reportes.tentarDeNovo(); }
    catch (x) { setErro(mensagemDeErro(x)); }
  };

  return (
    <>
      <p>Avisos enviados pelos cidadãos. Corrija ou desative o ponto na aba “Pontos” e marque o aviso como resolvido.</p>
      {erro && <p className="erro-campo" role="alert">{erro}</p>}
      {reportes.erro ? <AvisoErro mensagem="Não foi possível carregar os avisos." onTentar={reportes.tentarDeNovo} />
        : !reportes.dados ? <ListaEsqueleto itens={2} />
        : reportes.dados.length === 0 ? <Aviso><p>Nenhum aviso pendente.</p></Aviso>
        : (
          <ul className="lista">
            {reportes.dados.map(r => (
              <li key={r.id} className="cartao-linha">
                <div>
                  <strong>{r.ponto}</strong> <span className="selo">{TEXTO_MOTIVO[r.motivo]}</span>
                  {r.comentario && <p>“{r.comentario}”</p>}
                  <p className="item-meta">{new Date(r.criadoEm).toLocaleString("pt-BR")}</p>
                </div>
                <div className="acoes coluna">
                  <button className="botao pequeno" onClick={() => mudar(r, "Resolvido")}>Resolvido</button>
                  <button className="botao secundario pequeno" onClick={() => mudar(r, "Descartado")}>Descartar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
    </>
  );
}

// ---------- RF17: catálogo de materiais ----------

function AbaCatalogo() {
  const materiais = useConsulta(s => api.materiais({}, s), []);
  const categorias = useConsulta(s => api.categorias(s), []);
  const [editando, setEditando] = useState<MaterialResumo | "novo">();
  const [erro, setErro] = useState<string>();
  const [novaCategoria, setNovaCategoria] = useState("");

  const excluir = async (m: MaterialResumo) => {
    if (!window.confirm(`Excluir “${m.nome}”? Esta ação não pode ser desfeita.`)) return;
    setErro(undefined);
    try { await api.excluirMaterial(m.id); materiais.tentarDeNovo(); }
    catch (x) {
      setErro(x instanceof ErroApi && x.status === 409
        ? `“${m.nome}” está em uso por pontos ou identificações. Edite-o em vez de excluir.` : mensagemDeErro(x));
    }
  };

  const criarCategoria = async (e: FormEvent) => {
    e.preventDefault();
    setErro(undefined);
    try { await api.criarCategoria(novaCategoria.trim()); setNovaCategoria(""); categorias.tentarDeNovo(); }
    catch (x) { setErro(mensagemDeErro(x)); }
  };

  if (editando)
    return <FormMaterial material={editando === "novo" ? undefined : editando} categorias={categorias.dados ?? []}
      onFechar={salvo => { setEditando(undefined); if (salvo) materiais.tentarDeNovo(); }} />;

  return (
    <>
      <div className="acoes">
        <button className="botao" onClick={() => setEditando("novo")}><Plus size={18} aria-hidden="true" /> Novo material</button>
      </div>
      <form className="busca-endereco" onSubmit={criarCategoria}>
        <label htmlFor="nova-cat" className="rotulo">Nova categoria</label>
        <div className="linha">
          <input id="nova-cat" value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} maxLength={60} />
          <button className="botao secundario" disabled={!novaCategoria.trim()}>Adicionar</button>
        </div>
      </form>
      {erro && <p className="erro-campo" role="alert">{erro}</p>}
      {materiais.erro ? <AvisoErro mensagem="Não foi possível carregar os materiais." onTentar={materiais.tentarDeNovo} />
        : !materiais.dados ? <ListaEsqueleto itens={4} />
        : (
          <ul className="lista">
            {materiais.dados.map(m => (
              <li key={m.id} className="cartao-linha">
                <div>
                  <strong>{m.nome}</strong> {m.perigoso && <span className="selo">Perigoso</span>}
                  <p className="item-meta">{m.categoria}</p>
                </div>
                <div className="acoes">
                  <button className="botao secundario pequeno" onClick={() => setEditando(m)} aria-label={`Editar ${m.nome}`}>
                    <Pencil size={16} aria-hidden="true" /> Editar</button>
                  <button className="botao secundario pequeno" onClick={() => excluir(m)} aria-label={`Excluir ${m.nome}`}>
                    <Trash2 size={16} aria-hidden="true" /> Excluir</button>
                </div>
              </li>
            ))}
          </ul>
        )}
    </>
  );
}

function FormMaterial({ material, categorias, onFechar }: {
  material?: MaterialResumo; categorias: { id: number; nome: string }[]; onFechar: (salvo: boolean) => void;
}) {
  const detalhe = useConsulta(s => material ? api.material(material.id, s) : Promise.resolve(undefined), [material?.id]);
  const [dados, setDados] = useState<MaterialEntrada & { sinonimosTexto: string }>();
  const [erros, setErros] = useState<Record<string, string[]>>({});
  const [erroGeral, setErroGeral] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  // Preenche o formulário quando o detalhe chega (ou na hora, para material novo).
  if (!dados && !detalhe.carregando) {
    const d = detalhe.dados;
    setDados({
      categoriaId: d?.categoriaId ?? categorias[0]?.id ?? 0, nome: d?.nome ?? "", instrucoes: d?.instrucoes ?? "",
      cuidados: d?.cuidados ?? "", perigoso: d?.perigoso ?? false, sinonimosTexto: d?.sinonimos?.join(", ") ?? "",
    });
  }
  if (!dados) return <ListaEsqueleto itens={3} />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErroGeral(undefined);
    const { sinonimosTexto, ...resto } = dados;
    const corpo: MaterialEntrada = {
      ...resto, cuidados: resto.cuidados || undefined,
      sinonimos: sinonimosTexto.split(",").map(s => s.trim()).filter(Boolean),
    };
    try {
      if (material) await api.editarMaterial(material.id, corpo); else await api.criarMaterial(corpo);
      onFechar(true);
    } catch (x) {
      if (x instanceof ErroApi && Object.keys(x.campos).length) setErros(x.campos);
      else setErroGeral(mensagemDeErro(x));
      setEnviando(false);
    }
  };

  const mudar = <K extends keyof typeof dados>(k: K, v: (typeof dados)[K]) => setDados({ ...dados, [k]: v });

  return (
    <form className="form" onSubmit={enviar} noValidate>
      <h2>{material ? `Editar “${material.nome}”` : "Novo material"}</h2>
      <Campo id="m-nome" rotulo="Nome" valor={dados.nome} onMudar={v => mudar("nome", v)} erro={erros.nome} obrigatorio maxLength={80} />
      <div className="campo">
        <label htmlFor="m-cat" className="rotulo">Categoria</label>
        <select id="m-cat" value={dados.categoriaId} onChange={e => mudar("categoriaId", Number(e.target.value))}>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        {erros.categoriaId && <p className="erro-campo">{erros.categoriaId[0]}</p>}
      </div>
      <div className="campo">
        <label htmlFor="m-instr" className="rotulo">Como descartar <span className="obrigatorio">(obrigatório)</span></label>
        <textarea id="m-instr" rows={4} value={dados.instrucoes} onChange={e => mudar("instrucoes", e.target.value)}
          aria-invalid={!!erros.instrucoes} />
        {erros.instrucoes && <p className="erro-campo">{erros.instrucoes[0]}</p>}
      </div>
      <div className="campo">
        <label htmlFor="m-cuid" className="rotulo">Cuidados (opcional)</label>
        <textarea id="m-cuid" rows={2} value={dados.cuidados ?? ""} onChange={e => mudar("cuidados", e.target.value)} />
      </div>
      <Campo id="m-sin" rotulo="Outros nomes, separados por vírgula" valor={dados.sinonimosTexto}
        onMudar={v => mudar("sinonimosTexto", v)} erro={erros.sinonimos} dica="Ajudam a busca: ex. “bateria, pilha AA”." />
      <label className="opcao">
        <input type="checkbox" checked={dados.perigoso} onChange={e => mudar("perigoso", e.target.checked)} /> Resíduo perigoso
      </label>
      {erroGeral && <p className="erro-campo" role="alert">{erroGeral}</p>}
      <div className="acoes">
        <button className="botao" disabled={enviando}>{enviando && <Loader2 size={18} className="girando" aria-hidden="true" />} Salvar</button>
        <button type="button" className="botao secundario" onClick={() => onFechar(false)}>Cancelar</button>
      </div>
    </form>
  );
}

// ---------- RF21: estatísticas ----------

function AbaEstatisticas() {
  const e = useConsulta(s => api.estatisticas(s), []);
  if (e.erro) return <AvisoErro mensagem="Não foi possível carregar as estatísticas." onTentar={e.tentarDeNovo} />;
  if (!e.dados) return <ListaEsqueleto itens={3} />;
  const d = e.dados;
  const numeros: [string, string | number][] = [
    ["Buscas de pontos", d.buscas],
    ["Fotos identificadas", d.identificacoes],
    ["Identificações confirmadas", d.identificacoesConfirmadas],
    ["Acerto da IA", d.taxaDeAcerto == null ? "—" : `${Math.round(d.taxaDeAcerto * 100)}%`],
    ["Pontos publicados", d.pontosPorStatus.Aprovado],
    ["Pontos em análise", d.pontosPorStatus.Pendente],
    ["Parceiros", d.parceiros],
    ["Avisos pendentes", d.reportesPendentes],
  ];
  return (
    <>
      <dl className="numeros">
        {numeros.map(([rotulo, valor]) => (
          <div key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></div>
        ))}
      </dl>
      <h2>Materiais mais identificados por foto</h2>
      {d.materiaisMaisIdentificados.length === 0 ? <p>Ainda não há identificações confirmadas.</p> : (
        <table className="tabela">
          <thead><tr><th scope="col">Material</th><th scope="col">Confirmações</th></tr></thead>
          <tbody>{d.materiaisMaisIdentificados.map(m => <tr key={m.material}><td>{m.material}</td><td>{m.quantidade}</td></tr>)}</tbody>
        </table>
      )}
      <p className="dica">O acerto considera as fotos em que o usuário confirmou a primeira sugestão sem corrigir.</p>
    </>
  );
}
