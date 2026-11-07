import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Loader2, LogOut, Pencil, Plus, Search } from "lucide-react";
import { api, ErroApi, mensagemDeErro, type MeuPonto, type PontoEntrada, type StatusPonto } from "../api";
import { Aviso, AvisoErro, ListaEsqueleto } from "../componentes/Estados";
import { useSessao } from "../sessao";
import { TEXTO_STATUS } from "../textos";
import { TILES, useConsulta } from "../util";
import { Campo } from "./Contas";

export function Selo({ status }: { status: StatusPonto }) {
  return <span className={`selo-status ${status.toLowerCase()}`}>{TEXTO_STATUS[status]}</span>;
}

/** Protege as páginas por papel: sem sessão, manda para o login. */
export function Protegida({ papel, children }: { papel: "Parceiro" | "Admin"; children: React.ReactNode }) {
  const { sessao } = useSessao();
  if (!sessao) return <Navigate to="/entrar" replace />;
  if (sessao.papel !== papel)
    return <section><h1>Acesso restrito</h1><p>Esta área é só para {papel === "Admin" ? "administradores" : "parceiros"}.</p></section>;
  return <>{children}</>;
}

export function CabecalhoPainel({ titulo }: { titulo: string }) {
  const { sessao, sair } = useSessao();
  return (
    <div className="painel-topo">
      <div>
        <h1>{titulo}</h1>
        <p className="item-meta">Conectado como {sessao?.nome}</p>
      </div>
      <button className="botao secundario pequeno" onClick={sair}><LogOut size={16} aria-hidden="true" /> Sair</button>
    </div>
  );
}

export default function PainelParceiro() {
  const pontos = useConsulta(s => api.meusPontos(s), []);
  const [editando, setEditando] = useState<MeuPonto | "novo">();
  const [mensagem, setMensagem] = useState<string>();

  if (editando)
    return (
      <section>
        <FormPonto
          ponto={editando === "novo" ? undefined : editando}
          onCancelar={() => setEditando(undefined)}
          onSalvo={() => {
            setEditando(undefined);
            setMensagem("Ponto enviado. Ele aparece no mapa assim que a equipe aprovar.");
            pontos.tentarDeNovo();
          }} />
      </section>
    );

  return (
    <section>
      <CabecalhoPainel titulo="Meus pontos de coleta" />
      {mensagem && <div className="aviso sucesso" role="status"><p>{mensagem}</p></div>}
      <p>Cadastre os pontos onde seu estabelecimento recebe resíduos. Toda alteração passa por uma conferência antes de ir ao mapa.</p>
      <button className="botao" onClick={() => { setMensagem(undefined); setEditando("novo"); }}>
        <Plus size={18} aria-hidden="true" /> Cadastrar ponto
      </button>

      <div className="secao">
        {pontos.erro ? <AvisoErro mensagem="Não foi possível carregar seus pontos." onTentar={pontos.tentarDeNovo} />
          : !pontos.dados ? <ListaEsqueleto itens={2} />
          : pontos.dados.length === 0 ? <Aviso><p>Você ainda não cadastrou nenhum ponto.</p></Aviso>
          : (
            <ul className="lista">
              {pontos.dados.map(p => (
                <li key={p.id} className="cartao-linha">
                  <div>
                    <strong>{p.nome}</strong> <Selo status={p.status} />
                    <p className="item-meta">{p.endereco} · {p.cidade}/{p.uf}</p>
                    {p.status === "Rejeitado" && <p className="item-meta">Revise os dados e envie de novo, ou fale com a equipe pelo contato do site.</p>}
                  </div>
                  <button className="botao secundario pequeno" onClick={() => { setMensagem(undefined); setEditando(p); }}
                    aria-label={`Editar ${p.nome}`}>
                    <Pencil size={16} aria-hidden="true" /> Editar
                  </button>
                </li>
              ))}
            </ul>
          )}
      </div>
    </section>
  );
}

