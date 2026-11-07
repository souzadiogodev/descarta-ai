import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import { Crosshair, Flag, Loader2, MapPin, Navigation, Search } from "lucide-react";
import { api, mensagemDeErro, type Local, type MotivoReporte, type PontoProximo } from "../api";
import { Aviso, AvisoErro, ListaEsqueleto } from "../componentes/Estados";
import { formatarDistancia, numeroDaUrl, plural, TILES, urlRota, urlWaze, useConsulta } from "../util";

type Coordenada = [number, number];
type SituacaoGps = "centro" | "buscando" | "ok" | "negado" | "endereco";

const CENTRO_ARACATUBA: Coordenada = [-21.2089, -50.4329];
const RAIOS = [2000, 5000, 10000, 25000, 50000];
const RAIO_PADRAO = 10000;
const ZOOM_INICIAL = 13;
const ZOOM_PONTO = 16;
const DURACAO_VOO_S = 0.4;

const MENSAGEM_GPS: Record<SituacaoGps, string> = {
  centro: "Mostrando a partir do centro de Araçatuba.",
  buscando: "Obtendo sua localização…",
  ok: "Mostrando a partir da sua localização.",
  negado: "Não conseguimos sua localização (permissão negada ou indisponível). Mostrando a partir do centro. Você pode digitar um endereço ou CEP.",
  endereco: "",
};

const pino = (ativo: boolean) => L.divIcon({
  className: "pino" + (ativo ? " ativo" : ""),
  html: '<svg viewBox="0 0 24 32" aria-hidden="true"><path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0z"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>',
  iconSize: ativo ? [36, 48] : [28, 37],
  iconAnchor: ativo ? [18, 48] : [14, 37],
  popupAnchor: [0, -36],
});

