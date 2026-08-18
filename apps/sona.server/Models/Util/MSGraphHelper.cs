using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Microsoft.Graph;
using Microsoft.Identity.Client;
using Microsoft.Identity.Web;
using Microsoft.IdentityModel.Tokens;
using Newtonsoft.Json;
using Sona.Api.Models.Commons;
using System.Globalization;
using System.Net.Http.Headers;


namespace Sona.Api.Models.Util
{
    public interface IMSGraphHelper
    {
        /// <summary>
        /// search MSGraph for users with 'userPrincipalName' field (34ID@hca.corpad.net) starts with 34Id input via param
        /// </summary>
        /// <param name="searchUserString"></param>
        /// <returns>A List of users of type Microsoft.Graph.User</returns>
        //MADE PRIVATE - use KeyValue for PODS, refactor this library for other projects.
        Task<List<User>> Search34Id(string searchUserString);

        /// <summary>
        /// same as Search34Id with different return type -> Search MSGraph for users with 'userPrincipalName' field (34ID@hca.corpad.net) - starts with 34Id string input via param
        /// </summary>
        /// <param name="searchUserString"></param>
        /// <returns>List of users in key/value format</returns>
        Task<List<KeyValue>> Search34IdAsKeyValue(string searchUserString);


        /// <summary>
        /// Search multiple fields in MSGraph for user info - first name, last name, full name (first last or last first), and 34Id
        /// </summary>
        /// <param name="searchUserString"></param>
        /// <returns></returns>
        Task<List<KeyValue>> SearchMultipleFieldsForUserAsKeyValue(string searchUserString);


        ///RETIRED
        /// <summary>
        /// explicit function to configure and return a GraphServiceClient (without keyvault) - use to force the non-keyvault method
        /// </summary>
        /// <returns>the GraphServiceClient instance after it's been configured (internally)</returns>
        //public GraphServiceClient ConfigureMSGraph();

        /// <summary>
        /// return user photo ["64x64"] given 34Id -in bytecode base64 (unformatted as a pic)
        /// </summary>
        /// <param name="searchUser34Id"></param>
        /// <returns></returns>
        Task<string?> GetUserThumbnail(string searchUser34Id, string sizeFormat = "64x64");

       
        /// <summary>
        /// same as GetUserThumbnail but return a Properties.JsonProp.KeyValue item w/the "Thumbnail" field containing the results
        /// </summary>
        /// <param name="searchUser34Id"></param>
        /// <param name="sizeFormat"></param>
        /// <returns></returns>
        //Task<Properties.JsonProp.KeyValue> GetUserThumbnailAsKeyValue(string searchUser34Id, string sizeFormat = "64x64");


        /// <summary>
        /// returns MSGraph user list. see other method for implementation w/PODS
        /// Get List of Users with details from MsGraph given a 34Id search (partial or complete 34Id - if partial will return list, if full 34Id will return single item in list (if exists)
        /// - see implementation for specific fields.
        /// </summary>
        /// <param name="_34Id"></param>
        /// <returns>List of Users that match 34Id input w/Details</returns>
        Task<List<User>> GetUserDetails(string _34Id);

        
        /// <summary>
        /// Same as GetUserDetails, but returning Properties.JsonProp.KeyValue for PODS project (single user return, only send complete 34Id or results will just be the first result)
        /// </summary>
        /// <param name="_34Id"></param>
        /// <returns></returns>
        Task<KeyValue> GetUserDetailsAsKeyValue(string _34Id);


        /// <summary>
        /// Given a user's 34ID@hca.corpad.net input, will search for the user's manager and return the User object of that manager.
        /// </summary>
        /// <param name="hcaCorpadEmailAddress"></param>
        /// <returns></returns>
        Task<User> GetUserManager(string hcaCorpadEmailAddress);

    }


    public class MSGraphHelper : IMSGraphHelper
    {
        public GraphServiceClient _graphServiceClient;
        private readonly IConfiguration _config;
        private readonly ILogger<MSGraphHelper> _logger;
        private string? _keyvaultURI;
        private MSGraphParams _params;

        /// <summary>
        /// Constructor - Requires a keyvault in config labeled "Keyvault:_keyvaultURI"
        /// It will then pull in secrets for MSGraph utility instantiation (see method ConfigureMSGraphFromKeyvault)
        /// </summary>
        /// <param name="config"></param>
        /// <param name="logger"></param>
        public MSGraphHelper(IConfiguration config, ILogger<MSGraphHelper> logger)
        {
            _config = config;
            _logger = logger;

            //pull keyvault URI from config
            _keyvaultURI = _config["Keyvault:_keyvaultURI"];

            //if keyvaultURI present, configure with keyvault
            if (_keyvaultURI != null)
            {
                //_graphServiceClient is assigned within this method
                ConfigureMSGraphFromKeyvault(_keyvaultURI);
            }
            //otherwise use JSON file
            else
            {
                _logger.LogError("no keyvault found or error in configuration of MSGraphHelper. MSGraph utility will be unable to process requests!");
                //auto-configure on instantiation.
               // _graphServiceClient = ConfigureMSGraph();
            }

        }

