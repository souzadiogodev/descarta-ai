using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;

namespace DescartaAi.Api.Infraestrutura;

public static class Seguranca
{
    /// <summary>Limite mais apertado para a identificação por foto, que custa uma chamada à IA.</summary>
    public const string PoliticaIdentificacao = "identificacao";
    /// <summary>Freia tentativas de adivinhar senha.</summary>
    public const string PoliticaLogin = "login";
    /// <summary>Evita enxurrada de reportes falsos.</summary>
    public const string PoliticaReporte = "reporte";
    /// <summary>O Nominatim aceita no máximo 1 requisição por segundo.</summary>
    public const string PoliticaLocalizacao = "localizacao";

    /// <summary>CORS restrito, limite de requisições por IP e leitura do IP real atrás de proxy.</summary>
    public static IServiceCollection AddSeguranca(this IServiceCollection services, IConfiguration config)
    {
        var origens = config["Cors:Origens"]?
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) ?? [];
        services.AddCors(o => o.AddDefaultPolicy(p =>
            p.WithOrigins(origens).WithMethods("GET", "POST", "PUT", "PATCH", "DELETE")
             .WithHeaders("Content-Type", "Authorization")));

        var porMinuto = config.GetValue("Limite:RequisicoesPorMinuto", 120);
        services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
                RateLimitPartition.GetFixedWindowLimiter(
                    ctx.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = porMinuto, Window = TimeSpan.FromMinutes(1) }));

            PorIp(o, PoliticaIdentificacao, config.GetValue("Limite:IdentificacoesPorMinuto", 10));
            PorIp(o, PoliticaLogin, config.GetValue("Limite:LoginsPorMinuto", 10));
            PorIp(o, PoliticaReporte, config.GetValue("Limite:ReportesPorMinuto", 5));
            PorIp(o, PoliticaLocalizacao, config.GetValue("Limite:LocalizacoesPorMinuto", 20));
        });

        // Em produção a API fica atrás de um proxy (nginx, Cloudflare); sem isto, todo mundo
        // compartilharia o IP do proxy no limite de requisições. Configure o IP do proxy em Proxy:Confiaveis.
        services.Configure<ForwardedHeadersOptions>(o =>
        {
            o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            foreach (var ip in config.GetSection("Proxy:Confiaveis").Get<string[]>() ?? [])
                o.KnownProxies.Add(System.Net.IPAddress.Parse(ip));
        });

        return services;
    }

    private static void PorIp(RateLimiterOptions o, string politica, int porMinuto) =>
        o.AddPolicy(politica, ctx => RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = porMinuto, Window = TimeSpan.FromMinutes(1) }));

    public static WebApplication UseSeguranca(this WebApplication app)
    {
        app.UseForwardedHeaders();
        if (!app.Environment.IsDevelopment())
        {
            app.UseHsts();
            app.UseHttpsRedirection();
        }

        app.Use(async (ctx, next) =>
        {
            var h = ctx.Response.Headers;
            h.XContentTypeOptions = "nosniff";
            h.XFrameOptions = "DENY";
            h["Referrer-Policy"] = "no-referrer";
            await next();
        });

        app.UseCors();
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();
        return app;
    }
}
