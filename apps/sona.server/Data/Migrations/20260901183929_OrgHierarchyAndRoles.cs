using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace sona.server.Data.Migrations
{
    /// <inheritdoc />
    public partial class OrgHierarchyAndRoles : Migration
    {
        // Deterministic seed ids (docs/tasks/08 §8a step 4 — literal Guids, never Guid.NewGuid()).
        // Every pre-existing patient/provider/assigned-user is backfilled into this default org.
        private const string DefaultOrgId = "11111111-1111-1111-1111-111111111111";
        private const string MainSiteId = "22222222-2222-2222-2222-222222222222";
        private const string GeneralDepartmentId = "33333333-3333-3333-3333-333333333333";
        private static readonly DateTime SeedDate = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Organizations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreateDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Organizations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Sites",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreateDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Sites_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Departments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SiteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreateDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Departments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Departments_Sites_SiteId",
                        column: x => x.SiteId,
                        principalTable: "Sites",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "UserDepartmentAccesses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AppUserId = table.Column<int>(type: "int", nullable: false),
                    DepartmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreateDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserDepartmentAccesses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserDepartmentAccesses_AppUsers_AppUserId",
                        column: x => x.AppUserId,
                        principalTable: "AppUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserDepartmentAccesses_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // ---- Seed the default org chain (every org has ≥1 site and ≥1 department) ----
            migrationBuilder.InsertData(
                table: "Organizations",
                columns: new[] { "Id", "Name", "Type", "IsActive", "CreateDate", "ModDate" },
                values: new object[] { new Guid(DefaultOrgId), "Default Practice", "practice", true, SeedDate, SeedDate });

            migrationBuilder.InsertData(
                table: "Sites",
                columns: new[] { "Id", "OrganizationId", "Name", "IsActive", "CreateDate", "ModDate" },
                values: new object[] { new Guid(MainSiteId), new Guid(DefaultOrgId), "Main", true, SeedDate, SeedDate });

            migrationBuilder.InsertData(
                table: "Departments",
                columns: new[] { "Id", "SiteId", "Name", "IsActive", "CreateDate", "ModDate" },
                values: new object[] { new Guid(GeneralDepartmentId), new Guid(MainSiteId), "General", true, SeedDate, SeedDate });

            // ---- AppUsers: AccessLevelId → Role (+ org), then drop the old system ----
            migrationBuilder.AddColumn<string>(
                name: "Role",
                table: "AppUsers",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "unassigned");

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "AppUsers",
                type: "uniqueidentifier",
                nullable: true);

            // AccessLevelId 2 (Standard) → staff; everyone else stays unassigned (column default).
            // Assigned users are backfilled into the default org; unassigned keep a null org.
            migrationBuilder.Sql($"UPDATE [AppUsers] SET [Role] = 'staff' WHERE [AccessLevelId] = 2;");
            migrationBuilder.Sql($"UPDATE [AppUsers] SET [OrganizationId] = '{DefaultOrgId}' WHERE [Role] <> 'unassigned';");

            migrationBuilder.DropForeignKey(
                name: "FK_AppUsers_AccessLevels_AccessLevelId",
                table: "AppUsers");

            migrationBuilder.DropIndex(
                name: "IX_AppUsers_AccessLevelId",
                table: "AppUsers");

            migrationBuilder.DropColumn(
                name: "AccessLevelId",
                table: "AppUsers");

            migrationBuilder.DropTable(
                name: "AccessLevels");

            // ---- Patients: org FK backfill + MRN uniqueness becomes per-org ----
            migrationBuilder.DropIndex(
                name: "IX_Patients_Mrn",
                table: "Patients");

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "Patients",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.Sql($"UPDATE [Patients] SET [OrganizationId] = '{DefaultOrgId}';");

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "Patients",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            // ---- Providers: org FK backfill ----
            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "Providers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.Sql($"UPDATE [Providers] SET [OrganizationId] = '{DefaultOrgId}';");

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "Providers",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            // ---- MessagesOut: sender's department at send time (audit, nullable) ----
            migrationBuilder.AddColumn<Guid>(
                name: "DepartmentId",
                table: "MessagesOut",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Providers_OrganizationId",
                table: "Providers",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Patients_OrganizationId_Mrn",
                table: "Patients",
                columns: new[] { "OrganizationId", "Mrn" },
                unique: true,
                filter: "[IsActive] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_MessagesOut_DepartmentId",
                table: "MessagesOut",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_AppUsers_OrganizationId",
                table: "AppUsers",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Departments_SiteId",
                table: "Departments",
                column: "SiteId");

            migrationBuilder.CreateIndex(
                name: "IX_Sites_OrganizationId",
                table: "Sites",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_UserDepartmentAccesses_AppUserId_DepartmentId",
                table: "UserDepartmentAccesses",
                columns: new[] { "AppUserId", "DepartmentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserDepartmentAccesses_DepartmentId",
                table: "UserDepartmentAccesses",
                column: "DepartmentId");

            migrationBuilder.AddForeignKey(
                name: "FK_AppUsers_Organizations_OrganizationId",
                table: "AppUsers",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_MessagesOut_Departments_DepartmentId",
                table: "MessagesOut",
                column: "DepartmentId",
                principalTable: "Departments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Patients_Organizations_OrganizationId",
                table: "Patients",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Providers_Organizations_OrganizationId",
                table: "Providers",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AppUsers_Organizations_OrganizationId",
                table: "AppUsers");

            migrationBuilder.DropForeignKey(
                name: "FK_MessagesOut_Departments_DepartmentId",
                table: "MessagesOut");

            migrationBuilder.DropForeignKey(
                name: "FK_Patients_Organizations_OrganizationId",
                table: "Patients");

            migrationBuilder.DropForeignKey(
                name: "FK_Providers_Organizations_OrganizationId",
                table: "Providers");

            migrationBuilder.DropTable(
                name: "UserDepartmentAccesses");

            migrationBuilder.DropTable(
                name: "Departments");

            migrationBuilder.DropTable(
                name: "Sites");

            migrationBuilder.DropTable(
                name: "Organizations");

            migrationBuilder.DropIndex(
                name: "IX_Providers_OrganizationId",
                table: "Providers");

            migrationBuilder.DropIndex(
                name: "IX_Patients_OrganizationId_Mrn",
                table: "Patients");

            migrationBuilder.DropIndex(
                name: "IX_MessagesOut_DepartmentId",
                table: "MessagesOut");

            migrationBuilder.DropIndex(
                name: "IX_AppUsers_OrganizationId",
                table: "AppUsers");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Providers");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                table: "MessagesOut");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "AppUsers");

            migrationBuilder.DropColumn(
                name: "Role",
                table: "AppUsers");

            migrationBuilder.AddColumn<int>(
                name: "AccessLevelId",
                table: "AppUsers",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AccessLevels",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LevelName = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccessLevels", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Patients_Mrn",
                table: "Patients",
                column: "Mrn",
                unique: true,
                filter: "\"IsActive\" = 1");

            migrationBuilder.CreateIndex(
                name: "IX_AppUsers_AccessLevelId",
                table: "AppUsers",
                column: "AccessLevelId");

            migrationBuilder.AddForeignKey(
                name: "FK_AppUsers_AccessLevels_AccessLevelId",
                table: "AppUsers",
                column: "AccessLevelId",
                principalTable: "AccessLevels",
                principalColumn: "Id");
        }
    }
}