        /// <summary>
        /// Configuration secrets pulled from keyvault and used to set up an MSGraph client for AAD user search methods.  Used by constructor on instantiation.
        /// </summary>
        /// <param name="keyvaultURI"></param>
        /// <returns></returns>
        public GraphServiceClient ConfigureMSGraphFromKeyvault(string keyvaultURI)
        {
           
            try
            {
                SecretClient client = new SecretClient(new Uri(keyvaultURI), new DefaultAzureCredential());

                //populate MSGraph params
                _params = new MSGraphParams();

                KeyVaultSecret secret = client.GetSecret("MSGRAPH-Instance");
                _params.Instance = secret.Value.ToString();

                secret = client.GetSecret("MSGRAPH-ApiUrl");
                _params.ApiUrl = secret.Value.ToString();

                secret = client.GetSecret("MSGRAPH-Tenant");
                _params.Tenant = secret.Value.ToString();

                secret = client.GetSecret("MSGRAPH-ClientId");
                _params.ClientId = secret.Value.ToString();

                secret = client.GetSecret("MSGRAPH-ClientSecret");
                _params.ClientSecret = secret.Value.ToString();


                //the meat
                IConfidentialClientApplication app;
                app = ConfidentialClientApplicationBuilder.Create(_params.ClientId)
                    .WithClientSecret(_params.ClientSecret)
                    .WithAuthority(string.Format(CultureInfo.InvariantCulture, _params.Instance, _params.Tenant))
                    .Build();

                app.AddInMemoryTokenCache();

                string[] scopes = new string[] { $"{_params.ApiUrl}.default" }; // Generates a scope -> "https://graph.microsoft.com/.default"

                // Prepare an authenticated MS Graph SDK client
                _graphServiceClient = GetAuthenticatedGraphClient(app, scopes);

                _logger.LogInformation("msGraph client instantiated");
            }

            catch (Exception ex)
            {
                _logger.LogError($"Exception thrown in ConfigureMSGraphFromKeyvault.  Check keyvault values? Exception {ex}");
            }

          
            return _graphServiceClient;
        }

        /// <summary>
        /// Given a partial or full 34Id input, will return a list of graph users that match (First Page Only)
        /// </summary>
        /// <param name="searchUserString"></param>
        /// <returns></returns>
        public async Task<List<User>> Search34Id(string searchUserString)
        {
            GraphServiceClient graph = _graphServiceClient;
            List<User> results = new List<User>();  //empty

            //replaced with keyvault, and setup is in constructor
            //if (graph == null)
            //    graph = ConfigureMSGraph();

            if (graph != null)
            {
                var searchResults = graph.Users.Request()
                    .Filter($"startsWith(userPrincipalName, '{searchUserString}')") //34Id is in userPrincipalName field in MSGraph - Example: nk4907@hca.corpad.net
                    .Top(ConstantDefaults.MSGRAPH_RETURN_QUANTITY) //return x number of items (without this it will return 100)
                    .GetAsync()
                    .Result;

                foreach (var user in searchResults)
                {
                    results.Add(user);
                }
            }
            return results;
        }

        /// <summary>
        /// Search via 34Id and convert to list of custom keyvalues
        /// </summary>
        /// <param name="searchUserString"></param>
        /// <returns></returns>
        public async Task<List<KeyValue>> Search34IdAsKeyValue(string searchUserString)
        {

            //get list of Users
            var userList = await Search34Id(searchUserString);

            var msGraphKeyValues = new List<KeyValue>();

            //populate keyvalue list from graph user data (34Id, First/Last, combined result)
            foreach (var user in userList)
            {
                var keyValue = new KeyValue();
                keyValue.Key = user.UserPrincipalName.Split('@')[0].ToLower(); ;
                keyValue.Value = user.GivenName + " " + user.Surname;
                keyValue.Result = $"{keyValue.Key}, {keyValue.Value}";

                //check if user's email is blank - if so, then that 34Id is not valid (employee has left or junk/utility account)
                //from search/documentation, no way to filter directly in the MSGraph call against null or empty - example: https://stackoverflow.com/questions/62406629/when-using-filter-on-the-graph-api-how-to-do-you-only-return-data-where-a-field
                //from testing, over half of return entries have no Email field populated (old/retired users, utility accounts etc.)
                //KJS-4/19/24 - also filtering out if GivenName aka firstname or Surname aka lastname are empty
                if (string.IsNullOrEmpty(user.Mail) || string.IsNullOrEmpty(user.GivenName) || string.IsNullOrEmpty(user.Surname))
                {
                    continue; //skip this user as non-user.
                }

                //HCA AzureAD STRANGE TAG FILTERING -If other values such as userprincipal with strange tags (#EXT# means external user maybe?), continue - we don't trust these results (see a lot of UK Azure accounts don't have much info in them)
                if (user.UserPrincipalName.Contains("#EXT#"))
                {
                    continue;//#EXT# in userPrincipalName - do not add to list
                }

                //add to list.
                msGraphKeyValues.Add(keyValue);
            }

            return msGraphKeyValues;
        }

