using System.Net;
using System.Net.Http.Json;
using DescartaAi.Api.Modulos.Admin;
using DescartaAi.Api.Modulos.Contas;
using DescartaAi.Api.Modulos.Localizacao;
using DescartaAi.Api.Modulos.Parceiros;
using DescartaAi.Api.Modulos.Pontos;
using DescartaAi.Api.Tests.Infra;

namespace DescartaAi.Api.Tests.Integracao;

[Collection(ColecaoApi.Nome)]
public sealed class ParceirosEAdminTests(BancoPostgis banco) : IDisposable
{
    private readonly ApiFactory _api = new(banco.ConnectionString);
    private HttpClient Anonimo => _api.CreateClient();

    public void Dispose() => _api.Dispose();

    // ---------- Contas ----------

    [Fact]
    public async Task Cadastro_de_parceiro_devolve_token_e_permite_login()
    {
        var email = NovoEmail();
        var cadastro = await Cadastrar(email);
        Assert.Equal("Parceiro", cadastro.Papel);

        var login = await Anonimo.PostAsJsonAsync("/v1/auth/login", new LoginDto(email.ToUpperInvariant(), "senha-segura-1"));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        var eu = await _api.ClienteCom(cadastro.Token).GetFromJsonAsync<ContaDto>("/v1/auth/eu");
        Assert.Equal(email, eu!.Email);
        Assert.Equal("Mercado Teste", eu.Organizacao);
    }

    [Fact]
    public async Task Cadastro_valida_campos_e_recusa_email_repetido()
    {
        var invalido = await Anonimo.PostAsJsonAsync("/v1/auth/cadastro",
            new CadastroParceiroDto("", "nao-e-email", "curta", "", "Inventado", null, null));
        Assert.Equal(HttpStatusCode.BadRequest, invalido.StatusCode);
        var corpo = await invalido.Content.ReadAsStringAsync();
        foreach (var campo in new[] { "nome", "email", "senha", "organizacao", "tipo" })
            Assert.Contains($"\"{campo}\"", corpo);

        var email = NovoEmail();
        await Cadastrar(email);
        var repetido = await Anonimo.PostAsJsonAsync("/v1/auth/cadastro", NovoCadastro(email));
        Assert.Equal(HttpStatusCode.BadRequest, repetido.StatusCode);
    }

    [Fact]
    public async Task Login_errado_responde_401_sem_dizer_se_o_email_existe()
    {
        var email = NovoEmail();
        await Cadastrar(email);

        var senhaErrada = await Anonimo.PostAsJsonAsync("/v1/auth/login", new LoginDto(email, "outra-senha-123"));
        var semConta = await Anonimo.PostAsJsonAsync("/v1/auth/login", new LoginDto(NovoEmail(), "outra-senha-123"));

        Assert.Equal(HttpStatusCode.Unauthorized, senhaErrada.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, semConta.StatusCode);
        var a = await senhaErrada.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>();
        var b = await semConta.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>();
        Assert.Equal(a!.Title, b!.Title);
        Assert.Equal(a.Detail, b.Detail);
    }

