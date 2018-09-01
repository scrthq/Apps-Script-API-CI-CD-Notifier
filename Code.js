var ss = SpreadsheetApp.getActiveSpreadsheet();
Logger = BetterLog.useSpreadsheet(ss.getId());

var CONFIG = getConfig();
if (typeof CONFIG.APIKey === 'undefined') {
  CONFIG.APIKey = null
}
if (typeof CONFIG.AppVeyor === 'undefined') {
  CONFIG.AppVeyor = { "repos": [] };
}
if (typeof CONFIG.CircleCI === 'undefined') {
  CONFIG.CircleCI = { "repos": [] };
}
if (typeof CONFIG.GChat === 'undefined') {
  CONFIG.GChat = { "verificationToken": null };
}
if (typeof CONFIG.TravisCI === 'undefined') {
  CONFIG.TravisCI = { "repos": [] };
}
if (typeof CONFIG.VSTS === 'undefined') {
  CONFIG.VSTS = { "repos": [] };
}
Logger.log(CONFIG);


/**
 * Get the current Sheet details and format Sheet as needed
 */
var sheet = ss.getSheetByName("Queue");
if (!sheet) {
  Logger.log("Queue sheet not found! Creating...");
  ss.insertSheet("Queue", 0);
  sheet = ss.getSheetByName("Queue");
  sheet.deleteRows(2, (sheet.getMaxRows() - 1));
}
if (sheet.getMaxColumns() > 4) {
  sheet.deleteColumns(5, (sheet.getMaxColumns() - 4));
}
var tracker = ss.getSheetByName("Tracker");
if (!tracker) {
  Logger.log("Tracker sheet not found! Creating...");
  ss.insertSheet("Tracker");
  tracker = ss.getSheetByName("Tracker");
  var trackerRange = tracker.getRange(1, 1, 2);
  trackerRange.setValues([["EventId"],["1"]]);
  tracker.deleteRows(3, (tracker.getMaxRows() - 2)).deleteColumns(2, (tracker.getMaxColumns() - 1));
}
if (tracker.getMaxColumns() > 2) {
  tracker.deleteColumns(3, (tracker.getMaxColumns() - 2));
}
if (tracker.getMaxRows() > 2) {
  tracker.deleteRows(3, (tracker.getMaxRows() - 2));
}
var dlq = ss.getSheetByName("Dead Letters");
if (!dlq) {
  Logger.log("Dead Letter Queue sheet not found! Creating...");
  ss.insertSheet("Dead Letters");
  dlq = ss.getSheetByName("Dead Letters");
  var dlqRange = dlq.getRange("A1:E1");
  dlqRange.setValues([["DateTime","Id","Event","PostData","Source"]]);
  dlq.deleteRows(2, (dlq.getMaxRows() - 1));
}
if (dlq.getMaxColumns() > 5) {
  dlq.deleteColumns(6, (dlq.getMaxColumns() - 5));
}
var sheetOne = ss.getSheetByName("Sheet1");
if (sheetOne) {
  Logger.log("Default sheet1 found! Deleting...");
  ss.deleteSheet(sheetOne);
}
if (sheet.getRange(1,2).getValue() != "Event") {
  Logger.log("Inserting new row 1 for Header");
  sheet.insertRowBefore(1);
}
else {
  Logger.log("Header row already set");
}
Logger.log("Setting Initial Queue Sheet headers");
var values = [["Id", "Event", "Acked", "Source"]];
var range = sheet.getRange("A1:D1");
range.setValues(values);

Logger.log("Setting format for Queue Header row");
range.setHorizontalAlignment("center").setFontWeight("bold");
dlq.getRange("A1:C1").setHorizontalAlignment("center").setFontWeight("bold");

Logger.log("Setting format for Tracker Sheet");
tracker.getRange("A1").setHorizontalAlignment("center").setFontWeight("bold");
tracker.getRange("A2").setHorizontalAlignment("center");

Logger.log("Setting Event column to auto-wrap");
sheet.getRange("B:B").setWrap(true).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
dlq.getRange("C:C").setWrap(true).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

Logger.log("Setting Sheet tab colors");
sheet.setTabColor("41f4d9");
tracker.setTabColor("f4df41");
dlq.setTabColor("ff0000");

function parseSender(event) {
  if ('postData' in event) {
    var postData = JSON.parse(event.postData.contents);
  }
  else {
    postData = {};
  }
  if ('token' in postData && postData.token === CONFIG.GChat.verificationToken) {
    return {
      "format": "raw",
      "matched": true,
      "sender": "GChat"
    };
  }
  else if ('build_url' in postData && (/^https:\/\/travis-ci.org\/.*/).test(postData.build_url) && CONFIG.TravisCI.repos.includes(postData.repository.owner_name + '/' + postData.repository.name)) {
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
  else if ('resource' in postData && (/^https:\/\/.*.visualstudio.com\/.*/).test(postData.resource.url) && CONFIG.VSTS.repos.includes(postData.eventData.repositoryName)) {
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

/**
 * Validates the JSON payload
 * 
 * @param {Object} e the event to validate 
 */
function validateEvent(e) {
  if (typeof e !== 'undefined') {
    if ('postData' in e) {
      var postData = JSON.parse(e.postData.contents);
      var postToken = '';
      if ('token' in postData) {
        postToken = postData.token;
      }
      Logger.log(e);
      if ('token' in postData && postToken === CONFIG.GChat.verificationToken) {
        return {
          "success": true,
          "text": "Payload Token validated! Hi from Apps Script API!"
        };
      }
      else if (e.parameter.token === CONFIG.APIKey || e.parameter.token === CONFIG.GChat.verificationToken || ('token' in postData && (postToken === CONFIG.APIKey || postToken === CONFIG.GChat.verificationToken))) {
        return {
          "success": true,
          "text": "API Key validated! Hi from Apps Script API!"
        };
      }
      else {
        return { "success": false };
      }
    }
    else if (e.parameter.token === CONFIG.APIKey || e.parameter.token === CONFIG.GChat.verificationToken) {
      return {
        "success": true,
        "text": "API Key validated! Hi from Apps Script API!"
      };
    }
    else {
      return { "success": false };
    }
  }
}

function doGet(e) {
  var validation = validateEvent(e);
  var sender = parseSender(e);
  Logger.log('Sender: ' + sender);
  if (validation.success) {
    return ContentService.createTextOutput('{"response": "Authentication succeeded!", "sender": ' + JSON.stringify(sender) + '}');
  }
  else {
    return ContentService.createTextOutput('{"error": "Authentication failed!"}');
  }
}

function doPost(e) {
  var sender = parseSender(e);
  processPost(e, sender);
  // Return a blank JSON object so the sender receives an ack back
  return ContentService.createTextOutput('{}');
}