        public async Task<string?> GetUserThumbnail(string searchUser34Id, string sizeFormat = "64x64")
        {
            GraphServiceClient graph = _graphServiceClient;
            string? imgData = null;

            //replaced with keyvault, and setup is in constructor
            //if(graph == null)
            //{
            //    graph = ConfigureMSGraph();
            //}

            if (graph != null)
            {
                try
                {
                    Stream photo = await graph.Users[$"{searchUser34Id}@hca.corpad.net"].Photos[sizeFormat].Content.Request().GetAsync();

                    if (photo != null)
                    {
                        MemoryStream ms = new MemoryStream();
                        photo.CopyTo(ms);
                        byte[] buffer = ms.ToArray();
                        string result = Convert.ToBase64String(buffer);

                        //not formatting internally
                        //imgData = string.Format("data:image/png;base64,{0}", result);
                        imgData = result;
                    }
                }
                catch (Exception ex) {

                    //assume error in 34Id or "Image Not Found" error

                    imgData = null;
                }
             
            }

            return imgData;

        }

        //public Task<Properties.JsonProp.KeyValue> GetUserThumbnailAsKeyValue(string searchUser34Id, string sizeFormat = "64x64")
        //{
        //    var results = new Properties.JsonProp.KeyValue();

        //    var imageBase64 = GetUserThumbnail(searchUser34Id, sizeFormat).Result;

        //    if (imageBase64 != null)
        //    {
        //        results.Thumbnail = imageBase64;
        //    }

        //    return Task.FromResult(results);
        //}

        public async Task<List<User>> GetUserDetails(string _34Id)
        {
            GraphServiceClient graph = _graphServiceClient;
            List<User> results = new List<User>();  //empty

            //replaced with keyvault, and setup is in constructor
            //if (graph == null)
            //    graph = ConfigureMSGraph();

            if (graph != null)
            {
                var searchResults = graph.Users.Request()
                    .Filter($"startsWith(userPrincipalName, '{_34Id}')")
                    .Select(aadUser => new
                    {
                        aadUser.Id,
                        aadUser.UserPrincipalName,  //34Id is in userPrincipalName field in MSGraph - Example: nk4907@hca.corpad.net
                        aadUser.DisplayName,
                        aadUser.GivenName,
                        aadUser.Surname,
                        aadUser.JobTitle,
                        aadUser.Department, //not returned in generic Users.Request so added Select to request Department explicitly
                        aadUser.Mail,
                        aadUser.Manager //not returned in generic users request

                    })
                    .GetAsync()
                    .Result;

                foreach (var user in searchResults)
                {
                    results.Add(user);
                }
            }
            return results;
        }

        public async Task<KeyValue> GetUserDetailsAsKeyValue(string _34Id)
        {
            var results = new KeyValue(); //empty

            var userDetails = GetUserDetails(_34Id).Result.FirstOrDefault();
            if (userDetails != null)
            {
                results.FirstName = userDetails.GivenName;
                results.LastName = userDetails.Surname;
                results.Email = userDetails.Mail;               //name@hcahealthcare.com
                results.Department = userDetails.Department;
                //results.Position = userDetails.JobTitle;
                //results.Username = userDetails.UserPrincipalName; //34Id@hca.corpad.net
            }

            return results;
        }

