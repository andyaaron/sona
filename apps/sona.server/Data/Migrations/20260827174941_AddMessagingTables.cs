using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace sona.server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMessagingTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MessageTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Body = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreateDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MessageTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MessagesOut",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PatientId = table.Column<int>(type: "int", nullable: false),
                    SentByUserId = table.Column<int>(type: "int", nullable: false),
                    Channel = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MessageTemplateId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Body = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MobileNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ProviderMessageSid = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    FailureReason = table.Column<string>(type: "nvarchar(max)", nullable: true),
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

            // Seed the single approved MVP template (fixed id — migrations must be deterministic)
            migrationBuilder.InsertData(
                table: "MessageTemplates",
                columns: new[] { "Id", "Key", "Body", "IsActive", "CreateDate", "ModDate" },
                values: new object[]
                {
                    new Guid("8f7f4b6a-0000-4000-8000-000000000001"),
                    "ready-to-be-seen",
                    "You're ready to be seen. Please come to the front desk.",
                    true,
                    new DateTime(2026, 8, 27, 0, 0, 0, DateTimeKind.Utc),
                    new DateTime(2026, 8, 27, 0, 0, 0, DateTimeKind.Utc),
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
                name: "IX_MessagesOut_SentByUserId",
                table: "MessagesOut",
                column: "SentByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_MessageTemplates_Key",
                table: "MessageTemplates",
                column: "Key",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MessagesOut");

            migrationBuilder.DropTable(
                name: "MessageTemplates");
        }
    }
}
