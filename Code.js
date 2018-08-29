var CONFIG = getConfig();
if (!('APIKey' in CONFIG)) {
  CONFIG.APIKey = null
}
if (!('AppVeyor' in CONFIG)) {
  CONFIG.AppVeyor = { "repos": [] };
}
if (!('CircleCI' in CONFIG)) {
  CONFIG.CircleCI = { "repos": [] };
}
if (!('GChat' in CONFIG)) {
  CONFIG.GChat = { "verificationToken": null };
}
if (!('TravisCI' in CONFIG)) {
  CONFIG.TravisCI = { "repos": [] };
}
if (!('VSTS' in CONFIG)) {
  CONFIG.VSTS = { "repos": [] };
}

/**
 * Get the current Sheet details and format Sheet as needed
 */
Logger.log("Getting Spreadsheet");
var ss = SpreadsheetApp.getActiveSpreadsheet();
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
  var dlqRange = dlq.getRange("A1:B1");
  dlqRange.setValues([["DateTime","Id","Event"]]);
  dlq.deleteRows(2, (dlq.getMaxRows() - 1));
}
if (dlq.getMaxColumns() > 3) {
  dlq.deleteColumns(4, (dlq.getMaxColumns() - 3));
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

/**
 * Cleans up the Sheet and removes any Acked or empty rows
 */
function cleanupSheet() {  
  var toDelete = [];
  var rows = sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).getValues();
  sheet.autoResizeColumns(1, 4);
  for (var c = 0; c < sheet.getMaxRows(); c++) {
    Logger.log("Checking row: " + c);
    if (rows[c][2] == "") {
      Logger.log("Deleting EMPTY row: " + (c + 1));
      toDelete.push(rows[c][0]);
    }
    else if (rows[c][2] == "Yes") {
      Logger.log("Deleting ACKED row: " + (c + 1));
      toDelete.push(rows[c][0]);
    }
  }
  if (toDelete.length > 0) {
    var deleteCount = 0;
    rows = sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).getValues();
    for (var i = 0; i < sheet.getMaxRows(); i++) {
      if (rows[i][0] != "Id") {
        for (var d = 0; d < toDelete.length; d++) {
          if (rows[i][0] == toDelete[d]) {
            var rowToDelete = i + 1 - deleteCount;
            Logger.log("Deleting row '" + rowToDelete + "'/ ID: " + toDelete[d]);
            sheet.deleteRow(rowToDelete);
            deleteCount += 1;
            break;
          }
        }
      }
    }
    Logger.log("Cleaned up " + deleteCount + " rows.");
  }
}

function parseSender(event) {
  var postData = JSON.parse(event.postData.contents);
  if ('token' in postData && postData.token === CONFIG.GChat.verificationToken) {
    return 'GChat';
  }
  else if ('build_url' in postData && (/^https:\/\/travis-ci.org\/.*/).test(postData.build_url) && CONFIG.TravisCI.repos.includes(postData.repository.owner_name + '/' + postData.repository.name)) {
    return 'TravisCI';
  }
  else if ('buildUrl' in postData && (/^https:\/\/ci.appveyor.com\/.*/).test(postData.buildUrl) && CONFIG.AppVeyor.repos.includes(postData.eventData.repositoryName)) {
    return 'AppVeyor';
  }
  else if ('resource' in postData && (/^https:\/\/.*.visualstudio.com\/.*/).test(postData.resource.url) && CONFIG.VSTS.repos.includes(postData.eventData.repositoryName)) {
    return 'VSTS';
  }
  else if ('payload' in postData && (/^https:\/\/circleci.com\/.*/).test(postData.payload.build_url) && CONFIG.CircleCI.repos.includes(postData.payload.username + '/' + postData.payload.reponame)) {
    return 'CircleCI';
  }
  else {
    return 'Unknown';
    // Return false;
  }
}

/**
 * Validates the JSON payload
 * 
 * @param {Object} e the event to validate 
 */
function validateEvent(e) {
  var postData = JSON.parse(e.postData.contents);
  var postToken = null;
  if ('token' in postData) {
    postToken = postData.token;
  }
  if (typeof e !== 'undefined') {
    Logger.log(e);
    if (postToken === CONFIG.GChat.verificationToken) {
      return {
        "success": true,
        "text": "Payload Token validated! Hi from Apps Script API!"
      };
    }
    else if (e.parameter.token in (CONFIG.APIKey, CONFIG.GChat.verificationToken) || postToken in (CONFIG.APIKey, CONFIG.GChat.verificationToken)) {
      return {
        "success": true,
        "text": "API Key validated! Hi from Apps Script API!"
      };
    }
    else if ((!(postToken === null) && postToken != CONFIG.GChat.verificationToken) || (postToken === null && !e.parameter.token)) {
      return { "success": false };
    }
  }
}

/**
 * Validates the event.token and adds the event to the message queue
 *
 * @param {Object} event the event object from the API call
 * 
 * @param {String} source the source of the event
 */
function addEventToSheet(event, source) {
  var idRange = tracker.getRange(2, 1);
  var nextId = idRange.getValue() + 1;
  idRange.setValue(nextId);
  var validation = validateEvent(event);
  Logger.log(validation);
  if (validation.success) {
    Logger.log("Adding event to Sheets MQ");
    sheet.appendRow([nextId, event.postData.contents, "No", source]);
    Logger.log(event);
  }
  else {
    Logger.log("Event not validated! Adding full event to Dead Letters queue");
    dlq.appendRow([(new Date()).toLocaleString(), nextId, JSON.stringify(event)]);
    Logger.log(event);
  }
}

function doGet(e) {
  if (validateEvent(e)) {
    var sender = parseSender(e);
    Logger.log('Sender: ' + sender);
  }
  else {
    return ContentService.createTextOutput('{"text": "The event is missing both a post token and API key!"}');
  }
}

function doPost(e) {
  var sender = parseSender(e);
  addEventToSheet(e, sender);
}

function testPOST() {
  var url = ScriptApp.getService().getUrl();
  var options = {
    "followRedirects": true,
    "method": "POST",
    "muteHttpExceptions": true,
    "payload": JSON.stringify({
      "blog": "ctrlq",
      "name": "labnol",
      "type": "post"
    })
  };
  var result = UrlFetchApp.fetch(url, options);
  if (result.getResponseCode() == 200) {
    var final = JSON.parse(result.getContentText());
    Logger.log(final);
  }
}

function testGET() {
  var queryString = "?greeting=Hola&name=Mundo";
  var url = ScriptApp.getService().getUrl() + queryString;
  Logger.log(url);
  var options = {
    "followRedirects": true,
    "method": "GET",
    "muteHttpExceptions": true
  };
  var result = UrlFetchApp.fetch(url, options);
  if (result.getResponseCode() == 200) {
    return result.getContentText();
  }
}