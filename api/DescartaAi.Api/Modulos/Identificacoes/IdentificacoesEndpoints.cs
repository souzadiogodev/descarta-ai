using DescartaAi.Api.Infraestrutura;

namespace DescartaAi.Api.Modulos.Identificacoes;

public static class IdentificacoesEndpoints
{
    public const long TamanhoMaximoBytes = 5 * 1024 * 1024;

    public static IEndpointRouteBuilder MapIdentificacoes(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/identificacoes").WithTags("Identificação por foto")
            .RequireRateLimiting(Seguranca.PoliticaIdentificacao);

        grupo.MapPost("", async (HttpRequest req, IIdentificacoesServico servico, CancellationToken ct) =>
        {
            const long folgaDoMultipart = 64 * 1024;
            if (req.ContentLength > TamanhoMaximoBytes + folgaDoMultipart)
                return ImagemGrandeDemais();
            if (!req.HasFormContentType)
                return Invalido("Envie a imagem como multipart/form-data no campo \"foto\".");

            // Sem Content-Length (envio em partes), o servidor leria até 30 MB: corta antes.
            if (req.HttpContext.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>()
                is { IsReadOnly: false } limite)
                limite.MaxRequestBodySize = TamanhoMaximoBytes + folgaDoMultipart;

            IFormCollection form;
            try
            {
                form = await req.ReadFormAsync(ct);
            }
            catch (BadHttpRequestException ex) when (ex.StatusCode == StatusCodes.Status413PayloadTooLarge)
            {
                return ImagemGrandeDemais();
            }
            catch (InvalidDataException)
            {
                return Invalido("Envio multipart inválido.");
            }
            var foto = form.Files.GetFile("foto");
            if (foto is null || foto.Length == 0)
                return Invalido("Envie a imagem no campo \"foto\".");
            if (foto.Length > TamanhoMaximoBytes)
                return ImagemGrandeDemais();

            await using var fluxo = foto.OpenReadStream();
            using var memoria = new MemoryStream((int)foto.Length);
            await fluxo.CopyToAsync(memoria, ct);
            var bytes = memoria.ToArray();

            // Confere o conteúdo real, não o Content-Type declarado pelo cliente.
            if (TipoDaImagem(bytes) is not { } tipo)
                return Invalido("Formato não suportado. Use JPEG, PNG ou WebP.");

            try
            {
                return Results.Ok(await servico.IdentificarAsync(bytes, tipo, ct));
            }
            catch (ClassificadorIndisponivelException)
            {
                return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable,
                    title: "Identificação por foto indisponível",
                    detail: "Tente de novo mais tarde ou busque o item pelo nome.");
            }
        })
        .Accepts<IFormFile>("multipart/form-data")
        .Produces<IdentificacaoDto>()
        .DisableAntiforgery();

        grupo.MapPatch("/{id:long}", async (long id, ConfirmacaoDto corpo, IIdentificacoesServico servico, CancellationToken ct) =>
            await servico.ConfirmarAsync(id, corpo.MaterialId, ct) switch
            {
                ResultadoConfirmacao.Ok => Results.NoContent(),
                ResultadoConfirmacao.NaoEncontrada =>
                    Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Identificação não encontrada"),
                ResultadoConfirmacao.JaConfirmada =>
                    Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Identificação já confirmada"),
                _ => Invalido("Material inexistente.", "materialId"),
            });

        return app;
    }

    /// <summary>Reconhece JPEG, PNG e WebP pelos primeiros bytes do arquivo.</summary>
    public static string? TipoDaImagem(ReadOnlySpan<byte> b) =>
        b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF ? "image/jpeg"
        : b.Length >= 8 && b[..8].SequenceEqual((byte[])[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) ? "image/png"
        : b.Length >= 12 && b[..4].SequenceEqual("RIFF"u8) && b[8..12].SequenceEqual("WEBP"u8) ? "image/webp"
        : null;

    private static IResult ImagemGrandeDemais() =>
        Results.Problem(statusCode: StatusCodes.Status413PayloadTooLarge,
            title: "Imagem grande demais", detail: "Envie uma imagem de até 5 MB.");

    private static IResult Invalido(string mensagem, string campo = "foto") =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [campo] = [mensagem] });
}
