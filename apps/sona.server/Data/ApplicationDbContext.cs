using Microsoft.EntityFrameworkCore;
using Sona.Server.Data.DbModels;

namespace Sona.Server.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
               
        }

        public DbSet<AppLog> AppLogs { get; set; }
        // public DbSet<MessageTemplate> MessageTemplates => Set<MessageTemplate>();
        public virtual DbSet<AccessLevel> AccessLevels { get; set; }
        public virtual DbSet<AppUser> AppUsers { get; set; }
        public virtual DbSet<Patient> Patients { get; set; }
        public virtual DbSet<Provider> Providers { get; set; }
        // public DbSet<MessageOut> MessagesOut => Set<MessageOut>();
        // public DbSet<ImportBatch> ImportBatches => Set<ImportBatch>();
        // public DbSet<ImportRowError> ImportRowErrors => Set<ImportRowError>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Enforce unique MRN among active patients at the database level
            modelBuilder.Entity<Patient>()
                .HasIndex(p => p.Mrn)
                .HasFilter("\"IsActive\" = 1")
                .IsUnique();

            // Provider: unique NPI when present (filtered index)
            modelBuilder.Entity<Provider>()
                .HasIndex(p => p.Npi)
                .HasFilter("[Npi] IS NOT NULL")
                .IsUnique();

            // Patient → Provider: restrict delete (cannot remove provider with assigned patients)
            modelBuilder.Entity<Patient>()
                .HasOne(p => p.PrimaryProvider)
                .WithMany()
                .HasForeignKey(p => p.PrimaryProviderId)
                .OnDelete(DeleteBehavior.Restrict);

            // Provider → AppUser FK
            modelBuilder.Entity<Provider>()
                .HasOne(p => p.AppUser)
                .WithMany()
                .HasForeignKey(p => p.AppUserId)
                .OnDelete(DeleteBehavior.SetNull);
        }

        public override int SaveChanges(bool acceptAllChangesOnSuccess)
        {
            StampEntityBaseTimestamps();
            return base.SaveChanges(acceptAllChangesOnSuccess);
        }

        public override Task<int> SaveChangesAsync(
            bool acceptAllChangesOnSuccess,
            CancellationToken cancellationToken = default)
        {
            StampEntityBaseTimestamps();
            return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        }

        private void StampEntityBaseTimestamps()
        {
            var now = DateTime.UtcNow;
            foreach (var entry in ChangeTracker.Entries<EntityBase>())
            {
                if (entry.State == EntityState.Added)
                {
                    entry.Entity.CreateDate = now;
                    entry.Entity.ModDate = now;
                }
                else if (entry.State == EntityState.Modified)
                {
                    entry.Entity.ModDate = now;
                }
            }
        }
    }
}
