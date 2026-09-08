namespace Sona.Server.Data;

/// <summary>
/// Base for all persisted entities: UUID v7 primary key (time-ordered, avoids
/// index fragmentation on SQL Server uniqueidentifier PKs). Change tracking
/// (who changed what, when) is handled by the <c>[Auditable]</c>-driven audit
/// log in <see cref="ApplicationDbContext"/>, not by per-row timestamps here.
/// </summary>
public abstract class EntityBase
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
}
