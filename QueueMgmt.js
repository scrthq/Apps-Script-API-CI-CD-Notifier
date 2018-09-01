/**
 * Cleans up the Sheet and removes any Acked or empty rows
 */
function cleanupSheet(sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Queue")) {  
  var toDelete = [];
  var rows = sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).getValues();
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

/**
 * Validates the event.token and adds the event to the message queue
 *
 * @param {Object} event the event object from the API call
 * 
 * @param {String} sender the sender of the event returned from parseSender(e)
 */
function processPost(event, sender, sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Queue"), tracker = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tracker"), dlq = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Dead Letters")) {
  var validation = validateEvent(event);
  if (sender.matched) {
    var idRange = tracker.getRange(2, 1);
    var nextId = idRange.getValue() + 1;
    idRange.setValue(nextId);
    Logger.log(validation);
    if (validation.success) {
      Logger.log("Adding event to Sheets MQ");
      sheet.appendRow([nextId, JSON.stringify(JSON.parse(event.postData.contents)), "No", sender.sender]);
      Logger.log(event);
    }
    else {
      Logger.log("Sender matched but event not validated! Adding full event to Dead Letters queue");
      dlq.appendRow([(new Date()).toLocaleString(), nextId, JSON.stringify(event), JSON.stringify(JSON.parse(event.postData.contents)), sender.sender]);
      Logger.log(event);
    }
  }
  else if (validation.success) {
    Logger.log("Sender not matched but event was validated! Adding full event to Dead Letters queue for inspection");
    dlq.appendRow([(new Date()).toLocaleString(), nextId, JSON.stringify(event), JSON.stringify(JSON.parse(event.postData.contents)), 'Unknown[Validated]']);
    Logger.log(event);
  }
  else {
    Logger.log("Sender not matched and event not validated! Adding full event to Dead Letters queue for inspection");
    dlq.appendRow([(new Date()).toLocaleString(), nextId, JSON.stringify(event), JSON.stringify(JSON.parse(event.postData.contents)), 'Unknown[Not Validated]']);
    Logger.log(event);
  }
  sheet.autoResizeColumns(1, 4);
  dlq.autoResizeColumns(1,5);
}