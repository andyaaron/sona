using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sona.Api.Features.Imports;
using Sona.Api.Features.Patients;

namespace Sona.Api.Data.Configurations;

public class PatientConfiguration : IEntityTypeConfiguration<Patient>
{
    public void Configure(EntityTypeBuilder<Patient> builder)
    {
        builder.ToTable("Patients");

        builder.Property(p => p.Mrn).HasMaxLength(50);
        builder.HasIndex(p => p.Mrn).IsUnique();

        builder.Property(p => p.FirstName).HasMaxLength(100);
        builder.Property(p => p.LastName).HasMaxLength(100);

        // E.164 max length is 15 digits + leading '+'
        builder.Property(p => p.MobileNumber).HasMaxLength(16);

        builder.Property(p => p.ImportSource).HasMaxLength(20);

        builder.HasOne<ImportBatch>()
            .WithMany()
            .HasForeignKey(p => p.ImportBatchId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
