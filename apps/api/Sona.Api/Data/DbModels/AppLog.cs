using System.ComponentModel.DataAnnotations;

namespace Sona.Api.Data.DbModels
{
    public class AppLog: EntityBase
    {
        public string? Message { get; set; }
        public string? MessageTemplate { get; set; }
        public string? Level { get; set; }
        public DateTime? TimeStamp { get; set; }
        public string? Exception { get; set; }
        public string? Properties { get; set; }

    }
}
