import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { INSTITUCIONAL as I } from "../config";

function Contato() {
  return I.email
    ? <a href={`mailto:${I.email}`}>{I.email}</a>
    : <span>pelo canal de contato informado nesta página (em definição)</span>;
}

function Pagina({ titulo, children, atualizado = true }: { titulo: string; children: ReactNode; atualizado?: boolean }) {
  return (
    <article className="texto-longo">
      <h1>{titulo}</h1>
      {atualizado && <p className="meta">Última atualização: {I.atualizadoEm}</p>}
      {children}
    </article>
  );
}

export function Sobre() {
  return (
    <Pagina titulo="Sobre o Descarta Aí" atualizado={false}>
      <p className="lead">
        O Descarta Aí reúne, em um só lugar, como descartar cada tipo de resíduo e onde ficam os pontos de
        coleta de Araçatuba e região.
      </p>

      <h2>Por que existe</h2>
      <p>
        Muita gente não sabe onde levar óleo de cozinha, pilhas, eletrônicos, lâmpadas ou remédios vencidos.
        Sem essa informação, esses resíduos acabam no lixo comum, em terrenos ou na rede de esgoto,
        contaminando o solo e a água. As informações existem, mas estão espalhadas entre prefeitura,
        cooperativas e empresas.
      </p>

      <h2>Quem faz</h2>
      <p>
        É um projeto de extensão do curso de Análise e Desenvolvimento de Sistemas da UNIP, desenvolvido pela{" "}
        {I.responsavel}{I.cnpj && ` (CNPJ ${I.cnpj})`}, em {I.cidade}. O uso é gratuito e não há fins comerciais.
      </p>

      <h2>De onde vêm os dados</h2>
      <ul>
        <li>Pontos de coleta: OpenStreetMap (© colaboradores do OpenStreetMap, licença ODbL) e, em breve, parceiros e órgãos públicos.</li>
        <li>Instruções de descarte: compiladas pela equipe a partir de orientações públicas.</li>
      </ul>
      <p>
        Os dados podem estar desatualizados. Antes de ir até um ponto, se possível, confirme o funcionamento
        com o local.
      </p>

      <h2>Fale com a gente</h2>
      <p>Encontrou uma informação errada ou quer cadastrar um ponto de coleta? Escreva para <Contato />.</p>
    </Pagina>
  );
}

