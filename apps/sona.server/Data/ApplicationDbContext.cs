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
        public virtual DbSet<MessageTemplate> MessageTemplates { get; set; }
        public virtual DbSet<AppUser> AppUsers { get; set; }
        public virtual DbSet<Organization> Organizations { get; set; }
        public virtual DbSet<Site> Sites { get; set; }
        public virtual DbSet<Department> Departments { get; set; }
        public virtual DbSet<UserDepartmentAccess> UserDepartmentAccesses { get; set; }
        public virtual DbSet<Patient> Patients { get; set; }
        public virtual DbSet<Provider> Providers { get; set; }
        public virtual DbSet<MessageOut> MessagesOut { get; set; }
        // public DbSet<ImportBatch> ImportBatches => Set<ImportBatch>();
        // public DbSet<ImportRowError> ImportRowErrors => Set<ImportRowError>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // MRN is unique per organization (not globally — MRN schemes can
            // collide across orgs), still filtered to active patients.
            modelBuilder.Entity<Patient>()
                .HasIndex(p => new { p.OrganizationId, p.Mrn })
                .HasFilter("[IsActive] = 1")
                .IsUnique();

            // Org hierarchy: Organization → Site → Department (fixed 3 levels)
            modelBuilder.Entity<Site>()
                .HasOne(s => s.Organization)
                .WithMany(o => o.Sites)
                .HasForeignKey(s => s.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Department>()
                .HasOne(d => d.Site)
                .WithMany(s => s.Departments)
                .HasForeignKey(d => d.SiteId)
                .OnDelete(DeleteBehavior.Restrict);

            // Staff department scoping — access rows go when either side goes
            modelBuilder.Entity<UserDepartmentAccess>()
                .HasIndex(a => new { a.AppUserId, a.DepartmentId })
                .IsUnique();

            modelBuilder.Entity<UserDepartmentAccess>()
                .HasOne(a => a.AppUser)
                .WithMany(u => u.DepartmentAccess)
                .HasForeignKey(a => a.AppUserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserDepartmentAccess>()
                .HasOne(a => a.Department)
                .WithMany()
                .HasForeignKey(a => a.DepartmentId)
                .OnDelete(DeleteBehavior.Cascade);

            // Tenant FKs — restrict: an org with data cannot be removed
            modelBuilder.Entity<AppUser>()
                .HasOne(u => u.Organization)
                .WithMany()
                .HasForeignKey(u => u.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Patient>()
                .HasOne(p => p.Organization)
                .WithMany()
                .HasForeignKey(p => p.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Provider>()
                .HasOne(p => p.Organization)
                .WithMany()
                .HasForeignKey(p => p.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict);

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

            // MessageTemplate: send paths look templates up by key
            modelBuilder.Entity<MessageTemplate>()
                .HasIndex(t => t.Key)
                .IsUnique();

            // MessageOut is the send audit log — rows must survive their references,
            // so both FKs restrict deletes (patients and users are soft-deleted anyway)
            modelBuilder.Entity<MessageOut>()
                .HasOne(m => m.Patient)
                .WithMany()
                .HasForeignKey(m => m.PatientId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<MessageOut>()
                .HasOne(m => m.SentByUser)
                .WithMany()
                .HasForeignKey(m => m.SentByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<MessageOut>()
                .HasOne(m => m.MessageTemplate)
                .WithMany()
                .HasForeignKey(m => m.MessageTemplateId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<MessageOut>()
                .HasOne(m => m.Department)
                .WithMany()
                .HasForeignKey(m => m.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<MessageOut>()
                .HasIndex(m => m.PatientId);
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
