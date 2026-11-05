using System.Text;
using DescartaAi.Api.Modulos.Identificacoes;

namespace DescartaAi.Api.Tests.Unidade;

public class TipoDaImagemTests
{
    [Fact]
    public void Reconhece_JPEG() =>
        Assert.Equal("image/jpeg", IdentificacoesEndpoints.TipoDaImagem([0xFF, 0xD8, 0xFF, 0xE0, 0x00]));

    [Fact]
    public void Reconhece_PNG() =>
        Assert.Equal("image/png", IdentificacoesEndpoints.TipoDaImagem([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]));

    [Fact]
    public void Reconhece_WebP() =>
        Assert.Equal("image/webp", IdentificacoesEndpoints.TipoDaImagem(Encoding.ASCII.GetBytes("RIFF\0\0\0\0WEBPVP8 ")));

    [Theory]
    [InlineData("GIF89a......")]
    [InlineData("<svg xmlns=")]
    [InlineData("%PDF-1.7")]
    [InlineData("")]
    public void Rejeita_outros_formatos(string conteudo) =>
        Assert.Null(IdentificacoesEndpoints.TipoDaImagem(Encoding.ASCII.GetBytes(conteudo)));
}
