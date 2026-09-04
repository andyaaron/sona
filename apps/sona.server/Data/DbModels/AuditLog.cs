namespace GAIT.Data.DbTables
{
    public class AuditLog
    {
        public long Id { get; set; }
        public string? EntityName { get; set; }
        public string? PrimaryKey { get; set; }  // provide flexibility to store apla-numeric keys
        public string? PropertyName { get; set; } 
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
        public DateTime ChangedDate { get;set; }
        public string? ChangeIdByUserId { get; set; }
        public string? Action { get; set; } // Update, Insert, "Delete"
    }
}
