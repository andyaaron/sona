using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sona.Api.Features.Messaging;

namespace Sona.Api.Data.Configurations;

public class MessageOutConfiguration : IEntityTypeConfiguration<MessageOut>
{
    public void Configure(EntityTypeBuilder<MessageOut> builder)
    {
        builder.ToTable("MessagesOut");

        // Audit rows must never cascade-delete.
        builder.HasOne(m => m.Patient)
            .WithMany()
            .HasForeignKey(m => m.PatientId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(m => m.SentByUser)
            .WithMany()
            .HasForeignKey(m => m.SentByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(m => m.MessageTemplate)
            .WithMany()
            .HasForeignKey(m => m.MessageTemplateId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(m => m.Channel).HasMaxLength(10);
        builder.Property(m => m.Status).HasMaxLength(20);
        builder.Property(m => m.Body).HasMaxLength(1000);
        builder.Property(m => m.MobileNumber).HasMaxLength(16);
        builder.Property(m => m.ProviderMessageSid).HasMaxLength(100);
        builder.Property(m => m.FailureReason).HasMaxLength(500);

        builder.HasIndex(m => m.PatientId);
        builder.HasIndex(m => m.ProviderMessageSid);
        // The "what's pending/failed" operational query.
        builder.HasIndex(m => new { m.Status, m.CreateDate });
    }
}
