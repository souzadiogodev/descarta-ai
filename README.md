# Descarta Aí

Plataforma web e mobile de descarte consciente: mostra como descartar cada tipo de resíduo e indica o ponto de coleta mais próximo em Araçatuba e região.

Projeto de extensão (UNIP, Análise e Desenvolvimento de Sistemas), desenvolvido pela NSI (Nexus Software Intelligence).

## Funcionalidades

- **Guia de descarte**: busca por item (sem precisar de acento) e filtro por tipo de resíduo, com instruções, cuidados e aviso de resíduo perigoso.
- **Mapa de pontos de coleta**: busca por proximidade (raio de 2 a 50 km), filtro por material, localização do usuário ou endereço/CEP digitado, e rota pelo Google Maps ou pelo Waze.
- **Identificação por foto (app)**: a foto é reduzida, enviada à API e analisada pelo Google Gemini; o usuário confirma a sugestão antes de ver o destino. A foto não é guardada.
- **Aviso de informação errada**: qualquer pessoa avisa, sem se identificar, que um ponto fechou, mudou de endereço ou não aceita um material.
- **Parceiros**: mercados, farmácias, cooperativas e órgãos públicos criam conta e cadastram os próprios pontos, que só aparecem no mapa depois de aprovados.
- **Administração**: aprovação, rejeição e desativação de pontos, tratamento dos avisos, cadastro de materiais e categorias e estatísticas de uso (buscas, fotos e taxa de acerto da IA).
- **Dicas** de descarte consciente e **páginas institucionais**: Sobre, Política de Privacidade (LGPD) e Termos de Uso.
- Interface acessível: navegação por teclado, foco visível, rótulos em todos os campos, áreas de toque de 44 px e suporte a leitores de tela.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `api/` | API REST em ASP.NET Core (.NET 10), EF Core, PostgreSQL + PostGIS |
| `web/` | Site em React + Vite + TypeScript, mapa com Leaflet e OpenStreetMap |
| `mobile/` | App em React Native + Expo: guia, mapa, pontos próximos e identificação por foto |

## Como rodar localmente

