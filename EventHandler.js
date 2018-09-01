function parseSender(event, config) {
  Logger.log("Parsing sender...");
  var tracker = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tracker");
  var dlq = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Dead Letters");
  var idRange = tracker.getRange(2, 1);
  var nextId = idRange.getValue() + 1;
  try {
    var postData = {};
    if ('postData' in event) {
      postData = JSON.parse(event.postData.contents);
    }
    if ('token' in postData && postData.token === config.GChat.verificationToken) {
      return {
        "format": "raw",
        "matched": true,
        "sender": "GChat"
      };
    }
    else if ('build_url' in postData && (/^https:\/\/travis-ci.org\/.*/).test(postData.build_url) && config.TravisCI.repos.includes(postData.repository.owner_name + '/' + postData.repository.name)) {
      return {
        "format": "raw",
        "matched": true,
        "sender": "TravisCI"
      };
    }
    else if ('eventData' in postData && 'buildUrl' in postData.eventData && (/^https:\/\/ci.appveyor.com\/.*/).test(postData.eventData.buildUrl)) {
      return {
        "format": "raw",
        "matched": true,
        "sender": "AppVeyor"
      };
    }
    else if ('resource' in postData && (/^https:\/\/.*.visualstudio.com\/.*/).test(postData.resource.url) && config.VSTS.repos.includes(postData.eventData.repositoryName)) {
      return {
        "format": "raw",
        "matched": true,
        "sender": "VSTS"
      };
    }
    else if ('attachments' in postData && ('text' in postData.attachments[0] || 'text' in postData)) {
      if ((/https:\/\/circleci.com\/.*/).test(postData.attachments[0].text) || (/https:\/\/circleci.com\/.*/).test(postData.text)) {
        return {
          "format": "slack",
          "matched": true,
          "sender": "CircleCI"
        };
      }
      else if ((/https:\/\/ci.appveyor.com\/.*/).test(postData.attachments[0].text)) {
        return {
          "format": "slack",
          "matched": true,
          "sender": "AppVeyor"
        };
      }
      else {
        return { "matched": false };
      }
    }
    else {
      return { "matched": false };
    }
  }
  catch (e) {
    e = (typeof e === 'string') ? new Error(e) : e;
    Logger.severe('%s: %s (line %s, file "%s"). Stack: "%s" . While processing %s.',e.name || '', e.message || '', e.lineNumber || '', e.fileName || '', e.stack || '', '');
    dlq.appendRow([(new Date()).toLocaleString(), nextId, JSON.stringify(event), event.postData.contents, 'Unknown[Not Validated]']);
    throw e;
  }
}

/**
 * Validates the JSON payload
 * 
 * @param {Object} e the event to validate 
 */
function validateEvent(e, config) {
  if (typeof e !== 'undefined') {
    if ('postData' in e) {
      var postData = JSON.parse(e.postData.contents);
      var postToken = '';
      if ('token' in postData) {
        postToken = postData.token;
      }
      if ('token' in postData && postToken === config.GChat.verificationToken) {
        return {
          "message": "POST Payload token validated!",
          "success": true
        };
      }
      else if (e.parameter.token === config.APIKey || e.parameter.token === config.GChat.verificationToken || ('token' in postData && (postToken === config.APIKey || postToken === config.GChat.verificationToken))) {
        return {
          "message": "POST token validated!",
          "success": true
        };
      }
      else {
        return { "success": false };
      }
    }
    else if (e.parameter.token === config.APIKey || e.parameter.token === config.GChat.verificationToken) {
      return {
        "message": "GET Token validated!",
        "success": true
      };
    }
    else {
      return { "success": false };
    }
  }
}

/**
 * Validates the event.token and adds the event to the message queue
 *
 * @param {Object} event the event object from the API call
 * 
 * @param {String} sender the sender of the event returned from parseSender(e)
 */
function processPost(event, sender, config) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Queue");
  var tracker = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tracker");
  var dlq = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Dead Letters");
  var idRange = tracker.getRange(2, 1);
  var nextId = idRange.getValue() + 1;
  Logger.log("Validating event sender");
  var validation = validateEvent(event, config);
  if (sender.matched) {
    idRange.setValue(nextId);
    Logger.log(JSON.stringify(validation));
    if (validation.success) {
      Logger.log("Event validated! Adding event to Sheets MQ");
      sheet.appendRow([nextId, JSON.stringify(JSON.parse(event.postData.contents)), "No", sender.sender]);
      Logger.log('EVENT: ' + JSON.stringify(event));
    }
    else {
      Logger.log("Sender matched but event not validated! Adding full event to Dead Letters queue");
      dlq.appendRow([(new Date()).toLocaleString(), nextId, JSON.stringify(event), JSON.stringify(JSON.parse(event.postData.contents)), sender.sender]);
      Logger.log('EVENT: ' + JSON.stringify(event));
    }
  }
  else if (validation.success) {
    Logger.log("Sender not matched but event was validated! Adding full event to Dead Letters queue for inspection");
    dlq.appendRow([(new Date()).toLocaleString(), nextId, JSON.stringify(event), JSON.stringify(JSON.parse(event.postData.contents)), 'Unknown[Validated]']);
    Logger.log('EVENT: ' + JSON.stringify(event));
  }
  else {
    Logger.log("Sender not matched and event not validated! Adding full event to Dead Letters queue for inspection");
    dlq.appendRow([(new Date()).toLocaleString(), nextId, JSON.stringify(event), JSON.stringify(JSON.parse(event.postData.contents)), 'Unknown[Not Validated]']);
    Logger.log('EVENT: ' + JSON.stringify(event));
  }
}
