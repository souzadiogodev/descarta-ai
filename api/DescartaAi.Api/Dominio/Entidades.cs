using NetTopologySuite.Geometries;

namespace DescartaAi.Api.Dominio;

/// <summary>Sistema de referência das coordenadas (latitude/longitude GPS).</summary>
public static class Srid
{
    public const int Wgs84 = 4326;
}

public enum PapelUsuario { Parceiro, Admin }
public enum StatusPonto { Pendente, Aprovado, Rejeitado, Inativo }
public enum MotivoReporte { Fechado, EnderecoErrado, NaoAceitaMaterial, Outro }
public enum StatusReporte { Pendente, Resolvido, Descartado }

public class Usuario
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Nome { get; set; } = "";
    public string Email { get; set; } = "";
    public string SenhaHash { get; set; } = "";
    public PapelUsuario Papel { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}

public class Parceiro
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }
    public string Nome { get; set; } = "";
    public string? Documento { get; set; }
    public string Tipo { get; set; } = "";
    public string? Telefone { get; set; }
}

public class Categoria
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";
    public string? Icone { get; set; }
    public string? Cor { get; set; }
    public List<Material> Materiais { get; set; } = [];
}

public class Material
{
    public int Id { get; set; }
    public int CategoriaId { get; set; }
    public Categoria? Categoria { get; set; }
    public string Nome { get; set; } = "";
    public string Instrucoes { get; set; } = "";
    public string? Cuidados { get; set; }
    public string[]? Sinonimos { get; set; }
    public bool Perigoso { get; set; }
}

public class PontoDescarte
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? ParceiroId { get; set; }
    public Parceiro? Parceiro { get; set; }
    public string Nome { get; set; } = "";
    public string Endereco { get; set; } = "";
    public string Cidade { get; set; } = "";
    public string Uf { get; set; } = "";
    public string? Cep { get; set; }
    public Point Localizacao { get; set; } = null!;
    public string? Telefone { get; set; }
    public string? Horario { get; set; }
    public StatusPonto Status { get; set; } = StatusPonto.Pendente;
    public Guid? AprovadoPor { get; set; }
    public DateTime? AprovadoEm { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
    public List<PontoMaterial> Materiais { get; set; } = [];
}

public class PontoMaterial
{
    public Guid PontoId { get; set; }
    public PontoDescarte? Ponto { get; set; }
    public int MaterialId { get; set; }
    public Material? Material { get; set; }
}

public class Reporte
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PontoId { get; set; }
    public MotivoReporte Motivo { get; set; }
    public string? Comentario { get; set; }
    public StatusReporte Status { get; set; } = StatusReporte.Pendente;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}

public class Identificacao
{
    public long Id { get; set; }
    public int? MaterialSugeridoId { get; set; }
    public int? MaterialConfirmadoId { get; set; }
    public decimal? Confianca { get; set; }
    public bool Corrigido { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}

/// <summary>Uma busca de pontos de coleta, para as estatísticas (RF21). Não guarda a localização do usuário.</summary>
public class Busca
{
    public long Id { get; set; }
    public int? MaterialId { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
