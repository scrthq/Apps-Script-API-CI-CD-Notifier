function getConfig() {
  var CONF = {
    // Random GUID example. Use any value preferred here as long as it's URL safe
    "APIKey": "5f9a13ed-4b42-42ea-bc8b-b750420b470c", 
    "AppVeyor": {
      "addToQueue": false,
      "repos": ["scrthq/Apps-Script-API-CI-CD-Notifier"],
      "webhooks": []
    },
    "CircleCI": {
      "addToQueue": false,
      "repos": ["scrthq/Apps-Script-API-CI-CD-Notifier"],
      "webhooks": []
    },
    "GChat": {
      "addToQueue": true,
      // This is the verification token provided on the Google Hangouts Chat API configuration page
      "verificationToken": "YUCvWxynTqeNiGzsEAgMhJcIwDaubdXORfoPtlkBjmL="
    },
    "TravisCI": {
      "addToQueue": false,
      "repos": ["scrthq/Apps-Script-API-CI-CD-Notifier"],
      "webhooks": []
    },
    "VSTS": {
      "addToQueue": false,
      "repos": ["scrthq/Apps-Script-API-CI-CD-Notifier"],
      "webhooks": []
    }
  }
  Logger.log('CONFIG: ' + JSON.stringify(CONF));
  return CONF;
}