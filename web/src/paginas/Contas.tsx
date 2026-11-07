import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, ErroApi, mensagemDeErro, type CadastroParceiro } from "../api";
import { useSessao, type Sessao } from "../sessao";

const TIPOS_PARCEIRO = ["Comércio", "Cooperativa", "Órgão público", "ONG", "Escola", "Outro"];

const destino = (s: Sessao) => (s.papel === "Admin" ? "/admin" : "/parceiro");

export function Entrar() {
  const { sessao, entrar } = useSessao();
  const navegar = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  if (sessao) return <Navigate to={destino(sessao)} replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(undefined);
    setEnviando(true);
    try {
      const s = await api.entrar(email.trim(), senha);
      entrar(s);
      navegar(destino(s), { replace: true });
    } catch (x) {
      setErro(x instanceof ErroApi && x.status === 401 ? "E-mail ou senha incorretos." : mensagemDeErro(x));
      setEnviando(false);
    }
  };

  return (
    <section className="formulario-pagina">
      <h1>Entrar</h1>
      <p className="lead">Área de parceiros e administração. Para consultar o guia e o mapa não é preciso entrar.</p>
      <form onSubmit={enviar} className="form" noValidate>
        <Campo id="email" rotulo="E-mail" tipo="email" valor={email} onMudar={setEmail} autoComplete="email" obrigatorio />
        <Campo id="senha" rotulo="Senha" tipo="password" valor={senha} onMudar={setSenha} autoComplete="current-password" obrigatorio />
        {erro && <p className="erro-campo" role="alert">{erro}</p>}
        <button className="botao" disabled={enviando}>
          {enviando && <Loader2 size={18} className="girando" aria-hidden="true" />} Entrar
        </button>
      </form>
      <p>Tem um estabelecimento que recebe resíduos? <Link to="/parceiro/cadastro">Cadastre-se como parceiro</Link>.</p>
    </section>
  );
}

export function CadastroParceiroPagina() {
  const { sessao, entrar } = useSessao();
  const navegar = useNavigate();
  const [dados, setDados] = useState<CadastroParceiro>({ nome: "", email: "", senha: "", organizacao: "", tipo: "" });
  const [erros, setErros] = useState<Record<string, string[]>>({});
  const [erroGeral, setErroGeral] = useState<string>();
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);

  if (sessao) return <Navigate to={destino(sessao)} replace />;

  const mudar = (campo: keyof CadastroParceiro) => (v: string) => setDados(d => ({ ...d, [campo]: v }));

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErroGeral(undefined);
    if (!aceite) return setErros({ aceite: ["Para continuar, aceite os termos e a política de privacidade."] });
    setErros({});
    setEnviando(true);
    try {
      const s = await api.cadastrar({ ...dados, documento: dados.documento || undefined, telefone: dados.telefone || undefined });
      entrar(s);
      navegar("/parceiro", { replace: true });
    } catch (x) {
      if (x instanceof ErroApi && Object.keys(x.campos).length) setErros(x.campos);
      else setErroGeral(mensagemDeErro(x));
      setEnviando(false);
    }
  };

  return (
    <section className="formulario-pagina">
      <h1>Cadastro de parceiro</h1>
      <p className="lead">
        Mercados, farmácias, cooperativas e órgãos públicos podem cadastrar seus pontos de coleta.
        Cada ponto é conferido pela equipe antes de aparecer no mapa.
      </p>
      <form onSubmit={enviar} className="form" noValidate>
        <fieldset>
          <legend>Você</legend>
          <Campo id="nome" rotulo="Seu nome" valor={dados.nome} onMudar={mudar("nome")} erro={erros.nome} autoComplete="name" obrigatorio />
          <Campo id="email" rotulo="E-mail" tipo="email" valor={dados.email} onMudar={mudar("email")} erro={erros.email} autoComplete="email" obrigatorio />
          <Campo id="senha" rotulo="Senha" tipo="password" valor={dados.senha} onMudar={mudar("senha")} erro={erros.senha}
            autoComplete="new-password" dica="Pelo menos 8 caracteres." obrigatorio />
        </fieldset>
        <fieldset>
          <legend>Estabelecimento ou organização</legend>
          <Campo id="organizacao" rotulo="Nome" valor={dados.organizacao} onMudar={mudar("organizacao")} erro={erros.organizacao}
            autoComplete="organization" obrigatorio />
          <div className="campo">
            <label htmlFor="tipo" className="rotulo">Tipo <span className="obrigatorio">(obrigatório)</span></label>
            <select id="tipo" value={dados.tipo} onChange={e => mudar("tipo")(e.target.value)}
              aria-invalid={!!erros.tipo} aria-describedby={erros.tipo ? "tipo-erro" : undefined}>
              <option value="">Escolha…</option>
              {TIPOS_PARCEIRO.map(t => <option key={t}>{t}</option>)}
            </select>
            {erros.tipo && <p id="tipo-erro" className="erro-campo">{erros.tipo[0]}</p>}
          </div>
          <Campo id="documento" rotulo="CNPJ ou CPF (opcional)" valor={dados.documento ?? ""} onMudar={mudar("documento")} erro={erros.documento} />
          <Campo id="telefone" rotulo="Telefone (opcional)" tipo="tel" valor={dados.telefone ?? ""} onMudar={mudar("telefone")}
            erro={erros.telefone} autoComplete="tel" />
        </fieldset>
        <label className="opcao">
          <input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)}
            aria-describedby={erros.aceite ? "aceite-erro" : undefined} />
          Li e aceito os <Link to="/termos" target="_blank">termos de uso</Link> e a <Link to="/privacidade" target="_blank">política de privacidade</Link>.
        </label>
        {erros.aceite && <p id="aceite-erro" className="erro-campo">{erros.aceite[0]}</p>}
        {erroGeral && <p className="erro-campo" role="alert">{erroGeral}</p>}
        <button className="botao" disabled={enviando}>
          {enviando && <Loader2 size={18} className="girando" aria-hidden="true" />} Criar conta
        </button>
      </form>
      <p>Já tem conta? <Link to="/entrar">Entrar</Link>.</p>
    </section>
  );
}

export function Campo({ id, rotulo, valor, onMudar, tipo = "text", erro, dica, autoComplete, obrigatorio, ...resto }: {
  id: string; rotulo: string; valor: string; onMudar: (v: string) => void; tipo?: string;
  erro?: string[]; dica?: string; autoComplete?: string; obrigatorio?: boolean; maxLength?: number; placeholder?: string;
}) {
  const descricao = [dica && `${id}-dica`, erro && `${id}-erro`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="campo">
      <label htmlFor={id} className="rotulo">
        {rotulo} {obrigatorio && <span className="obrigatorio">(obrigatório)</span>}
      </label>
      {dica && <p id={`${id}-dica`} className="dica">{dica}</p>}
      <input id={id} type={tipo} value={valor} onChange={e => onMudar(e.target.value)} autoComplete={autoComplete}
        aria-invalid={!!erro} aria-describedby={descricao} {...resto} />
      {erro && <p id={`${id}-erro`} className="erro-campo">{erro[0]}</p>}
    </div>
  );
}
