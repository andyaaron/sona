using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace sona.server.Data.Migrations
{
    /// <inheritdoc />
    public partial class OpieNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "PatientId",
                table: "MessagesOut",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<string>(
                name: "OpiePatientId",
                table: "MessagesOut",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "SmsConsentAttested",
                table: "MessagesOut",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_MessagesOut_OpiePatientId",
                table: "MessagesOut",
                column: "OpiePatientId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MessagesOut_OpiePatientId",
                table: "MessagesOut");

            migrationBuilder.DropColumn(
                name: "OpiePatientId",
                table: "MessagesOut");

            migrationBuilder.DropColumn(
                name: "SmsConsentAttested",
                table: "MessagesOut");

            migrationBuilder.AlterColumn<int>(
                name: "PatientId",
                table: "MessagesOut",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);
        }
    }
}