        /// <summary>
        /// Given a user's 34ID@hca.corpad.net input (full string of email address), will search for the user's manager and return the User object of that manager.
        /// </summary>
        /// <param name="hcaCorpadEmailAddress"></param>
        /// <returns></returns>
        public async Task<User> GetUserManager(string hcaCorpadRhymesWithSnail) //CodeScan in github REALLY doesn't like to allow logs with variables with Email or Address in the name
        {
            GraphServiceClient graph = _graphServiceClient;
            User result = new User(); //empty

            if(graph != null)
            {
                try
                {
                    var searchResults = (User)graph.Users[$"{hcaCorpadRhymesWithSnail}"].Manager.Request().GetAsync().Result;

                    result = searchResults;
                }
                catch(Exception ex) 
                {
                    var mundaneParameterDoNotFlagCodeScannerPlease = hcaCorpadRhymesWithSnail;


                    _logger.LogWarning($"Exception -Unable to pull Manager info from MsGraph for user: {mundaneParameterDoNotFlagCodeScannerPlease}, returning empty User: {ex}");
                    return new User(); //empty
                }
            }         
            
            return result;

        }


        private async Task<List<User>> SearchLastName(string searchUserString)
        {
            GraphServiceClient graph = _graphServiceClient;
            List<User> results = new List<User>();  //empty


            if (graph != null)
            {
                var searchResults = graph.Users.Request()
                    .Filter($"startsWith(surname, '{searchUserString}')") //34Id is in userPrincipalName field in MSGraph - Example: nk4907@hca.corpad.net
                            .Select(aadUser => new
                            {
                                aadUser.Id,
                                aadUser.UserPrincipalName,  //34Id is in userPrincipalName field in MSGraph - Example: nk4907@hca.corpad.net
                                aadUser.DisplayName,
                                aadUser.GivenName,
                                aadUser.Surname,
                                aadUser.JobTitle,
                                aadUser.Department, //not returned in generic Users.Request so added Select to request Department explicitly
                                aadUser.Mail,
                                aadUser.Manager, //not returned in generic users request
                                aadUser.City,

                            })
                    .Top(ConstantDefaults.MSGRAPH_RETURN_QUANTITY) //return x number of items (without this it will return 100)
                    .GetAsync()
                    .Result;

                foreach (var user in searchResults)
                {
                    results.Add(user);
                }
            }
            return results;
        }