    [Fact]
    public async Task Rotas_protegidas_exigem_login_e_o_papel_certo()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Anonimo.GetAsync("/v1/parceiro/pontos")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Anonimo.GetAsync("/v1/admin/pontos")).StatusCode);

        var parceiro = _api.ClienteCom((await Cadastrar(NovoEmail())).Token);
        Assert.Equal(HttpStatusCode.Forbidden, (await parceiro.GetAsync("/v1/admin/pontos")).StatusCode);

        var admin = _api.ClienteCom(await TokenAdmin());
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.GetAsync("/v1/parceiro/pontos")).StatusCode);

        var falso = _api.ClienteCom("eyJhbGciOiJIUzI1NiJ9.e30.assinatura-invalida");
        Assert.Equal(HttpStatusCode.Unauthorized, (await falso.GetAsync("/v1/parceiro/pontos")).StatusCode);
    }

    // ---------- Fluxo parceiro -> admin -> público ----------

    [Fact]
    public async Task Ponto_do_parceiro_so_fica_publico_depois_de_aprovado_e_volta_para_analise_ao_editar()
    {
        var parceiro = _api.ClienteCom((await Cadastrar(NovoEmail())).Token);
        var admin = _api.ClienteCom(await TokenAdmin());
        var nome = $"Ponto do parceiro {Guid.NewGuid():N}";

        var criado = await parceiro.PostAsJsonAsync("/v1/parceiro/pontos", NovoPonto(nome));
        Assert.Equal(HttpStatusCode.Created, criado.StatusCode);
        var meus = await parceiro.GetFromJsonAsync<List<MeuPontoDto>>("/v1/parceiro/pontos");
        var meu = Assert.Single(meus!);
        Assert.Equal("Pendente", meu.Status);

        // RN01: pendente não aparece para o público.
        Assert.DoesNotContain(await Publicos(), p => p.Id == meu.Id);
        var pendentes = await admin.GetFromJsonAsync<List<PontoAdminDto>>("/v1/admin/pontos?status=Pendente");
        Assert.Contains(pendentes!, p => p.Id == meu.Id && p.Parceiro == "Mercado Teste");

        var aprovar = await admin.PatchAsJsonAsync($"/v1/admin/pontos/{meu.Id}/status", new MudarStatusDto("Aprovado"));
        Assert.Equal(HttpStatusCode.NoContent, aprovar.StatusCode);
        Assert.Contains(await Publicos(), p => p.Id == meu.Id);

        // Editar devolve à fila: o admin precisa revisar a mudança.
        var editar = await parceiro.PutAsJsonAsync($"/v1/parceiro/pontos/{meu.Id}", NovoPonto(nome + " (novo horário)"));
        Assert.Equal(HttpStatusCode.OK, editar.StatusCode);
        Assert.DoesNotContain(await Publicos(), p => p.Id == meu.Id);

        await admin.PatchAsJsonAsync($"/v1/admin/pontos/{meu.Id}/status", new MudarStatusDto("Inativo"));
        Assert.DoesNotContain(await Publicos(), p => p.Id == meu.Id);
    }

    [Fact]
    public async Task Parceiro_nao_edita_ponto_de_outro_parceiro()
    {
        var dono = _api.ClienteCom((await Cadastrar(NovoEmail())).Token);
        var intruso = _api.ClienteCom((await Cadastrar(NovoEmail())).Token);
        await dono.PostAsJsonAsync("/v1/parceiro/pontos", NovoPonto("Ponto do dono"));
        var id = (await dono.GetFromJsonAsync<List<MeuPontoDto>>("/v1/parceiro/pontos"))!.Single().Id;

        var resposta = await intruso.PutAsJsonAsync($"/v1/parceiro/pontos/{id}", NovoPonto("Tomado"));

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
        Assert.Empty((await intruso.GetFromJsonAsync<List<MeuPontoDto>>("/v1/parceiro/pontos"))!);
    }

    [Fact]
    public async Task Cadastro_de_ponto_valida_localizacao_e_materiais()
    {
        var parceiro = _api.ClienteCom((await Cadastrar(NovoEmail())).Token);

        var semNada = await parceiro.PostAsJsonAsync("/v1/parceiro/pontos",
            new PontoEntradaDto("X", "Rua", "Araçatuba", "SP", "123", null, null, null, null, []));
        var corpo = await semNada.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.BadRequest, semNada.StatusCode);
        Assert.Contains("localizacao", corpo);
        Assert.Contains("materiaisIds", corpo);
        Assert.Contains("cep", corpo);

        var materialInexistente = await parceiro.PostAsJsonAsync("/v1/parceiro/pontos",
            NovoPonto("Y") with { MateriaisIds = [999_999] });
        Assert.Equal(HttpStatusCode.BadRequest, materialInexistente.StatusCode);
    }

    [Fact]
    public async Task Admin_nao_aceita_status_invalido_nem_volta_ponto_para_pendente()
    {
        var admin = _api.ClienteCom(await TokenAdmin());
        var qualquer = (await Publicos()).First();

        var invalido = await admin.PatchAsJsonAsync($"/v1/admin/pontos/{qualquer.Id}/status", new MudarStatusDto("Talvez"));
        var pendente = await admin.PatchAsJsonAsync($"/v1/admin/pontos/{qualquer.Id}/status", new MudarStatusDto("Pendente"));
        var inexistente = await admin.PatchAsJsonAsync($"/v1/admin/pontos/{Guid.NewGuid()}/status", new MudarStatusDto("Aprovado"));

        Assert.Equal(HttpStatusCode.BadRequest, invalido.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, pendente.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, inexistente.StatusCode);
    }

    // ---------- Catálogo (RF17) ----------

    [Fact]
    public async Task Admin_cria_edita_e_exclui_material_mas_nao_exclui_material_em_uso()
    {
        var admin = _api.ClienteCom(await TokenAdmin());
        var nome = $"Material teste {Guid.NewGuid():N}"[..40];

        var criado = await admin.PostAsJsonAsync("/v1/admin/materiais",
            new MaterialEntradaDto(1, nome, "Leve ao ponto.", null, ["sinonimo-teste"], false));
        Assert.Equal(HttpStatusCode.Created, criado.StatusCode);
        var id = (await criado.Content.ReadFromJsonAsync<IdDto>())!.Id;

        var editado = await admin.PutAsJsonAsync($"/v1/admin/materiais/{id}",
            new MaterialEntradaDto(1, nome, "Instrução nova.", "Cuidado novo", null, true));
        Assert.Equal(HttpStatusCode.NoContent, editado.StatusCode);
        var detalhe = await Anonimo.GetFromJsonAsync<DescartaAi.Api.Modulos.Materiais.MaterialDetalheDto>($"/v1/materiais/{id}");
        Assert.Equal("Instrução nova.", detalhe!.Instrucoes);
        Assert.True(detalhe.Perigoso);

        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/v1/admin/materiais/{id}")).StatusCode);

        var emUso = (await Publicos()).First(p => p.Materiais.Length > 0);
        var materialEmUso = (await Anonimo.GetFromJsonAsync<List<DescartaAi.Api.Modulos.Materiais.MaterialResumoDto>>("/v1/materiais"))!
            .First(m => m.Nome == emUso.Materiais[0]);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.DeleteAsync($"/v1/admin/materiais/{materialEmUso.Id}")).StatusCode);
    }

    [Fact]
    public async Task Admin_cria_categoria_e_recusa_nome_repetido_e_cor_invalida()
    {
        var admin = _api.ClienteCom(await TokenAdmin());
        var nome = $"Cat {Guid.NewGuid():N}"[..20];

        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/v1/admin/categorias", new CategoriaEntradaDto(nome, null, "#1351B4"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/v1/admin/categorias", new CategoriaEntradaDto(nome, null, null))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/v1/admin/categorias", new CategoriaEntradaDto("Outra " + nome, null, "azul"))).StatusCode);

        // O banco é compartilhado: outros testes contam as categorias da carga inicial.
        await _api.ComBancoAsync(async db =>
        {
            db.Categorias.RemoveRange(db.Categorias.Where(c => c.Nome == nome));
            await db.SaveChangesAsync();
        });
    }

    // ---------- Reportes (RF19) ----------

    [Fact]
    public async Task Cidadao_reporta_ponto_e_admin_resolve()
    {
        var ponto = (await Publicos()).First();
        var admin = _api.ClienteCom(await TokenAdmin());
        var comentario = $"Fechou em {Guid.NewGuid():N}";

        var criado = await Anonimo.PostAsJsonAsync($"/v1/pontos/{ponto.Id}/reportes", new ReporteEntradaDto("Fechado", comentario));
        Assert.Equal(HttpStatusCode.Created, criado.StatusCode);

        var reportes = await admin.GetFromJsonAsync<List<ReporteAdminDto>>("/v1/admin/reportes?status=Pendente");
        var meu = reportes!.Single(r => r.Comentario == comentario);
        Assert.Equal(ponto.Nome, meu.Ponto);

        Assert.Equal(HttpStatusCode.NoContent,
            (await admin.PatchAsJsonAsync($"/v1/admin/reportes/{meu.Id}", new MudarStatusDto("Resolvido"))).StatusCode);
        Assert.DoesNotContain(await admin.GetFromJsonAsync<List<ReporteAdminDto>>("/v1/admin/reportes?status=Pendente") ?? [],
            r => r.Id == meu.Id);
    }

    [Fact]
    public async Task Reporte_valida_motivo_comentario_e_ponto()
    {
        var ponto = (await Publicos()).First();

        Assert.Equal(HttpStatusCode.BadRequest, (await Anonimo.PostAsJsonAsync($"/v1/pontos/{ponto.Id}/reportes", new ReporteEntradaDto("Inventado", null))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Anonimo.PostAsJsonAsync($"/v1/pontos/{ponto.Id}/reportes", new ReporteEntradaDto("Outro", null))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Anonimo.PostAsJsonAsync($"/v1/pontos/{ponto.Id}/reportes", new ReporteEntradaDto("Fechado", new string('x', 501)))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Anonimo.PostAsJsonAsync($"/v1/pontos/{Guid.NewGuid()}/reportes", new ReporteEntradaDto("Fechado", null))).StatusCode);
    }

    // ---------- Localização (RF04) e estatísticas (RF21) ----------

    [Fact]
    public async Task Busca_de_endereco_devolve_coordenadas_e_trata_servico_fora_do_ar()
    {
        var locais = await Anonimo.GetFromJsonAsync<List<LocalDto>>("/v1/localizacao?endereco=16010-000");
        Assert.Equal(-21.2089, Assert.Single(locais!).Lat, precision: 4);
        Assert.Equal("16010-000", _api.Geocodificador.UltimaBusca);

        Assert.Equal(HttpStatusCode.BadRequest, (await Anonimo.GetAsync("/v1/localizacao?endereco=a")).StatusCode);

        _api.Geocodificador.Indisponivel = true;
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await Anonimo.GetAsync("/v1/localizacao?endereco=Rua X")).StatusCode);
    }

    [Fact]
    public async Task Estatisticas_contam_buscas_e_pontos_por_status()
    {
        var admin = _api.ClienteCom(await TokenAdmin());
        var antes = await admin.GetFromJsonAsync<EstatisticasDto>("/v1/admin/estatisticas");

        await Publicos();

        var depois = await admin.GetFromJsonAsync<EstatisticasDto>("/v1/admin/estatisticas");
        Assert.Equal(antes!.Buscas + 1, depois!.Buscas);
        Assert.True(depois.PontosPorStatus["Aprovado"] > 0);
        Assert.Equal(4, depois.PontosPorStatus.Count);
    }

    // ---------- Auxiliares ----------

    private sealed record IdDto(int Id);

    private static string NovoEmail() => $"parceiro-{Guid.NewGuid():N}@teste.com.br";

    private static CadastroParceiroDto NovoCadastro(string email) =>
        new("Fulana de Tal", email, "senha-segura-1", "Mercado Teste", "Comércio", "12.345.678/0001-90", "(18) 3600-0000");

    private async Task<SessaoDto> Cadastrar(string email)
    {
        var r = await Anonimo.PostAsJsonAsync("/v1/auth/cadastro", NovoCadastro(email));
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        return (await r.Content.ReadFromJsonAsync<SessaoDto>())!;
    }

    private async Task<string> TokenAdmin()
    {
        var r = await Anonimo.PostAsJsonAsync("/v1/auth/login", new LoginDto(ApiFactory.AdminEmail, ApiFactory.AdminSenha));
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        return (await r.Content.ReadFromJsonAsync<SessaoDto>())!.Token;
    }

    private static PontoEntradaDto NovoPonto(string nome) =>
        new(nome, "Rua das Flores, 100", "Araçatuba", "sp", "16010-000", null, "Seg a sex, 8h às 18h",
            -21.2050, -50.4300, [1, 2]);

    private async Task<List<PontoProximoDto>> Publicos() =>
        (await Anonimo.GetFromJsonAsync<List<PontoProximoDto>>("/v1/pontos/proximos?lat=-21.2089&lng=-50.4329&raio=50000"))!;
}