export function Privacidade() {
  return (
    <Pagina titulo="Política de Privacidade">
      <p className="lead">
        Explicamos aqui, em linguagem simples, quais dados o Descarta Aí usa e por quê, conforme a Lei Geral
        de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
      </p>

      <h2>Resumo</h2>
      <ul>
        <li>Você não precisa criar conta para consultar o guia e o mapa. Só parceiros que cadastram pontos têm conta.</li>
        <li>Não usamos cookies de rastreamento, publicidade ou ferramentas de análise de comportamento.</li>
        <li>Sua localização só é usada se você permitir, e não fica salva no nosso banco de dados.</li>
      </ul>

      <h2>1. Quem é o responsável (controlador)</h2>
      <p>
        {I.responsavel}{I.cnpj && `, CNPJ ${I.cnpj}`}, {I.cidade}. Contato para assuntos de privacidade: <Contato />.
      </p>

      <h2>2. Quais dados usamos e para quê</h2>
      <table>
        <thead><tr><th>Dado</th><th>Para quê</th><th>Base legal (LGPD)</th></tr></thead>
        <tbody>
          <tr>
            <td>Localização aproximada (latitude e longitude), só quando você toca em “Usar minha localização”</td>
            <td>Calcular a distância até os pontos de coleta</td>
            <td>Consentimento (art. 7º, I), dado pelo pedido de permissão do navegador</td>
          </tr>
          <tr>
            <td>Termos de busca e filtros escolhidos</td>
            <td>Mostrar os materiais e pontos pedidos</td>
            <td>Execução do serviço solicitado (art. 7º, V)</td>
          </tr>
          <tr>
            <td>Foto do item, só no aplicativo e quando você usa “Tirar foto do item”</td>
            <td>Sugerir que resíduo é e como descartá-lo</td>
            <td>Execução do serviço solicitado (art. 7º, V)</td>
          </tr>
          <tr>
            <td>Endereço ou CEP digitado na busca do mapa</td>
            <td>Encontrar as coordenadas e calcular a distância até os pontos</td>
            <td>Execução do serviço solicitado (art. 7º, V)</td>
          </tr>
          <tr>
            <td>Aviso de informação errada (motivo e comentário opcional), sem identificação de quem enviou</td>
            <td>Corrigir os dados dos pontos de coleta</td>
            <td>Legítimo interesse (art. 7º, IX)</td>
          </tr>
          <tr>
            <td>Conta de parceiro: nome, e-mail, senha (guardada cifrada), nome e tipo do estabelecimento e, se informados, CNPJ/CPF e telefone</td>
            <td>Permitir que o parceiro cadastre e edite os próprios pontos e que a equipe entre em contato sobre eles</td>
            <td>Execução de contrato a pedido do titular (art. 7º, V)</td>
          </tr>
          <tr>
            <td>Dados técnicos de acesso (endereço IP, data e hora, endereço da página acessada)</td>
            <td>Segurança e funcionamento do servidor</td>
            <td>Legítimo interesse (art. 7º, IX) e Marco Civil da Internet (art. 15)</td>
          </tr>
        </tbody>
      </table>

      <h2>3. O que acontece com sua localização</h2>
      <p>
        As coordenadas são enviadas ao nosso servidor apenas para calcular a distância e devolver a lista de
        pontos. Não são gravadas no banco de dados nem associadas a você (contamos apenas quantas buscas
        foram feitas, sem o local). Elas podem aparecer temporariamente
        nos registros técnicos do servidor (logs). Você pode negar ou revogar a permissão a qualquer momento
        nas configurações do navegador; o site continua funcionando a partir do centro da cidade.
      </p>

      <h2>3.1. O que acontece com a foto (aplicativo)</h2>
      <p>
        Antes do envio, o aplicativo reduz a foto e remove os metadados (como o local onde foi tirada). Ela é
        repassada ao serviço de inteligência artificial apenas para sugerir o tipo de resíduo e não é gravada
        no nosso servidor. Guardamos só o resultado (material sugerido, confiança e o que você confirmou), sem
        ligação com você, para medir a taxa de acerto. Evite fotografar pessoas, documentos ou placas de carro.
      </p>

      <h2>4. Serviços de terceiros</h2>
      <ul>
        <li>
          <strong>MapTiler e OpenStreetMap</strong>: as imagens do mapa vêm do MapTiler (com dados do
          OpenStreetMap), que recebe seu endereço IP. Veja a{" "}
          <a href="https://www.maptiler.com/privacy-policy/" target="_blank" rel="noreferrer">política de privacidade do MapTiler</a>.
        </li>
        <li>
          <strong>ViaCEP e Nominatim (OpenStreetMap)</strong>: quando você busca por endereço ou CEP, nosso
          servidor repassa o texto digitado a esses serviços para obter as coordenadas. Eles não recebem seu IP,
          só o do nosso servidor. Veja a{" "}
          <a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noreferrer">política da OSM Foundation</a>.
        </li>
        <li>
          <strong>Google Maps e Waze</strong>: só são acionados quando você clica no botão de rota. A partir daí vale a{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">política de privacidade do Google</a>.
        </li>
        <li>
          <strong>Google Gemini</strong>: recebe a foto enviada pelo aplicativo para identificar o resíduo. Veja os{" "}
          <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">termos da API Gemini</a>.
        </li>
      </ul>
      <p>Não vendemos dados pessoais nem os compartilhamos além dos serviços acima, que são necessários para o funcionamento.</p>

      <h2>5. Por quanto tempo guardamos</h2>
      <p>
        Registros técnicos de acesso são mantidos pelo prazo de 6 meses exigido pelo Marco Civil da Internet
        e depois apagados. Dados da conta de parceiro ficam guardados enquanto a conta existir; para excluí-la,
        escreva para <Contato />. Avisos de informação errada são guardados por até 12 meses depois de tratados.
      </p>

      <h2>6. Seus direitos</h2>
      <p>
        Pela LGPD (art. 18), você pode pedir: confirmação de que tratamos seus dados, acesso, correção,
        anonimização ou eliminação, informação sobre compartilhamento e revogação do consentimento.
        Para isso, escreva para <Contato />. Você também pode reclamar à Autoridade Nacional de Proteção de
        Dados (<a href="https://www.gov.br/anpd" target="_blank" rel="noreferrer">ANPD</a>).
      </p>

      <h2>7. Segurança</h2>
      <p>
        O acesso ao site é feito por conexão criptografada (HTTPS) e o servidor só guarda o necessário para
        funcionar. Senhas são guardadas cifradas (não conseguimos lê-las), e o login de parceiros fica salvo
        só na aba do navegador, sumindo ao fechá-la.
      </p>

      <h2>8. Mudanças nesta política</h2>
      <p>
        Se passarmos a tratar novos dados, esta página será atualizada antes, com a data de revisão no topo.
      </p>
    </Pagina>
  );
}

export function Termos() {
  return (
    <Pagina titulo="Termos de Uso">
      <p className="lead">Ao usar o Descarta Aí, você concorda com as condições abaixo.</p>

      <h2>1. O serviço</h2>
      <p>
        O Descarta Aí é um serviço gratuito e informativo que mostra como descartar resíduos e onde ficam
        pontos de coleta em Araçatuba e região. É mantido por {I.responsavel} como projeto de extensão
        universitária.
      </p>

      <h2>2. Informações sem garantia</h2>
      <p>
        Fazemos o possível para manter os dados corretos, mas horários, endereços e materiais aceitos podem
        mudar sem aviso. Confirme com o local antes de se deslocar. As orientações de descarte são gerais e
        não substituem normas da prefeitura ou de órgãos ambientais.
      </p>

      <h2>3. Uso adequado</h2>
      <ul>
        <li>Não use o site para fins ilegais nem tente prejudicar seu funcionamento.</li>
        <li>Ao reportar ou cadastrar informações, envie apenas dados verdadeiros e que você tenha direito de compartilhar.</li>
      </ul>

      <h2>4. Responsabilidade</h2>
      <p>
        O responsável pelo site não responde por danos decorrentes de informações desatualizadas fornecidas
        por terceiros nem pelo atendimento prestado nos pontos de coleta, que são de responsabilidade de quem
        os opera.
      </p>

      <h2>5. Conteúdo de terceiros</h2>
      <p>
        Dados de mapa © colaboradores do OpenStreetMap, sob licença ODbL. Links para sites externos (como o
        Google Maps) seguem as regras desses serviços.
      </p>

      <h2>6. Privacidade</h2>
      <p>O uso de dados pessoais está descrito na <Link to="/privacidade">Política de Privacidade</Link>.</p>

      <h2>7. Alterações e foro</h2>
      <p>
        Estes termos podem ser atualizados, com a data de revisão indicada no topo. Aplica-se a legislação
        brasileira, e fica eleito o foro da comarca de Araçatuba/SP.
      </p>

      <h2>Contato</h2>
      <p><Contato /></p>
    </Pagina>
  );
}
