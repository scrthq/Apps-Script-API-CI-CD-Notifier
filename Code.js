Logger = BetterLog.useSpreadsheet(SpreadsheetApp.getActiveSpreadsheet().getId());

function doGet(e) {
  Logger.log('------------ NEW GET REQUEST ------------');
  var config = getConfig();
  var validation = validateEvent(e, config);
  var sender = parseSender(e, config);
  Logger.log('Sender: ' + JSON.stringify(sender));
  if (validation.success) {
    return ContentService.createTextOutput('{"response": "Authentication succeeded!", "sender": ' + JSON.stringify(sender) + '}').setMimeType(ContentService.MimeType.JSON);
  }
  else {
    return ContentService.createTextOutput('{"error": "Authentication failed!"}').setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  Logger.log('------------ NEW POST REQUEST ------------');
  var config = getConfig();
  var sender = parseSender(e, config);
  Logger.log('Sender: ' + JSON.stringify(sender));
  processPost(e, sender, config);
  // Return a blank JSON object so the sender receives an ack back
  return ContentService.createTextOutput('{}').setMimeType(ContentService.MimeType.JSON);
}
