using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;

namespace DescartaAi.Api.Infraestrutura;

public static class Seguranca
{
    /// <summary>Limite mais apertado para a identificação por foto, que custa uma chamada à IA.</summary>
    public const string PoliticaIdentificacao = "identificacao";

    /// <summary>CORS restrito, limite de requisições por IP e leitura do IP real atrás de proxy.</summary>
    public static IServiceCollection AddSeguranca(this IServiceCollection services, IConfiguration config)
    {
        var origens = config["Cors:Origens"]?
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) ?? [];
        services.AddCors(o => o.AddDefaultPolicy(p =>
            p.WithOrigins(origens).WithMethods("GET").AllowAnyHeader()));

        var porMinuto = config.GetValue("Limite:RequisicoesPorMinuto", 120);
        services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
                RateLimitPartition.GetFixedWindowLimiter(
                    ctx.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = porMinuto, Window = TimeSpan.FromMinutes(1) }));

            var identificacoesPorMinuto = config.GetValue("Limite:IdentificacoesPorMinuto", 10);
            o.AddPolicy(PoliticaIdentificacao, ctx =>
                RateLimitPartition.GetFixedWindowLimiter(
                    ctx.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = identificacoesPorMinuto, Window = TimeSpan.FromMinutes(1) }));
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
        return app;
    }
}
