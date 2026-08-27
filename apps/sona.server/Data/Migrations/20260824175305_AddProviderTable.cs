using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sona.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProviderTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PrimaryProviderId",
                table: "Patients",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Providers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FirstName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Credentials = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Npi = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    Specialty = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    AppUserId = table.Column<int>(type: "int", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreateDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Providers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Providers_AppUsers_AppUserId",
                        column: x => x.AppUserId,
                        principalTable: "AppUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Patients_PrimaryProviderId",
                table: "Patients",
                column: "PrimaryProviderId");

            migrationBuilder.CreateIndex(
                name: "IX_Providers_AppUserId",
                table: "Providers",
                column: "AppUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Providers_Npi",
                table: "Providers",
                column: "Npi",
                unique: true,
                filter: "[Npi] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_Patients_Providers_PrimaryProviderId",
                table: "Patients",
                column: "PrimaryProviderId",
                principalTable: "Providers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Patients_Providers_PrimaryProviderId",
                table: "Patients");

            migrationBuilder.DropTable(
                name: "Providers");

            migrationBuilder.DropIndex(
                name: "IX_Patients_PrimaryProviderId",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "PrimaryProviderId",
                table: "Patients");
        }
    }
}
