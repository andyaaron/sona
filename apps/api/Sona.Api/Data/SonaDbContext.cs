using Microsoft.EntityFrameworkCore;
using Sona.Api.Features.Messaging;
using Sona.Api.Features.Users;

namespace Sona.Api.Data;

public class SonaDbContext(DbContextOptions<SonaDbContext> options) : DbContext(options)
{
    public DbSet<MessageTemplate> MessageTemplates => Set<MessageTemplate>();

    public DbSet<AppUser> AppUsers => Set<AppUser>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SonaDbContext).Assembly);
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        StampAuditDates();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default)
    {
        StampAuditDates();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void StampAuditDates()
    {
        var utcNow = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<EntityBase>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreateDate = utcNow;
                    entry.Entity.ModDate = utcNow;
                    break;
                case EntityState.Modified:
                    entry.Entity.ModDate = utcNow;
                    break;
            }
        }
    }
}
