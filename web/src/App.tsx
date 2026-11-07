import { useEffect, useRef } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { BookOpen, Lightbulb, MapPin, Recycle, UserRound } from "lucide-react";
import Inicio from "./paginas/Inicio";
import Guia from "./paginas/Guia";
import Mapa from "./paginas/Mapa";
import { Privacidade, Sobre, Termos } from "./paginas/Institucional";
import Dicas from "./paginas/Dicas";
import { CadastroParceiroPagina, Entrar } from "./paginas/Contas";
import PainelParceiro, { Protegida } from "./paginas/Parceiro";
import PainelAdmin from "./paginas/Admin";
import { useSessao } from "./sessao";
import { Link } from "react-router-dom";

export default function App() {
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const { sessao } = useSessao();

  // Ao trocar de página, leva o foco ao conteúdo (leitores de tela) e volta ao topo.
  useEffect(() => {
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <>
      <a href="#conteudo" className="pular">Pular para o conteúdo</a>
      <header className="topo">
        <div className="topo-interno">
          <NavLink to="/" className="marca" aria-label="Descarta Aí, página inicial">
            <Recycle size={24} aria-hidden="true" /> Descarta Aí
          </NavLink>
          <nav aria-label="Principal">
            <NavLink to="/guia"><BookOpen size={18} aria-hidden="true" /> Guia</NavLink>
            <NavLink to="/mapa"><MapPin size={18} aria-hidden="true" /> Mapa</NavLink>
            <NavLink to="/dicas"><Lightbulb size={18} aria-hidden="true" /> Dicas</NavLink>
            {sessao && (
              <NavLink to={sessao.papel === "Admin" ? "/admin" : "/parceiro"}>
                <UserRound size={18} aria-hidden="true" /> Painel
              </NavLink>
            )}
          </nav>
        </div>
      </header>
      <main id="conteudo" ref={main} tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/guia" element={<Guia />} />
          <Route path="/mapa" element={<Mapa />} />
          <Route path="/sobre" element={<Sobre />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/dicas" element={<Dicas />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/parceiro/cadastro" element={<CadastroParceiroPagina />} />
          <Route path="/parceiro" element={<Protegida papel="Parceiro"><PainelParceiro /></Protegida>} />
          <Route path="/admin" element={<Protegida papel="Admin"><PainelAdmin /></Protegida>} />
          <Route path="*" element={
            <section><h1>Página não encontrada</h1><p>O endereço pode estar errado. <Link to="/">Voltar ao início</Link>.</p></section>
          } />
        </Routes>
      </main>
      <footer className="rodape">
        <nav aria-label="Institucional" className="rodape-links">
          <Link to="/sobre">Sobre</Link>
          <Link to="/privacidade">Privacidade</Link>
          <Link to="/termos">Termos de uso</Link>
          <Link to="/parceiro/cadastro">Seja um ponto de coleta</Link>
          {!sessao && <Link to="/entrar">Entrar</Link>}
        </nav>
        <p>Projeto de extensão UNIP · NSI · Araçatuba e região.</p>
        <p>Dados de mapa © colaboradores do OpenStreetMap{import.meta.env.VITE_MAPTILER_CHAVE && " · © MapTiler"}.</p>
      </footer>
    </>
  );
}