const vazio: PontoEntrada = { nome: "", endereco: "", cidade: "Araçatuba", uf: "SP", cep: "", telefone: "", horario: "", materiaisIds: [] };

function FormPonto({ ponto, onCancelar, onSalvo }: { ponto?: MeuPonto; onCancelar: () => void; onSalvo: () => void }) {
  const [dados, setDados] = useState<PontoEntrada>(() => ponto ? { ...ponto } : vazio);
  const [erros, setErros] = useState<Record<string, string[]>>({});
  const [erroGeral, setErroGeral] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [localizando, setLocalizando] = useState(false);
  const materiais = useConsulta(s => api.materiais({}, s), []);

  const porCategoria = useMemo(() => {
    const grupos = new Map<string, { id: number; nome: string }[]>();
    for (const m of materiais.dados ?? []) grupos.set(m.categoria, [...(grupos.get(m.categoria) ?? []), m]);
    return [...grupos.entries()];
  }, [materiais.dados]);

  const mudar = (campo: keyof PontoEntrada) => (v: string) => setDados(d => ({ ...d, [campo]: v }));
  const alternarMaterial = (id: number) => setDados(d => ({
    ...d, materiaisIds: d.materiaisIds.includes(id) ? d.materiaisIds.filter(x => x !== id) : [...d.materiaisIds, id],
  }));

  const localizar = async () => {
    const texto = [dados.endereco, dados.cidade, dados.uf].filter(Boolean).join(", ");
    setLocalizando(true);
    setErros(e => ({ ...e, localizacao: [] }));
    try {
      const [primeiro] = await api.localizar(dados.cep && dados.cep.length >= 8 && !dados.endereco ? dados.cep : texto);
      if (primeiro) setDados(d => ({ ...d, lat: primeiro.lat, lng: primeiro.lng }));
      else setErros(e => ({ ...e, localizacao: ["Endereço não encontrado. Confira os dados ou marque no mapa."] }));
    } catch (x) {
      setErros(e => ({ ...e, localizacao: [mensagemDeErro(x)] }));
    } finally {
      setLocalizando(false);
    }
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErroGeral(undefined);
    setEnviando(true);
    const corpo = { ...dados, cep: dados.cep || undefined, telefone: dados.telefone || undefined, horario: dados.horario || undefined };
    try {
      if (ponto) await api.editarPonto(ponto.id, corpo); else await api.criarPonto(corpo);
      onSalvo();
    } catch (x) {
      if (x instanceof ErroApi && Object.keys(x.campos).length) setErros(x.campos);
      else setErroGeral(mensagemDeErro(x));
      setEnviando(false);
    }
  };

  return (
    <>
      <h1>{ponto ? `Editar “${ponto.nome}”` : "Cadastrar ponto de coleta"}</h1>
      {ponto?.status === "Aprovado" && (
        <div className="cuidado" role="note">Ao salvar, o ponto sai do mapa até a equipe conferir a alteração.</div>
      )}
      <form onSubmit={enviar} className="form" noValidate>
        <Campo id="nome" rotulo="Nome do ponto" valor={dados.nome} onMudar={mudar("nome")} erro={erros.nome} obrigatorio
          placeholder="Ex.: Coletor de pilhas — Mercado Central" maxLength={120} />

        <fieldset>
          <legend>Endereço</legend>
          <Campo id="endereco" rotulo="Rua e número" valor={dados.endereco} onMudar={mudar("endereco")} erro={erros.endereco}
            autoComplete="street-address" obrigatorio maxLength={200} />
          <div className="grade-campos">
            <Campo id="cidade" rotulo="Cidade" valor={dados.cidade} onMudar={mudar("cidade")} erro={erros.cidade} obrigatorio />
            <Campo id="uf" rotulo="UF" valor={dados.uf} onMudar={mudar("uf")} erro={erros.uf} obrigatorio maxLength={2} />
            <Campo id="cep" rotulo="CEP" valor={dados.cep ?? ""} onMudar={mudar("cep")} erro={erros.cep} autoComplete="postal-code" maxLength={9} />
          </div>
          <button type="button" className="botao secundario pequeno" onClick={localizar} disabled={localizando}>
            {localizando ? <Loader2 size={16} className="girando" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
            Localizar no mapa
          </button>
          {erros.localizacao?.[0] && <p className="erro-campo" role="alert">{erros.localizacao[0]}</p>}
          {dados.lat !== undefined && dados.lng !== undefined && (
            <MapaAjuste lat={dados.lat} lng={dados.lng} onMover={(lat, lng) => setDados(d => ({ ...d, lat, lng }))} />
          )}
        </fieldset>

        <div className="grade-campos">
          <Campo id="horario" rotulo="Horário (opcional)" valor={dados.horario ?? ""} onMudar={mudar("horario")} erro={erros.horario}
            placeholder="Ex.: Seg a sáb, 8h às 20h" maxLength={120} />
          <Campo id="telefone" rotulo="Telefone (opcional)" tipo="tel" valor={dados.telefone ?? ""} onMudar={mudar("telefone")}
            erro={erros.telefone} maxLength={20} />
        </div>

        <fieldset aria-describedby={erros.materiaisIds ? "materiais-erro" : undefined}>
          <legend>Materiais aceitos <span className="obrigatorio">(obrigatório)</span></legend>
          {materiais.erro && <AvisoErro mensagem="Não foi possível carregar os materiais." onTentar={materiais.tentarDeNovo} />}
          {porCategoria.map(([categoria, itens]) => (
            <div key={categoria} className="grupo-materiais">
              <p className="item-meta">{categoria}</p>
              {itens.map(m => (
                <label key={m.id} className="opcao">
                  <input type="checkbox" checked={dados.materiaisIds.includes(m.id)} onChange={() => alternarMaterial(m.id)} /> {m.nome}
                </label>
              ))}
            </div>
          ))}
          {erros.materiaisIds && <p id="materiais-erro" className="erro-campo">{erros.materiaisIds[0]}</p>}
        </fieldset>

        {erroGeral && <p className="erro-campo" role="alert">{erroGeral}</p>}
        <div className="acoes">
          <button className="botao" disabled={enviando}>
            {enviando && <Loader2 size={18} className="girando" aria-hidden="true" />} Enviar para aprovação
          </button>
          <button type="button" className="botao secundario" onClick={onCancelar}>Cancelar</button>
        </div>
      </form>
    </>
  );
}

const pinoArrastavel = L.divIcon({
  className: "pino ativo",
  html: '<svg viewBox="0 0 24 32" aria-hidden="true"><path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0z"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>',
  iconSize: [36, 48], iconAnchor: [18, 48],
});

/** Mostra onde o ponto vai aparecer; o parceiro arrasta o pino se o endereço caiu no lugar errado. */
function MapaAjuste({ lat, lng, onMover }: { lat: number; lng: number; onMover: (lat: number, lng: number) => void }) {
  return (
    <div className="mapa-ajuste">
      <p className="dica">Confira o pino. Se não estiver na porta do local, arraste-o.</p>
      <MapContainer center={[lat, lng]} zoom={17} className="mapa pequeno" aria-label="Localização do ponto">
        <TileLayer attribution={TILES.atribuicao} url={TILES.url} />
        <Centralizar lat={lat} lng={lng} />
        <Marker position={[lat, lng]} icon={pinoArrastavel} draggable
          eventHandlers={{ dragend: e => { const p = (e.target as L.Marker).getLatLng(); onMover(p.lat, p.lng); } }} />
      </MapContainer>
    </div>
  );
}

function Centralizar({ lat, lng }: { lat: number; lng: number }) {
  const mapa = useMap();
  useEffect(() => { mapa.setView([lat, lng]); }, [lat, lng, mapa]);
  return null;
}