export default function Mapa() {
  const [params, setParams] = useSearchParams();
  const materialId = numeroDaUrl(params, "materialId");
  const raio = RAIOS.includes(Number(params.get("raio"))) ? Number(params.get("raio")) : RAIO_PADRAO;
  const [origem, setOrigem] = useState<Coordenada>(CENTRO_ARACATUBA);
  const [gps, setGps] = useState<SituacaoGps>("centro");
  const [selecionadoId, setSelecionadoId] = useState<string>();
  const [enderecoEscolhido, setEnderecoEscolhido] = useState<string>();

  const materiais = useConsulta(s => api.materiais({}, s), []);
  const pontos = useConsulta(
    s => api.proximos({ lat: origem[0], lng: origem[1], raio, materialId }, s),
    [origem, raio, materialId]);

  // Derivado dos resultados: se o ponto sair da lista após um novo filtro, a seleção some sozinha.
  const selecionado = pontos.dados?.find(p => p.id === selecionadoId);

  const atualizar = (chave: string, valor?: number) => setParams(p => {
    const novo = new URLSearchParams(p);
    if (valor) novo.set(chave, String(valor)); else novo.delete(chave);
    return novo;
  }, { replace: true });

  const localizar = () => {
    if (!navigator.geolocation) return setGps("negado");
    setGps("buscando");
    navigator.geolocation.getCurrentPosition(
      p => { setOrigem([p.coords.latitude, p.coords.longitude]); setGps("ok"); setEnderecoEscolhido(undefined); },
      () => setGps("negado"),
      { enableHighAccuracy: true, timeout: 10000 });
  };

  const proximoRaio = RAIOS.find(r => r > raio);
  const nomeMaterial = materiais.dados?.find(m => m.id === materialId)?.nome;

  return (
    <section className="mapa-pagina">
      <h1>Pontos de descarte</h1>

      <div className="filtros">
        <div className="campo">
          <label htmlFor="f-material" className="rotulo">Material</label>
          <select id="f-material" value={materialId ?? ""} onChange={e => atualizar("materialId", Number(e.target.value))}>
            <option value="">Todos os materiais</option>
            {materiais.dados?.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="f-raio" className="rotulo">Distância</label>
          <select id="f-raio" value={raio} onChange={e => atualizar("raio", Number(e.target.value))}>
            {RAIOS.map(r => <option key={r} value={r}>Até {formatarDistancia(r)}</option>)}
          </select>
        </div>
        <button className="botao" onClick={localizar} disabled={gps === "buscando"}>
          {gps === "buscando"
            ? <><Loader2 size={18} className="girando" aria-hidden="true" /> Localizando…</>
            : <><Crosshair size={18} aria-hidden="true" /> Usar minha localização</>}
        </button>
      </div>

      <BuscaEndereco onEscolher={l => {
        setOrigem([l.lat, l.lng]); setGps("endereco"); setEnderecoEscolhido(l.descricao);
      }} />

      <p className="status" aria-live="polite">
        {gps === "endereco" ? `Mostrando a partir de: ${enderecoEscolhido}.` : MENSAGEM_GPS[gps]}
        {pontos.dados && !pontos.carregando && ` ${plural(pontos.dados.length, "ponto encontrado", "pontos encontrados")}.`}
      </p>

      <div className="mapa-grade">
        <MapaPontos origem={origem} pontos={pontos.dados} selecionado={selecionado} onSelecionar={p => setSelecionadoId(p.id)} />

        <div className="resultados">
          {pontos.erro ? (
            <AvisoErro mensagem="Não foi possível buscar os pontos." onTentar={pontos.tentarDeNovo} />
          ) : !pontos.dados || pontos.carregando ? (
            <ListaEsqueleto itens={3} alto />
          ) : pontos.dados.length === 0 ? (
            <Aviso>
              <p>Nenhum ponto {nomeMaterial && `que aceite “${nomeMaterial}” `}até {formatarDistancia(raio)}.</p>
              {proximoRaio && (
                <button className="botao secundario" onClick={() => atualizar("raio", proximoRaio)}>
                  Buscar até {formatarDistancia(proximoRaio)}
                </button>
              )}
            </Aviso>
          ) : (
            <ol className="lista">
              {pontos.dados.map(p => (
                <CartaoPonto key={p.id} ponto={p} selecionado={selecionado?.id === p.id} onSelecionar={() => setSelecionadoId(p.id)} />
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

function MapaPontos({ origem, pontos, selecionado, onSelecionar }: {
  origem: Coordenada; pontos?: PontoProximo[]; selecionado?: PontoProximo; onSelecionar: (p: PontoProximo) => void;
}) {
  return (
    <div className="mapa-caixa">
      <MapContainer center={origem} zoom={ZOOM_INICIAL} className="mapa" aria-label="Mapa dos pontos de descarte">
        <TileLayer attribution={TILES.atribuicao} url={TILES.url} />
        <Enquadramento origem={origem} pontos={pontos} />
        <CircleMarker center={origem} radius={9}
          pathOptions={{ color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }} />
        {pontos?.map(p => (
          <MarcadorPonto key={p.id} ponto={p} ativo={selecionado?.id === p.id} onSelecionar={() => onSelecionar(p)} />
        ))}
      </MapContainer>
    </div>
  );
}

/** Enquadra a origem e todos os pontos encontrados. */
function Enquadramento({ origem, pontos }: { origem: Coordenada; pontos?: PontoProximo[] }) {
  const mapa = useMap();
  useEffect(() => {
    if (!pontos?.length) { mapa.setView(origem, ZOOM_INICIAL); return; }
    const limites = L.latLngBounds([origem, ...pontos.map(p => [p.lat, p.lng] as Coordenada)]);
    mapa.fitBounds(limites, { padding: [40, 40], maxZoom: 15 });
  }, [origem, pontos, mapa]);
  return null;
}

/** Ao ser selecionado (na lista ou no mapa), voa até o ponto e abre o balão. */
function MarcadorPonto({ ponto, ativo, onSelecionar }: { ponto: PontoProximo; ativo: boolean; onSelecionar: () => void }) {
  const mapa = useMap();
  const marcador = useRef<L.Marker>(null);

  useEffect(() => {
    if (!ativo) return;
    mapa.flyTo([ponto.lat, ponto.lng], ZOOM_PONTO, { duration: DURACAO_VOO_S });
    mapa.once("moveend", () => marcador.current?.openPopup());
  }, [ativo, ponto, mapa]);

  return (
    <Marker ref={marcador} position={[ponto.lat, ponto.lng]} icon={pino(ativo)} eventHandlers={{ click: onSelecionar }}>
      <Popup>
        <strong>{ponto.nome}</strong><br />{ponto.endereco}<br />
        <a href={urlRota(ponto.lat, ponto.lng)} target="_blank" rel="noreferrer">Google Maps</a>
        {" · "}
        <a href={urlWaze(ponto.lat, ponto.lng)} target="_blank" rel="noreferrer">Waze</a>
      </Popup>
    </Marker>
  );
}

function CartaoPonto({ ponto: p, selecionado, onSelecionar }: { ponto: PontoProximo; selecionado: boolean; onSelecionar: () => void }) {
  const distancia = formatarDistancia(p.distanciaMetros);
  const [reportando, setReportando] = useState(false);
  return (
    <li className={`ponto ${selecionado ? "selecionado" : ""}`}>
      <button className="ponto-corpo" onClick={onSelecionar} aria-label={`${p.nome}, ${distancia}. Mostrar no mapa`}>
        <span className="ponto-topo">
          <strong>{p.nome}</strong>
          <span className="dist">{distancia}</span>
        </span>
        <span className="ponto-end"><MapPin size={14} aria-hidden="true" /> {p.endereco}</span>
        <span className="tags">{p.materiais.map(n => <span key={n} className="tag">{n}</span>)}</span>
      </button>
      <div className="ponto-acoes">
        <a className="botao secundario pequeno" href={urlRota(p.lat, p.lng)} target="_blank" rel="noreferrer"
          aria-label={`Rota até ${p.nome} no Google Maps`}>
          <Navigation size={16} aria-hidden="true" /> Google Maps
        </a>
        <a className="botao secundario pequeno" href={urlWaze(p.lat, p.lng)} target="_blank" rel="noreferrer"
          aria-label={`Rota até ${p.nome} no Waze`}>
          <Navigation size={16} aria-hidden="true" /> Waze
        </a>
        <button className="link link-acao" onClick={() => setReportando(r => !r)} aria-expanded={reportando}>
          <Flag size={16} aria-hidden="true" /> Informar erro
        </button>
      </div>
      {reportando && <FormReporte ponto={p} onFechar={() => setReportando(false)} />}
    </li>
  );
}

/** RF04: quando o GPS falha ou o usuário quer buscar a partir de outro lugar. */
function BuscaEndereco({ onEscolher }: { onEscolher: (l: Local) => void }) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<{ carregando?: boolean; erro?: string; opcoes?: Local[] }>({});

  const buscar = async (e: FormEvent) => {
    e.preventDefault();
    if (texto.trim().length < 3) return setEstado({ erro: "Digite pelo menos 3 caracteres." });
    setEstado({ carregando: true });
    try {
      const opcoes = await api.localizar(texto.trim());
      if (opcoes.length === 1) { onEscolher(opcoes[0]); setEstado({}); return; }
      setEstado(opcoes.length ? { opcoes } : { erro: "Endereço não encontrado. Confira o CEP ou inclua a cidade." });
    } catch (erro) {
      setEstado({ erro: mensagemDeErro(erro, "Busca de endereço indisponível. Tente de novo ou use sua localização.") });
    }
  };

  return (
    <form className="busca-endereco" onSubmit={buscar} role="search" aria-label="Buscar a partir de um endereço">
      <label htmlFor="f-endereco" className="rotulo">Ou busque a partir de um endereço ou CEP</label>
      <div className="linha">
        <input id="f-endereco" value={texto} onChange={e => setTexto(e.target.value)}
          placeholder="Ex.: 16010-000 ou Rua Floriano Peixoto, Araçatuba" autoComplete="street-address" />
        <button className="botao secundario" disabled={estado.carregando}>
          {estado.carregando ? <Loader2 size={18} className="girando" aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
          Buscar
        </button>
      </div>
      {estado.erro && <p className="erro-campo" role="alert">{estado.erro}</p>}
      {estado.opcoes && (
        <fieldset className="opcoes-endereco">
          <legend>Qual destes?</legend>
          {estado.opcoes.map(o => (
            <button type="button" key={`${o.lat},${o.lng}`} className="link"
              onClick={() => { onEscolher(o); setEstado({}); }}>{o.descricao}</button>
          ))}
        </fieldset>
      )}
    </form>
  );
}

const MOTIVOS: { valor: MotivoReporte; texto: string }[] = [
  { valor: "Fechado", texto: "O ponto fechou ou não existe mais" },
  { valor: "EnderecoErrado", texto: "O endereço ou a localização está errado" },
  { valor: "NaoAceitaMaterial", texto: "Não aceita algum material listado" },
  { valor: "Outro", texto: "Outro problema" },
];

/** RF19: o cidadão avisa que a informação do ponto está errada; o admin revisa no painel. */
function FormReporte({ ponto, onFechar }: { ponto: PontoProximo; onFechar: () => void }) {
  const [motivo, setMotivo] = useState<MotivoReporte>();
  const [comentario, setComentario] = useState("");
  const [estado, setEstado] = useState<"editando" | "enviando" | "enviado">("editando");
  const [erro, setErro] = useState<string>();

  if (estado === "enviado")
    return (
      <div className="aviso sucesso" role="status">
        <p>Obrigado! Vamos conferir a informação de “{ponto.nome}”.</p>
        <button className="link" onClick={onFechar}>Fechar</button>
      </div>
    );

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!motivo) return setErro("Escolha o que está errado.");
    if (motivo === "Outro" && !comentario.trim()) return setErro("Conte o que está errado.");
    setEstado("enviando");
    setErro(undefined);
    try {
      await api.reportar(ponto.id, motivo, comentario.trim() || undefined);
      setEstado("enviado");
    } catch (x) {
      setErro(mensagemDeErro(x));
      setEstado("editando");
    }
  };

  return (
    <form className="form-reporte" onSubmit={enviar}>
      <fieldset>
        <legend>O que está errado em “{ponto.nome}”?</legend>
        {MOTIVOS.map(m => (
          <label key={m.valor} className="opcao">
            <input type="radio" name={`motivo-${ponto.id}`} value={m.valor}
              checked={motivo === m.valor} onChange={() => setMotivo(m.valor)} /> {m.texto}
          </label>
        ))}
      </fieldset>
      <label htmlFor={`coment-${ponto.id}`} className="rotulo">Detalhes {motivo !== "Outro" && "(opcional)"}</label>
      <textarea id={`coment-${ponto.id}`} value={comentario} maxLength={500} rows={3}
        onChange={e => setComentario(e.target.value)} />
      <p className="dica">O aviso é anônimo. Não escreva dados pessoais.</p>
      {erro && <p className="erro-campo" role="alert">{erro}</p>}
      <div className="acoes">
        <button className="botao pequeno" disabled={estado === "enviando"}>Enviar aviso</button>
        <button type="button" className="botao secundario pequeno" onClick={onFechar}>Cancelar</button>
      </div>
    </form>
  );
}