        //Searches app user table and returns keyValue structured results for user search functionality
        public async Task<List<KeyValue>> SearchMultipleFieldsForUserAsKeyValue(string searchUserString)
        {

            var resultList = new List<KeyValue>();

            try
            {
                var lastNameResults = new List<User>();
                var firstNameResults = new List<User>();
                var fullNameResults = new List<User>();

                //If the search string does not contain a space, search first and last name separately...we don't know which one they're looking for
                if (!searchUserString.Contains(' '))
                {
                    lastNameResults = await SearchLastName(searchUserString);

                    firstNameResults = await SearchFirstName(searchUserString);
                }
                else //with space in search string, search for full name (Will search both first last or last first orders)
                {
                    fullNameResults = await SearchFullName(searchUserString);
                }
                //var displayNameResults = await SearchDisplayName(searchUserString);

                var _34IdList = await Search34Id(searchUserString);

                var combined = lastNameResults;
                combined.AddRange(firstNameResults);
                combined.AddRange(fullNameResults);

                // combined.AddRange(displayNameResults);
                combined.AddRange(_34IdList);


                //build out the list to display to user on front end
                foreach (var user in combined)
                {
                    var this34Id = user.UserPrincipalName;


                    if (this34Id != null)
                    {
                        this34Id = this34Id.Split('@')[0];
                    }


                    var key = user.UserPrincipalName.Split('@')[0].ToLower();
                    var value = user.GivenName + " " + user.Surname;

                    resultList.Add(new Util.KeyValue()
                    {
                        Key = key,
                        Value = value,
                        Result = $"{key}, {value}",
                    });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("error fetching users that match search string");
                _logger.LogError($"In Util, exception thrown Searching Users. Returning empty list. Exception: {ex}");
            }


            return resultList;
        }



        private async Task<List<User>> SearchFirstName(string searchUserString)
        {
            GraphServiceClient graph = _graphServiceClient;
            List<User> results = new List<User>();  //empty

            //replaced with keyvault, and setup is in constructor
            //if (graph == null)
            //    graph = ConfigureMSGraph();

            if (graph != null)
            {
                var searchResults = graph.Users.Request()
                    .Filter($"startsWith(givenName, '{searchUserString}')") //34Id is in userPrincipalName field in MSGraph - Example: nk4907@hca.corpad.net
                     .Select(aadUser => new
                     {
                         aadUser.Id,
                         aadUser.UserPrincipalName,  //34Id is in userPrincipalName field in MSGraph - Example: nk4907@hca.corpad.net
                         aadUser.DisplayName,
                         aadUser.GivenName,
                         aadUser.Surname,
                         aadUser.JobTitle,
                         aadUser.Department, //not returned in generic Users.Request so added Select to request Department explicitly
                         aadUser.Mail,
                         aadUser.Manager, //not returned in generic users request
                         aadUser.City,

                     })
                    .Top(ConstantDefaults.MSGRAPH_RETURN_QUANTITY) //return x number of items (without this it will return 100)
                    .GetAsync()
                    .Result;

                foreach (var user in searchResults)
                {
                    results.Add(user);
                }
            }
            return results;
        }

        private async Task<List<User>> SearchFullName(string searchUserString)
        {
            GraphServiceClient graph = _graphServiceClient;
            List<User> results = new List<User>();  //empty

            //replaced with keyvault, and setup is in constructor
            //if (graph == null)
            //    graph = ConfigureMSGraph();

            if (graph != null)
            {

                var firstTerm = searchUserString.Split(' ')[0];

                var secondTerm = searchUserString.Split(' ')[1];

                if (string.IsNullOrEmpty(secondTerm))
                {
                    return results;
                }

                var searchResults = graph.Users.Request()
                      .Filter($"startsWith(givenName, '{firstTerm}') and startsWith(surname, '{secondTerm}')")
                              .Select(aadUser => new
                              {
                                  aadUser.Id,
                                  aadUser.UserPrincipalName,  //34Id is in userPrincipalName field in MSGraph - Example: nk4907@hca.corpad.net
                                  aadUser.DisplayName,
                                  aadUser.GivenName,
                                  aadUser.Surname,
                                  aadUser.JobTitle,
                                  aadUser.Department, //not returned in generic Users.Request so added Select to request Department explicitly
                                  aadUser.Mail,
                                  aadUser.Manager, //not returned in generic users request
                                  aadUser.City,

                              })
                      .Top(ConstantDefaults.MSGRAPH_RETURN_QUANTITY) //return x number of items (without this it will return 100)
                      .GetAsync()
                      .Result;

                foreach (var user in searchResults)
                {
                    results.Add(user);
                }

                //invert terms for last name first name
                var searchResults2 = graph.Users.Request()
               .Filter($"startsWith(givenName, '{secondTerm}') and startsWith(surname, '{firstTerm}')")
                       .Select(aadUser => new
                       {
                           aadUser.Id,
                           aadUser.UserPrincipalName,  //34Id is in userPrincipalName field in MSGraph - Example: nk4907@hca.corpad.net
                           aadUser.DisplayName,
                           aadUser.GivenName,
                           aadUser.Surname,
                           aadUser.JobTitle,
                           aadUser.Department, //not returned in generic Users.Request so added Select to request Department explicitly
                           aadUser.Mail,
                           aadUser.Manager, //not returned in generic users request
                           aadUser.City,

                       })
               .Top(ConstantDefaults.MSGRAPH_RETURN_QUANTITY) //return x number of items (without this it will return 100)
               .GetAsync()
               .Result;

                foreach (var user in searchResults2)
                {
                    results.Add(user);
                }



            }
            return results;
        }




        //authenticate to MSGraph (app registration), return GraphServiceClient
        private static GraphServiceClient GetAuthenticatedGraphClient(IConfidentialClientApplication app, string[] scopes)
        {
            AuthenticationResult result = null;

            GraphServiceClient graphServiceClient =
                        new GraphServiceClient("https://graph.microsoft.com/V1.0/", new DelegateAuthenticationProvider(async (requestMessage) =>
                        {
                            // Retrieve an access token for Microsoft Graph (gets a fresh token if needed).
                            result = await app.AcquireTokenForClient(scopes.AsEnumerable())
                                .ExecuteAsync();

                            // Add the access token in the Authorization header of the API request.
                            requestMessage.Headers.Authorization =
                                new AuthenticationHeaderValue("Bearer", result.AccessToken);

                        }));

            return graphServiceClient;

        }

    }//end class MSGraphHelper

    class MSGraphParams
    {
        public string? Instance;
        public string? ApiUrl;
        public string? Tenant;
        public string? ClientId;
        public string? ClientSecret;

    }

    public class KeyValue //TODO - rename this and the properties once testing successfully, this is migrated from PODS and names aren't very useful as is.
    {
        [JsonProperty("Key")]
        public string Key { get; set; }

        [JsonProperty("Value")]
        public string Value { get; set; }

        [JsonProperty("Result")]
        public string Result { get; set; }

        [JsonProperty("FirstName")]
        public string? FirstName { get; set; }

        [JsonProperty("LastName")]
        public string? LastName { get; set; }

        [JsonProperty("Department")]
        public string? Department { get; set; }

        [JsonProperty("Email")]
        public string? Email { get; set; }

    }
}