namespace Sona.Server.Data;

/// <summary>
/// Base for all persisted entities: UUID v7 primary key (time-ordered, avoids
/// index fragmentation on SQL Server uniqueidentifier PKs) plus UTC audit
/// timestamps stamped by <see cref="ApplicationDbContext"/> on save.
/// </summary>
public abstract class EntityBase
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public DateTime CreateDate { get; set; }

    public DateTime ModDate { get; set; }
}
