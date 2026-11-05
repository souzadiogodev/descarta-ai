using DescartaAi.Api.Dados;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace DescartaAi.Api.Infraestrutura;

/// <summary>Usado por GET /health: a API só está saudável se alcança o banco.</summary>
public class SaudeDoBanco(AppDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext contexto, CancellationToken ct = default) =>
        await db.Database.CanConnectAsync(ct)
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy("Banco de dados inacessível");
}
