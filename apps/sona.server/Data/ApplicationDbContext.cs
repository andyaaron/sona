using GAIT.Data.DbTables;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Sona.Server.Data.DbModels;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text;
using Sona.Server.Models.Attributes;


namespace Sona.Server.Data
{
    public class ApplicationDbContext : DbContext
    {

        private readonly IHttpContextAccessor _contextAccessor;


        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options, IHttpContextAccessor httpcontext) 
            : base(options)
        {
            _contextAccessor = httpcontext;
        }

        public DbSet<AppLog> AppLogs { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }
        public virtual DbSet<MessageTemplate> MessageTemplates { get; set; }
        public virtual DbSet<AppUser> AppUsers { get; set; }
        public virtual DbSet<Organization> Organizations { get; set; }
        public virtual DbSet<Site> Sites { get; set; }
        public virtual DbSet<Department> Departments { get; set; }
        public virtual DbSet<UserDepartmentAccess> UserDepartmentAccesses { get; set; }
        public virtual DbSet<Patient> Patients { get; set; }
        public virtual DbSet<Provider> Providers { get; set; }
        public virtual DbSet<MessageOut> MessagesOut { get; set; }
        public IHttpContextAccessor Httpcontext { get; }
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

            modelBuilder.Entity<MessageOut>()
                .Property(m => m.OpiePatientId)
                .HasMaxLength(50);

