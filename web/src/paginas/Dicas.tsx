import { Link } from "react-router-dom";

/**
 * RF20: dicas de educação ambiental. Conteúdo fixo, revisado pela equipe; fontes no fim da página.
 * O mesmo texto existe no app (mobile/src/dicas.ts): ao mudar um, mude o outro.
 */
const DICAS: { titulo: string; texto: string }[] = [
  {
    titulo: "Uma pilha pode contaminar o solo por décadas",
    texto: "Pilhas e baterias têm metais pesados, como mercúrio, chumbo e cádmio. No lixo comum, eles vazam para o solo e a água. Guarde as usadas num pote fechado e leve a um ponto de coleta quando juntar algumas.",
  },
  {
    titulo: "Óleo de cozinha não vai na pia",
    texto: "Um litro de óleo pode poluir milhares de litros de água e entope a rede de esgoto. Espere esfriar, coe e guarde em garrafa PET fechada. Muitos pontos trocam o óleo por sabão ou produtos de limpeza.",
  },
  {
    titulo: "Lâmpada fluorescente quebrada pede cuidado",
    texto: "Ela tem mercúrio. Se quebrar, abra as janelas, saia do cômodo por 10 minutos e recolha os cacos com papelão e fita adesiva, sem aspirador. Embale tudo e leve a um ponto que aceite lâmpadas.",
  },
  {
    titulo: "Remédio vencido não vai no vaso sanitário",
    texto: "Medicamentos jogados no esgoto ou no lixo chegam aos rios. Farmácias costumam receber remédios vencidos ou que sobraram, inclusive cartelas e frascos. Leve na embalagem original, se tiver.",
  },
  {
    titulo: "Reciclável limpo vale mais",
    texto: "Embalagens com restos de comida podem estragar um lote inteiro de recicláveis. Basta passar uma água rápida, sem gastar muito, e deixar secar. Separe papel, plástico, metal e vidro do lixo orgânico.",
  },
  {
    titulo: "Eletrônico velho tem valor",
    texto: "Celulares, carregadores e computadores têm metais que podem ser reaproveitados e também substâncias tóxicas. Antes de descartar, apague seus dados e tire o chip e o cartão de memória.",
  },
  {
    titulo: "Reduzir vem antes de reciclar",
    texto: "O melhor resíduo é o que não é gerado. Prefira produtos com refil, sacolas retornáveis e pilhas recarregáveis, e conserte antes de trocar.",
  },
];

export default function Dicas() {
  return (
    <article className="texto-longo">
      <h1>Dicas de descarte consciente</h1>
      <p className="lead">Pequenos hábitos que evitam a contaminação do solo e da água em Araçatuba e região.</p>
      <ol className="dicas">
        {DICAS.map(d => (
          <li key={d.titulo}>
            <h2>{d.titulo}</h2>
            <p>{d.texto}</p>
          </li>
        ))}
      </ol>
      <p>Não sabe onde levar? <Link to="/guia">Consulte o guia</Link> ou <Link to="/mapa">veja os pontos no mapa</Link>.</p>
      <p className="dica">
        Fontes: Política Nacional de Resíduos Sólidos (Lei nº 12.305/2010), Ministério do Meio Ambiente,
        Resolução CONAMA nº 401/2008 (pilhas e baterias) e Decreto nº 10.388/2020 (medicamentos).
      </p>
    </article>
  );
}
