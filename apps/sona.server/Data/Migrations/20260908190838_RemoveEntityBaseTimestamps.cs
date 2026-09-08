using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace sona.server.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveEntityBaseTimestamps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreateDate",
                table: "UserDepartmentAccesses");

            migrationBuilder.DropColumn(
                name: "ModDate",
                table: "UserDepartmentAccesses");

            migrationBuilder.DropColumn(
                name: "CreateDate",
                table: "Sites");

            migrationBuilder.DropColumn(
                name: "ModDate",
                table: "Sites");

            migrationBuilder.DropColumn(
                name: "CreateDate",
                table: "Providers");

            migrationBuilder.DropColumn(
                name: "ModDate",
                table: "Providers");

            migrationBuilder.DropColumn(
                name: "CreateDate",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "ModDate",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "CreateDate",
                table: "MessageTemplates");

            migrationBuilder.DropColumn(
                name: "ModDate",
                table: "MessageTemplates");

            migrationBuilder.DropColumn(
                name: "CreateDate",
                table: "MessagesOut");

            // MessagesOut keeps a created timestamp (docs/data-model.md — this row is the
            // compliance audit record) but under a new name and semantics: it is stamped once
            // at construction, never updated, so it is dropped/re-added rather than renamed
            // from ModDate (which tracked last-modified, not created).
            migrationBuilder.DropColumn(
                name: "ModDate",
                table: "MessagesOut");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedDate",
                table: "MessagesOut",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "SYSUTCDATETIME()");

            migrationBuilder.DropColumn(
                name: "CreateDate",
                table: "Departments");

            migrationBuilder.DropColumn(
                name: "ModDate",
                table: "Departments");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedDate",
                table: "MessagesOut");

            migrationBuilder.AddColumn<DateTime>(
                name: "ModDate",
                table: "MessagesOut",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "CreateDate",
                table: "MessagesOut",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "CreateDate",
                table: "UserDepartmentAccesses",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "ModDate",
                table: "UserDepartmentAccesses",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "CreateDate",
                table: "Sites",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "ModDate",
                table: "Sites",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "CreateDate",
                table: "Providers",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "ModDate",
                table: "Providers",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "CreateDate",
                table: "Organizations",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "ModDate",
                table: "Organizations",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "CreateDate",
                table: "MessageTemplates",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "ModDate",
                table: "MessageTemplates",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "CreateDate",
                table: "Departments",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "ModDate",
                table: "Departments",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));
        }
    }
}
