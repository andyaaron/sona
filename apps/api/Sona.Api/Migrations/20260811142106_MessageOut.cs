using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sona.Api.Migrations
{
    /// <inheritdoc />
    public partial class MessageOut : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MessagesOut",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PatientId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SentByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Channel = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    MessageTemplateId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Body = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    MobileNumber = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ProviderMessageSid = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    FailureReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SentDateTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeliveredDateTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreateDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MessagesOut", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MessagesOut_AppUsers_SentByUserId",
                        column: x => x.SentByUserId,
                        principalTable: "AppUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MessagesOut_MessageTemplates_MessageTemplateId",
                        column: x => x.MessageTemplateId,
                        principalTable: "MessageTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MessagesOut_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MessagesOut_MessageTemplateId",
                table: "MessagesOut",
                column: "MessageTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_MessagesOut_PatientId",
                table: "MessagesOut",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_MessagesOut_ProviderMessageSid",
                table: "MessagesOut",
                column: "ProviderMessageSid");

            migrationBuilder.CreateIndex(
                name: "IX_MessagesOut_SentByUserId",
                table: "MessagesOut",
                column: "SentByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_MessagesOut_Status_CreateDate",
                table: "MessagesOut",
                columns: new[] { "Status", "CreateDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MessagesOut");
        }
    }
}