            modelBuilder.Entity<MessageOut>()
                .HasIndex(m => m.OpiePatientId);
        }

        //public override int SaveChanges(bool acceptAllChangesOnSuccess)
        //{
        //    StampEntityBaseTimestamps();
        //    return base.SaveChanges(acceptAllChangesOnSuccess);
        //}


        //Aaron will add this StampEntityBaseTimestamps(); piece back into the lower area - FJC 9/4/26
        //public override Task<int> SaveChangesAsync(
        //    bool acceptAllChangesOnSuccess,
        //    CancellationToken cancellationToken = default)
        //{
        //    StampEntityBaseTimestamps();
        //    return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        //}

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

        //Everything below this is FormatException audit logs

        public override int SaveChanges()
        {
            return SaveChanges(acceptAllChangesOnSuccess: true);
        }

        public override int SaveChanges(bool acceptAllChangesOnSuccess)
        {
            StampEntityBaseTimestamps();


            var auditEntries = OnBeforeSaveChanges();
            ChangeTracker.AutoDetectChangesEnabled = false; // disable auto detection

            var auditLogs = OnAfterSaveChanges(auditEntries);
            AuditLogs.AddRange(auditLogs);
            try
            {
                var result = base.SaveChanges(acceptAllChangesOnSuccess: false);

                if (acceptAllChangesOnSuccess)
                {
                    ChangeTracker.AcceptAllChanges(); // manually accept all changes
                }
                return result;
            }
            finally
            {
                ChangeTracker.AutoDetectChangesEnabled = true;  // re-enable auto detection
            }
        }

        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return await SaveChangesAsync(true, cancellationToken);
        }

        public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
        {
            var auditEntries = OnBeforeSaveChanges();
            ChangeTracker.AutoDetectChangesEnabled = false;

            var auditLogs = OnAfterSaveChanges(auditEntries);
            AuditLogs.AddRange(auditLogs);
            try
            {
                var result = await base.SaveChangesAsync(acceptAllChangesOnSuccess: false, cancellationToken);

                if (acceptAllChangesOnSuccess)
                {

                    ChangeTracker.AcceptAllChanges();
                }

                return result;
            }
            finally
            {
                ChangeTracker.AutoDetectChangesEnabled = true;
            }
        }

        private string GetCurrentUserId()
        {
            try
            {
                return _contextAccessor.HttpContext.User.Identity.Name ?? "USER N/A";
            }
            catch
            {
                return "USER N/A";
            }

        }

        private List<AuditEntry> OnBeforeSaveChanges()
        {
            var entries = ChangeTracker.Entries().ToList();
            var auditEntries = new List<AuditEntry>();

            foreach (var entry in entries)
            {
                // Skip if no auditing needed
                if (entry.Entity is AuditLog ||
                    entry.State == EntityState.Detached ||
                    entry.State == EntityState.Unchanged ||
                    !entry.Entity.GetType().GetCustomAttributes(typeof(AuditableAttribute), true).Any())
                {
                    continue;
                }
                var auditEntry = new AuditEntry(entry)
                {
                    EntityName = entry.Entity.GetType().Name,
                    ChangeIdByUserId = GetCurrentUserId()
                };

                // retrieve primary key
                var pkProperty = entry.Properties.FirstOrDefault(p => p.Metadata.IsPrimaryKey());
                if (pkProperty != null && pkProperty.CurrentValue != null)
                {
                    auditEntry.PrimaryKey = pkProperty.CurrentValue.ToString();
                }

                // If it's a Modify, capture property-level changes
                if (entry.State == EntityState.Modified)
                {
                    auditEntry.Action = "Update";

                    // For each modified property, store old/new if they differ
                    foreach (var property in entry.Properties)
                    {
                        // Skip unmapped
                        var propInfo = entry.Entity.GetType().GetProperty(property.Metadata.Name);
                        if (propInfo != null &&
                            propInfo.GetCustomAttributes(typeof(NotMappedAttribute), true).Any())
                        {
                            continue;
                        }

                        // Only log if EF actually marked it as modified
                        if (property.IsModified)
                        {
                            var originalVal = property.OriginalValue?.ToString() ?? "";
                            var currentVal = property.CurrentValue?.ToString() ?? "";

                            // Also ensure there's a real difference
                            if (!Equals(property.OriginalValue, property.CurrentValue))
                            {
                                // Create a separate record per changed field
                                var fieldAudit = new AuditEntry(entry)
                                {
                                    Action = "Update",
                                    EntityName = auditEntry.EntityName,
                                    PrimaryKey = auditEntry.PrimaryKey,
                                    ChangeIdByUserId = auditEntry.ChangeIdByUserId,
                                    PropertyName = property.Metadata.Name,
                                    OldValue = originalVal,
                                    NewValue = currentVal
                                };
                                if (fieldAudit.PropertyName != "ModDate")
                                {
                                    if (fieldAudit.OldValue != fieldAudit.NewValue)
                                    {
                                        auditEntries.Add(fieldAudit.Copy());
                                    }
                                }

                            }
                        }
                    }
                }
                else if (entry.State == EntityState.Added)
                {
                    // TODO: Audit new records added
                }
                else if (entry.State == EntityState.Deleted)
                {
                    auditEntry.Action = "Deleted";
                    var sb = new StringBuilder();
                    foreach (var property in entry.Properties)
                    {
                        // Skip unmapped
                        var propInfo = entry.Entity.GetType().GetProperty(property.Metadata.Name);
                        if (propInfo != null &&
                            propInfo.GetCustomAttributes(typeof(NotMappedAttribute), true).Any())
                        {
                            continue;
                        }
                        sb.Append(auditEntry.EntityName + " [").Append($"{property.OriginalValue?.ToString() ?? ""}").Append("] ");
                    }
                    auditEntry.OldValue = sb.ToString();
                    auditEntries.Add(auditEntry.Copy());
                }
            }
            return auditEntries;
        }


        private List<AuditLog> OnAfterSaveChanges(List<AuditEntry> auditEntries)
        {
            var auditLogs = new List<AuditLog>();
            if (auditEntries == null || auditEntries.Count == 0)
                return auditLogs;


            foreach (var auditEntry in auditEntries)
            {
                // add to db

                auditLogs.Add(new AuditLog
                {
                    EntityName = auditEntry.EntityName,
                    PrimaryKey = auditEntry.PrimaryKey,
                    PropertyName = auditEntry.PropertyName,
                    OldValue = auditEntry.OldValue,
                    NewValue = auditEntry.NewValue,
                    ChangedDate = DateTime.Now,
                    ChangeIdByUserId = auditEntry.ChangeIdByUserId,
                    Action = auditEntry.Action,
                });
            }
            return auditLogs;
        }

        // private helper class
        private class AuditEntry
        {
            public AuditEntry(EntityEntry entry)
            {
                Entry = entry;
            }

            public EntityEntry Entry { get; }
            public string EntityName { get; set; }
            public string PrimaryKey { get; set; }
            public string PropertyName { get; set; }
            public string OldValue { get; set; }
            public string NewValue { get; set; }
            public string ChangeIdByUserId { get; set; }
            public string Action { get; set; }

            // method to create a copy of the auditentry
            public AuditEntry Copy()
            {
                return new AuditEntry(this.Entry)
                {
                    EntityName = this.EntityName,
                    PrimaryKey = this.PrimaryKey,
                    PropertyName = this.PropertyName,
                    OldValue = this.OldValue,
                    NewValue = this.NewValue,
                    ChangeIdByUserId = this.ChangeIdByUserId,
                    Action = this.Action,
                };
            }

        }



    }
}
