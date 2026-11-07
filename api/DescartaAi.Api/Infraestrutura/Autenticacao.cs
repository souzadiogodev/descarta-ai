using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using DescartaAi.Api.Dados;
using DescartaAi.Api.Dominio;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace DescartaAi.Api.Infraestrutura;

public static class Autenticacao
{
    public const string PoliticaParceiro = "parceiro";
    public const string PoliticaAdmin = "admin";
    public const string ClaimParceiro = "parceiro_id";

    /// <summary>Login por token JWT (Bearer). A chave vem de Jwt:Chave e precisa ter 32+ caracteres.</summary>
    public static IServiceCollection AddAutenticacao(this IServiceCollection services, IConfiguration config)
    {
        var chave = config["Jwt:Chave"];
        if (string.IsNullOrWhiteSpace(chave) || chave.Length < 32)
            throw new InvalidOperationException(
                "Configure Jwt:Chave com pelo menos 32 caracteres (ex.: openssl rand -hex 32).");

        var parametros = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = GeradorDeToken.Emissor,
            ValidateAudience = true,
            ValidAudience = GeradorDeToken.Emissor,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(chave)),
            NameClaimType = ClaimTypes.Name,
            RoleClaimType = ClaimTypes.Role,
        };

        services.AddSingleton(new GeradorDeToken(parametros.IssuerSigningKey));
        services.AddSingleton<IPasswordHasher<Usuario>, PasswordHasher<Usuario>>();
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(o =>
            {
                o.MapInboundClaims = false;
                o.TokenValidationParameters = parametros;
            });
        services.AddAuthorizationBuilder()
            .AddPolicy(PoliticaParceiro, p => p.RequireRole(nameof(PapelUsuario.Parceiro)).RequireClaim(ClaimParceiro))
            .AddPolicy(PoliticaAdmin, p => p.RequireRole(nameof(PapelUsuario.Admin)));
        return services;
    }

    public static Guid UsuarioId(this ClaimsPrincipal u) => Guid.Parse(u.FindFirstValue(JwtRegisteredClaimNames.Sub)!);
    public static Guid ParceiroId(this ClaimsPrincipal u) => Guid.Parse(u.FindFirstValue(ClaimParceiro)!);

    /// <summary>
    /// Cria o primeiro administrador a partir de Admin:Email e Admin:Senha, se ainda não houver nenhum.
    /// Depois do primeiro acesso, as variáveis podem ser removidas.
    /// </summary>
    public static async Task GarantirAdminInicialAsync(AppDbContext db, IConfiguration config, IPasswordHasher<Usuario> hasher)
    {
        var email = config["Admin:Email"]?.Trim().ToLowerInvariant();
        var senha = config["Admin:Senha"];
        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(senha)) return;
        if (await db.Usuarios.AnyAsync(u => u.Papel == PapelUsuario.Admin)) return;

        var admin = new Usuario { Nome = "Administrador", Email = email, Papel = PapelUsuario.Admin };
        admin.SenhaHash = hasher.HashPassword(admin, senha);
        db.Usuarios.Add(admin);
        await db.SaveChangesAsync();
    }
}

public sealed class GeradorDeToken(SecurityKey chave)
{
    public const string Emissor = "descartaai";
    public static readonly TimeSpan Validade = TimeSpan.FromHours(8);

    public (string Token, DateTime ExpiraEm) Gerar(Usuario usuario, Guid? parceiroId)
    {
        var expiraEm = DateTime.UtcNow.Add(Validade);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
            new(ClaimTypes.Name, usuario.Nome),
            new(ClaimTypes.Role, usuario.Papel.ToString()),
        };
        if (parceiroId is { } id) claims.Add(new(Autenticacao.ClaimParceiro, id.ToString()));

        var token = new JwtSecurityToken(Emissor, Emissor, claims, expires: expiraEm,
            signingCredentials: new SigningCredentials(chave, SecurityAlgorithms.HmacSha256));
        return (new JwtSecurityTokenHandler().WriteToken(token), expiraEm);
    }
}