Pré-requisitos: [.NET 10 SDK](https://dotnet.microsoft.com/download), [Node.js 20+](https://nodejs.org) e [Docker](https://www.docker.com).

```bash
# 1. Banco de dados (PostgreSQL 16 + PostGIS)
docker compose up -d

# 2. API — aplica as migrações e a carga inicial ao iniciar
cd api/DescartaAi.Api
dotnet run
# Swagger: http://localhost:5158/swagger

# 3. Site (em outro terminal)
cd web
cp .env.example .env    # ajuste as variáveis se precisar
npm install
npm run dev
# http://localhost:5173
```

### App mobile

```bash
cd mobile
cp .env.example .env    # EXPO_PUBLIC_API_URL: endereço da API visto pelo celular
npm install
npx expo start          # abra no Expo Go ou no emulador Android
```

No celular físico, `localhost` é o próprio aparelho: use o IP do computador na rede e rode a API com `dotnet run --urls http://0.0.0.0:5158`.

A identificação por foto precisa de uma chave do [Google AI Studio](https://aistudio.google.com/apikey) na API. Sem ela, a tela de foto avisa que o serviço está indisponível:

```bash
cd api/DescartaAi.Api
dotnet user-secrets set "Gemini:ChaveApi" "SUA-CHAVE"
```

APK para demonstração: `npx eas-cli build -p android --profile preview` (requer conta Expo). O endereço da API usado no APK fica em `mobile/eas.json` e precisa ser HTTPS.

### Testes do app

```bash
cd mobile
npm test
```

São 30 testes (Jest + Testing Library): cliente da API (inclusive o envio da foto como arquivo), guia (busca com espera de digitação, filtro por categoria, lista vazia, erro com "Tentar de novo"), identificação por foto (aviso de privacidade, permissão negada, redução da imagem, sugestões, confirmação e erros 400/413/429/503) e tela do ponto (rotas pelo Google Maps e Waze, aviso de erro).

### Variáveis do site (`web/.env`)

| Variável | Descrição |
|---|---|
| `VITE_API_URL` | Endereço da API (padrão `http://localhost:5158/v1`) |
| `VITE_CONTATO_EMAIL` | E-mail de contato exibido em Sobre, Privacidade e Termos |
| `VITE_NSI_CNPJ` | CNPJ do responsável pelo site |
| `VITE_MAPTILER_CHAVE` | Chave do [MapTiler](https://cloud.maptiler.com) (plano grátis) para o fundo do mapa. Sem ela, usa os tiles do OpenStreetMap, que servem só para desenvolvimento |

No app, a chave do mapa vai em `EXPO_PUBLIC_MAPTILER_CHAVE` no `mobile/.env`.

### Entrar como administrador (desenvolvimento)

Em desenvolvimento, a API cria o admin `admin@descartaai.local` com a senha `admin-local-123` (veja `appsettings.Development.json`). Entre em http://localhost:5173/entrar. Parceiros se cadastram em `/parceiro/cadastro`.

### Testes da API

```bash
cd api
dotnet test
```

São 72 testes, em `api/DescartaAi.Api.Tests`:

- **Unidade:** validação da busca por proximidade (coordenadas e raio) e reconhecimento do formato da imagem pelo conteúdo.
- **Identificação por foto:** com a IA substituída por um classificador falso, cobrem a ordenação por confiança, o descarte de ids inventados, os limites de 3 sugestões e 5 MB (413), arquivo que não é imagem (400), IA fora do ar (503), limite de 10 fotos por minuto (429) e a confirmação/correção.
- **Integração:** sobem a API completa contra um PostgreSQL + PostGIS real, criado automaticamente em um contêiner descartável ([Testcontainers](https://dotnet.testcontainers.org)). Cobrem a busca sem acento e por sinônimos, a ordenação por distância, o filtro por material e raio, a regra de que pontos pendentes não são públicos e os erros 400/404.
- **Parceiros e administração:** cadastro e login (inclusive erro sem revelar se o e-mail existe), papéis (401/403), ponto do parceiro que só vira público depois de aprovado e volta à análise ao ser editado, parceiro que não edita ponto alheio, catálogo de materiais (material em uso não é excluído), avisos de erro, busca por endereço e estatísticas.
- **Segurança:** cabeçalhos, Swagger desligado em produção, CORS só para a origem configurada, limite de requisições (429) e curingas do LIKE escapados.

Requer o Docker em execução.

### Testes do site

```bash
cd web
npm test            # roda uma vez
npm run test:watch  # roda a cada alteração
```

São 63 testes ([Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com)) que simulam o uso real (digitar, clicar, escolher filtros) com a API substituída por respostas controladas:

- **Guia:** busca com espera de digitação, filtros gravados na URL, item aberto com instruções e link para o mapa, lista vazia e erros com "Tentar de novo".
- **Mapa:** distâncias, filtros vindos do guia, enquadramento, seleção de ponto, localização permitida ou negada, aumento de raio e link de rota.
- **Mapa (novos):** rota pelo Waze, busca por endereço ou CEP e aviso de informação errada.
- **Parceiros e administração:** login, cadastro com erros por campo, áreas restritas, sessão expirada, cadastro de ponto com localização do endereço e aprovação pelo admin.
- **Navegação e páginas institucionais:** menu, rodapé, página não encontrada e conteúdo exigido pela LGPD.
- **Base:** formatação, cliente da API e o hook `useConsulta`, incluindo respostas que chegam fora de ordem.

Não precisa da API nem do Docker.

### Configuração da API em produção

Veja `.env.example` na raiz. Pontos principais:

| Variável | Descrição |
|---|---|
| `ConnectionStrings__Default` | Conexão com o PostgreSQL (use usuário e senha próprios, não `postgres`) |
| `Cors__Origens` | Domínios do site autorizados a chamar a API |
| `Banco__MigrarAoIniciar` | `true` para aplicar migrações e carga inicial ao subir |
| `Swagger__Habilitado` | Expõe `/swagger` fora do ambiente de desenvolvimento (padrão: desligado) |
| `Limite__RequisicoesPorMinuto` | Limite por IP (padrão 120); acima disso a API responde 429 |
| `Proxy__Confiaveis__0` | IP do proxy reverso, para o limite usar o IP real do usuário |
| `Jwt__Chave` | Chave de assinatura dos logins, com 32+ caracteres (`openssl rand -hex 32`). Obrigatória |
| `Admin__Email`, `Admin__Senha` | Primeiro administrador, criado só se ainda não houver nenhum |

## Organização do código

```
api/DescartaAi.Api/
├── Dominio/          entidades e enums
├── Dados/            DbContext, migrações e carga inicial (catálogo + pontos do OSM)
├── Modulos/
│   ├── Materiais/    endpoints, serviço e DTOs do guia
│   ├── Pontos/       busca por proximidade, detalhe e avisos de erro
│   ├── Identificacoes/ identificação por foto (Gemini)
│   ├── Localizacao/  endereço ou CEP → coordenadas (ViaCEP + Nominatim)
│   ├── Contas/       cadastro de parceiro e login
│   ├── Parceiros/    pontos do parceiro
│   └── Admin/        moderação, catálogo, avisos e estatísticas
└── Infraestrutura/   segurança (CORS, limites, cabeçalhos, HTTPS), login (JWT) e tratamento de erros

api/DescartaAi.Api.Tests/
├── Unidade/          regras isoladas, sem banco
├── Integracao/       API + PostGIS real (materiais, pontos, segurança)
└── Infra/            contêiner do banco e fábrica da API para os testes

web/src/
├── paginas/          uma página por rota
├── componentes/      peças reutilizáveis (avisos, esqueletos de carregamento)
├── testes/           configuração e auxiliares dos testes (*.test.tsx ficam ao lado do código)
├── api.ts            cliente da API com cancelamento de requisições
└── util.ts           formatação e hook useConsulta
```

## API

Base: `/v1`. Documentação interativa em `/swagger` (em desenvolvimento).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/categorias` | Tipos de resíduo |
| GET | `/materiais?busca=&categoriaId=` | Lista e busca de materiais |
| GET | `/materiais/{id}` | Instruções e cuidados de descarte |
| GET | `/pontos/proximos?lat=&lng=&raio=&materialId=` | Pontos aprovados por distância (raio em metros, máx. 50 000) |
| GET | `/pontos/{id}` | Detalhe de um ponto |
| POST | `/pontos/{id}/reportes` | Aviso de informação errada (`motivo`, `comentario`) |
| GET | `/localizacao?endereco=` | Endereço ou CEP → coordenadas |
| POST | `/identificacoes` | Identificação por foto (multipart, campo `foto`) |
| PATCH | `/identificacoes/{id}` | Confirma ou corrige o material sugerido |
| POST | `/auth/cadastro` | Cadastro de parceiro (devolve o token) |
| POST | `/auth/login` | Login de parceiro ou admin |
| GET | `/auth/eu` | Dados de quem está logado |
| GET, POST | `/parceiro/pontos` | Pontos do parceiro (lista e cadastro) |
| PUT | `/parceiro/pontos/{id}` | Edita um ponto do parceiro (volta para análise) |
| GET | `/admin/pontos?status=` | Pontos por situação |
| PATCH | `/admin/pontos/{id}/status` | Aprova, rejeita ou desativa |
| GET, PATCH | `/admin/reportes` | Avisos de erro |
| POST, PUT, DELETE | `/admin/materiais` | Catálogo de materiais |
| POST, PUT | `/admin/categorias` | Categorias |
| GET | `/admin/estatisticas` | Números de uso |

As rotas `/parceiro/*` e `/admin/*` exigem `Authorization: Bearer <token>`.

Erros seguem o padrão RFC 7807 (`application/problem+json`).

## Dados

Os pontos de coleta iniciais vêm do OpenStreetMap (© colaboradores do OpenStreetMap, licença [ODbL](https://opendatacommons.org/licenses/odbl/)). Correções e novos pontos são bem-vindos pelo contato informado no site.

## Licença

Veja [LICENSE](LICENSE).

## Publicação

Site no Cloudflare Pages e API + banco em um VPS com Docker (Caddy para HTTPS, backup diário). O passo a passo está em [`deploy/README.md`](deploy/README.md). O GitHub Actions (`.github/workflows/`) roda os testes da API, do site e do app a cada push e publica ao mesclar na `main`.
