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
        // public DbSet<MessageOut> MessagesOut => Set<MessageOut>();
        // public DbSet<ImportBatch> ImportBatches => Set<ImportBatch>();
        // public DbSet<ImportRowError> ImportRowErrors => Set<ImportRowError>();

        // protected override void OnModelCreating(ModelBuilder modelBuilder)
        // {
        //     // do something here..
        // }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Enforce unique MRN among active patients at the database level
            modelBuilder.Entity<Patient>()
                .HasIndex(p => p.Mrn)
                .HasFilter("\"IsActive\" = 1")
                .IsUnique();
        }

        public override int SaveChanges(bool acceptAllChangesOnSuccess)
        {
            // @TODO: Insert audit logging
            return base.SaveChanges(acceptAllChangesOnSuccess);
        }

        public override Task<int> SaveChangesAsync(
            bool acceptAllChangesOnSuccess,
            CancellationToken cancellationToken = default)
        {
            // @TODO: Insert audit logging
            return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        }
    }
}
