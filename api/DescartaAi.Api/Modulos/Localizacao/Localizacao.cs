using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using DescartaAi.Api.Infraestrutura;

namespace DescartaAi.Api.Modulos.Localizacao;

public record LocalDto(string Descricao, double Lat, double Lng);

public interface IGeocodificador
{
    /// <summary>Converte um endereço ou CEP em coordenadas. Lança <see cref="GeocodificadorIndisponivelException"/> se o serviço falhar.</summary>
    Task<IReadOnlyList<LocalDto>> BuscarAsync(string texto, CancellationToken ct);
}

public class GeocodificadorIndisponivelException(string msg) : Exception(msg);

/// <summary>
/// RF04: quando o GPS não está disponível, o usuário digita o endereço ou o CEP.
/// CEP: ViaCEP devolve rua/bairro/cidade, que vão para o Nominatim (OpenStreetMap).
/// A política do Nominatim pede um User-Agent identificável e no máximo 1 requisição por segundo,
/// por isso a rota tem limite próprio por IP.
/// </summary>
public partial class NominatimGeocodificador(HttpClient http, IConfiguration config) : IGeocodificador
{
    private const int MaxResultados = 5;

    public async Task<IReadOnlyList<LocalDto>> BuscarAsync(string texto, CancellationToken ct)
    {
        try
        {
            var consultas = new List<string> { texto };
            var cep = Regex.Replace(texto, @"\D", "");
            if (Cep().IsMatch(texto.Trim()) && cep.Length == 8)
            {
                var via = await http.GetFromJsonAsync<JsonElement>($"https://viacep.com.br/ws/{cep}/json/", ct);
                if (via.TryGetProperty("erro", out _)) return [];
                string? Campo(string c) => via.TryGetProperty(c, out var v) && !string.IsNullOrWhiteSpace(v.GetString()) ? v.GetString() : null;
                string Juntar(params string?[] partes) => string.Join(", ", partes.Where(p => p is not null));
                // O bairro às vezes atrapalha o Nominatim; sem ele, a rua costuma ser encontrada.
                consultas = [Juntar(Campo("logradouro"), Campo("bairro"), Campo("localidade"), Campo("uf")),
                             Juntar(Campo("logradouro"), Campo("localidade"), Campo("uf"))];
            }

            foreach (var (consulta, i) in consultas.Distinct().Select((c, i) => (c, i)))
            {
                if (i > 0) await Task.Delay(TimeSpan.FromSeconds(1), ct); // política do Nominatim: 1 req/s
                var achados = await NominatimAsync(consulta, ct);
                if (achados.Count > 0) return achados;
            }
            return [];
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException { CancellationToken.IsCancellationRequested: false } or JsonException)
        {
            throw new GeocodificadorIndisponivelException(e.Message);
        }
    }

    private async Task<List<LocalDto>> NominatimAsync(string consulta, CancellationToken ct)
    {
        var url = "https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=br&addressdetails=0"
            + $"&limit={MaxResultados}&accept-language=pt-BR&q={Uri.EscapeDataString(consulta)}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.UserAgent.ParseAdd($"DescartaAi/1.0 (+{config["Site:Url"] ?? "https://descartaai.com.br"})");
        using var resp = await http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
        var itens = await resp.Content.ReadFromJsonAsync<JsonElement>(ct);
        return itens.EnumerateArray()
            .Select(i => new LocalDto(
                i.GetProperty("display_name").GetString() ?? consulta,
                double.Parse(i.GetProperty("lat").GetString()!, CultureInfo.InvariantCulture),
                double.Parse(i.GetProperty("lon").GetString()!, CultureInfo.InvariantCulture)))
            .ToList();
    }

    [GeneratedRegex(@"^\d{5}-?\d{3}$")]
    private static partial Regex Cep();
}

public static class LocalizacaoEndpoints
{
    public static IEndpointRouteBuilder MapLocalizacao(this IEndpointRouteBuilder app)
    {
        app.MapGet("/localizacao", async (string? endereco, IGeocodificador geo, CancellationToken ct) =>
        {
            var texto = endereco?.Trim() ?? "";
            if (texto.Length is < 3 or > 200)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                    { ["endereco"] = ["Digite um endereço ou CEP (de 3 a 200 caracteres)."] });
            try
            {
                return Results.Ok(await geo.BuscarAsync(texto, ct));
            }
            catch (GeocodificadorIndisponivelException)
            {
                return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable,
                    title: "Busca de endereço indisponível", detail: "Tente de novo em instantes ou use sua localização.");
            }
        }).WithTags("Localização").RequireRateLimiting(Seguranca.PoliticaLocalizacao);

        return app;
    }
}
