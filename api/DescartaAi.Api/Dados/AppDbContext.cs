using DescartaAi.Api.Dominio;
using Microsoft.EntityFrameworkCore;

namespace DescartaAi.Api.Dados;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Parceiro> Parceiros => Set<Parceiro>();
    public DbSet<Categoria> Categorias => Set<Categoria>();
    public DbSet<Material> Materiais => Set<Material>();
    public DbSet<PontoDescarte> Pontos => Set<PontoDescarte>();
    public DbSet<PontoMaterial> PontoMateriais => Set<PontoMaterial>();
    public DbSet<Reporte> Reportes => Set<Reporte>();
    public DbSet<Identificacao> Identificacoes => Set<Identificacao>();
    public DbSet<Busca> Buscas => Set<Busca>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasPostgresExtension("postgis");
        mb.HasPostgresExtension("pg_trgm");
        mb.HasPostgresExtension("unaccent");

        mb.Entity<Usuario>(e =>
        {
            e.ToTable("usuario", t => t.HasCheckConstraint("ck_usuario_papel", "papel IN ('Parceiro','Admin')"));
            e.Property(x => x.Nome).HasMaxLength(120);
            e.Property(x => x.Email).HasMaxLength(160);
            e.Property(x => x.SenhaHash).HasMaxLength(255);
            e.Property(x => x.Papel).HasConversion<string>().HasMaxLength(15);
            e.HasIndex(x => x.Email).IsUnique();
        });

        mb.Entity<Parceiro>(e =>
        {
            e.ToTable("parceiro");
            e.Property(x => x.Nome).HasMaxLength(120);
            e.Property(x => x.Documento).HasMaxLength(18);
            e.Property(x => x.Tipo).HasMaxLength(30);
            e.Property(x => x.Telefone).HasMaxLength(20);
            e.HasIndex(x => x.UsuarioId).IsUnique();
            e.HasOne(x => x.Usuario).WithMany().HasForeignKey(x => x.UsuarioId);
        });

        mb.Entity<Categoria>(e =>
        {
            e.ToTable("categoria");
            e.Property(x => x.Nome).HasMaxLength(60);
            e.Property(x => x.Icone).HasMaxLength(60);
            e.Property(x => x.Cor).HasMaxLength(7);
            e.HasIndex(x => x.Nome).IsUnique();
        });

        mb.Entity<Material>(e =>
        {
            e.ToTable("material");
            e.Property(x => x.Nome).HasMaxLength(80);
            e.Property(x => x.Sinonimos).HasColumnType("varchar(60)[]");
            e.HasAlternateKey(x => x.Nome).HasName("uq_material_nome");
            e.HasIndex(x => x.Nome).HasDatabaseName("ix_material_nome_trgm")
                .HasMethod("gin").HasOperators("gin_trgm_ops");
            e.HasOne(x => x.Categoria).WithMany(c => c.Materiais).HasForeignKey(x => x.CategoriaId);
        });

        mb.Entity<PontoDescarte>(e =>
        {
            e.ToTable("ponto_descarte", t => t.HasCheckConstraint(
                "ck_ponto_status", "status IN ('Pendente','Aprovado','Rejeitado','Inativo')"));
            e.Property(x => x.Nome).HasMaxLength(120);
            e.Property(x => x.Endereco).HasMaxLength(200);
            e.Property(x => x.Cidade).HasMaxLength(80);
            e.Property(x => x.Uf).HasColumnType("char(2)");
            e.Property(x => x.Cep).HasMaxLength(9);
            e.Property(x => x.Telefone).HasMaxLength(20);
            e.Property(x => x.Horario).HasMaxLength(120);
            e.Property(x => x.Localizacao).HasColumnType("geography(Point,4326)");
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(15);
            e.HasIndex(x => x.Localizacao).HasMethod("gist").HasDatabaseName("ix_ponto_localizacao");
            e.HasIndex(x => x.Status).HasDatabaseName("ix_ponto_status");
            e.HasOne(x => x.Parceiro).WithMany().HasForeignKey(x => x.ParceiroId);
            e.HasOne<Usuario>().WithMany().HasForeignKey(x => x.AprovadoPor);
        });

        mb.Entity<PontoMaterial>(e =>
        {
            e.ToTable("ponto_material");
            e.HasKey(x => new { x.PontoId, x.MaterialId });
            e.HasOne(x => x.Ponto).WithMany(p => p.Materiais).HasForeignKey(x => x.PontoId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Material).WithMany().HasForeignKey(x => x.MaterialId);
        });

        mb.Entity<Reporte>(e =>
        {
            e.ToTable("reporte", t =>
            {
                t.HasCheckConstraint("ck_reporte_motivo", "motivo IN ('Fechado','EnderecoErrado','NaoAceitaMaterial','Outro')");
                t.HasCheckConstraint("ck_reporte_status", "status IN ('Pendente','Resolvido','Descartado')");
            });
            e.Property(x => x.Motivo).HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(15);
            e.HasOne<PontoDescarte>().WithMany().HasForeignKey(x => x.PontoId).OnDelete(DeleteBehavior.Cascade);
        });

        mb.Entity<Identificacao>(e =>
        {
            e.ToTable("identificacao");
            e.Property(x => x.Confianca).HasPrecision(4, 3);
            e.HasOne<Material>().WithMany().HasForeignKey(x => x.MaterialSugeridoId);
            e.HasOne<Material>().WithMany().HasForeignKey(x => x.MaterialConfirmadoId);
        });

        mb.Entity<Busca>(e =>
        {
            e.ToTable("busca");
            e.HasOne<Material>().WithMany().HasForeignKey(x => x.MaterialId).OnDelete(DeleteBehavior.SetNull);
        });
    }
}
