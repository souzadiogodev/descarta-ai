using DescartaAi.Api.Dados;
using DescartaAi.Api.Dados.Carga;
using DescartaAi.Api.Infraestrutura;
using DescartaAi.Api.Dominio;
using DescartaAi.Api.Modulos.Admin;
using DescartaAi.Api.Modulos.Contas;
using DescartaAi.Api.Modulos.Identificacoes;
using DescartaAi.Api.Modulos.Localizacao;
using DescartaAi.Api.Modulos.Parceiros;
using DescartaAi.Api.Modulos.Materiais;
using DescartaAi.Api.Modulos.Pontos;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Default"), n => n.UseNetTopologySuite().EnableRetryOnFailure(maxRetryCount: 3))
     .UseSnakeCaseNamingConvention());

builder.Services.AddScoped<IMateriaisServico, MateriaisServico>();
builder.Services.AddScoped<IPontosServico, PontosServico>();
builder.Services.AddScoped<IIdentificacoesServico, IdentificacoesServico>();
builder.Services.AddHttpClient<IClassificadorDeImagem, GeminiClassificador>(c => c.Timeout = TimeSpan.FromSeconds(30));

builder.Services.AddHttpClient<IGeocodificador, NominatimGeocodificador>(c => c.Timeout = TimeSpan.FromSeconds(10));

builder.Services.AddSeguranca(builder.Configuration);
builder.Services.AddAutenticacao(builder.Configuration);
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddHealthChecks().AddCheck<SaudeDoBanco>("banco");
builder.Services.AddExceptionHandler<ErroDeRequisicaoHandler>();
builder.Services.AddProblemDetails();

var swaggerHabilitado = builder.Environment.IsDevelopment() || builder.Configuration.GetValue<bool>("Swagger:Habilitado");
if (swaggerHabilitado)
{
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(o => o.SwaggerDoc("v1", new() { Title = "Descarta Aí API", Version = "v1" }));
}

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseSeguranca();

if (swaggerHabilitado)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Banco:MigrarAoIniciar"))
{
    await using var escopo = app.Services.CreateAsyncScope();
    var db = escopo.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await CargaInicial.ExecutarAsync(db);
    await Autenticacao.GarantirAdminInicialAsync(db, app.Configuration,
        escopo.ServiceProvider.GetRequiredService<IPasswordHasher<Usuario>>());
}

// Monitoramento (UptimeRobot, healthcheck do Docker): responde só "Healthy"/"Unhealthy", sem detalhes.
app.MapHealthChecks("/health").DisableRateLimiting();

app.MapGroup("/v1")
    .MapMateriais()
    .MapPontos()
    .MapIdentificacoes()
    .MapLocalizacao()
    .MapContas()
    .MapParceiros()
    .MapAdmin();

app.Run();

/// <summary>Exposto para os testes de integração (WebApplicationFactory).</summary>
public partial class Program;
