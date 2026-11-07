using System.Net.Mail;
using System.Security.Claims;
using DescartaAi.Api.Dados;
using DescartaAi.Api.Dominio;
using DescartaAi.Api.Infraestrutura;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace DescartaAi.Api.Modulos.Contas;

public record CadastroParceiroDto(
    string? Nome, string? Email, string? Senha,
    string? Organizacao, string? Tipo, string? Documento, string? Telefone);

public record LoginDto(string? Email, string? Senha);

public record SessaoDto(string Token, DateTime ExpiraEm, string Nome, string Papel);

public record ContaDto(Guid Id, string Nome, string Email, string Papel, string? Organizacao);

public static class ContasEndpoints
{
    public const int SenhaMinima = 8;
    public static readonly string[] TiposDeParceiro = ["Comércio", "Cooperativa", "Órgão público", "ONG", "Escola", "Outro"];

    public static IEndpointRouteBuilder MapContas(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/auth").WithTags("Contas")
            .RequireRateLimiting(Seguranca.PoliticaLogin);

        // RF14: cadastro de parceiro. A conta já entra ativa; os pontos é que passam pela aprovação (RN01).
        grupo.MapPost("/cadastro", async (CadastroParceiroDto dto, AppDbContext db,
            IPasswordHasher<Usuario> hasher, GeradorDeToken tokens, CancellationToken ct) =>
        {
            var erros = Validar(dto);
            if (erros.Count > 0) return Results.ValidationProblem(erros);

            var email = dto.Email!.Trim().ToLowerInvariant();
            if (await db.Usuarios.AnyAsync(u => u.Email == email, ct))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                    { ["email"] = ["Já existe uma conta com este e-mail."] });

            var usuario = new Usuario { Nome = dto.Nome!.Trim(), Email = email, Papel = PapelUsuario.Parceiro };
            usuario.SenhaHash = hasher.HashPassword(usuario, dto.Senha!);
            var parceiro = new Parceiro
            {
                Usuario = usuario, Nome = dto.Organizacao!.Trim(), Tipo = dto.Tipo!,
                Documento = Limpar(dto.Documento), Telefone = Limpar(dto.Telefone),
            };
            db.Parceiros.Add(parceiro);
            await db.SaveChangesAsync(ct);

            var (token, expira) = tokens.Gerar(usuario, parceiro.Id);
            return Results.Created("/v1/auth/eu", new SessaoDto(token, expira, usuario.Nome, usuario.Papel.ToString()));
        });

        // RF18: login de parceiros e administradores.
        grupo.MapPost("/login", async (LoginDto dto, AppDbContext db,
            IPasswordHasher<Usuario> hasher, GeradorDeToken tokens, CancellationToken ct) =>
        {
            var email = dto.Email?.Trim().ToLowerInvariant() ?? "";
            var usuario = await db.Usuarios.FirstOrDefaultAsync(u => u.Email == email, ct);
            // Mesma resposta para e-mail inexistente e senha errada: não revela quem tem conta.
            if (usuario is null || string.IsNullOrEmpty(dto.Senha)
                || hasher.VerifyHashedPassword(usuario, usuario.SenhaHash, dto.Senha) == PasswordVerificationResult.Failed)
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "E-mail ou senha incorretos");

            var parceiroId = await db.Parceiros.Where(p => p.UsuarioId == usuario.Id)
                .Select(p => (Guid?)p.Id).FirstOrDefaultAsync(ct);
            var (token, expira) = tokens.Gerar(usuario, parceiroId);
            return Results.Ok(new SessaoDto(token, expira, usuario.Nome, usuario.Papel.ToString()));
        });

        app.MapGet("/auth/eu", async (ClaimsPrincipal u, AppDbContext db, CancellationToken ct) =>
        {
            var id = u.UsuarioId();
            var conta = await db.Usuarios.AsNoTracking().Where(x => x.Id == id)
                .Select(x => new ContaDto(x.Id, x.Nome, x.Email, x.Papel.ToString(),
                    db.Parceiros.Where(p => p.UsuarioId == x.Id).Select(p => p.Nome).FirstOrDefault()))
                .FirstOrDefaultAsync(ct);
            return conta is null ? Results.Unauthorized() : Results.Ok(conta);
        }).WithTags("Contas").RequireAuthorization();

        return app;
    }

    private static Dictionary<string, string[]> Validar(CadastroParceiroDto dto)
    {
        var erros = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(dto.Nome) || dto.Nome.Trim().Length > 120)
            erros["nome"] = ["Informe seu nome (até 120 caracteres)."];
        if (!EmailValido(dto.Email))
            erros["email"] = ["Informe um e-mail válido."];
        if (dto.Senha is null || dto.Senha.Length < SenhaMinima || dto.Senha.Length > 128)
            erros["senha"] = [$"A senha precisa ter pelo menos {SenhaMinima} caracteres."];
        if (string.IsNullOrWhiteSpace(dto.Organizacao) || dto.Organizacao.Trim().Length > 120)
            erros["organizacao"] = ["Informe o nome do estabelecimento ou organização (até 120 caracteres)."];
        if (dto.Tipo is null || !TiposDeParceiro.Contains(dto.Tipo))
            erros["tipo"] = [$"Escolha um tipo: {string.Join(", ", TiposDeParceiro)}."];
        if (Limpar(dto.Documento) is { Length: > 18 })
            erros["documento"] = ["CPF ou CNPJ com até 18 caracteres."];
        if (Limpar(dto.Telefone) is { Length: > 20 })
            erros["telefone"] = ["Telefone com até 20 caracteres."];
        return erros;
    }

    private static bool EmailValido(string? email) =>
        !string.IsNullOrWhiteSpace(email) && email.Trim().Length <= 160
        && MailAddress.TryCreate(email.Trim(), out var m) && m.Address == email.Trim() && m.Host.Contains('.');

    internal static string? Limpar(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
