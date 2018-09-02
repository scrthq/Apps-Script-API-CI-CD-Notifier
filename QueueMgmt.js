/**
 * Cleans up the Sheet and removes any Acked or empty rows
 */
function cleanupSheet() {
  Logger.log('------------ CLEANING UP SHEET ------------');
  // Get Sheet objects
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Queue");
  var tracker = ss.getSheetByName("Tracker");
  var dlq = ss.getSheetByName("Dead Letters");
  // Create Sheets if missing
  if (!sheet) {
    Logger.log("Queue sheet not found! Creating...");
    ss.insertSheet("Queue", 0);
    sheet = ss.getSheetByName("Queue");
    sheet.deleteRows(2, (sheet.getMaxRows() - 1));
  }
  if (!tracker) {
    Logger.log("Tracker sheet not found! Creating...");
    ss.insertSheet("Tracker");
    tracker = ss.getSheetByName("Tracker");
    var trackerRange = tracker.getRange(1, 1, 2);
    trackerRange.setValues([["EventId"],["1"]]);
    tracker.deleteRows(3, (tracker.getMaxRows() - 2)).deleteColumns(2, (tracker.getMaxColumns() - 1));
  }
  if (!dlq) {
    Logger.log("Dead Letter Queue sheet not found! Creating...");
    ss.insertSheet("Dead Letters");
    dlq = ss.getSheetByName("Dead Letters");
    var dlqRange = dlq.getRange("A1:E1");
    dlqRange.setValues([["DateTime","Id","Event","PostData","Source"]]);
    dlq.deleteRows(2, (dlq.getMaxRows() - 1));
  }
  // Remove unneccessary columns and rows
  if (sheet.getMaxColumns() > 4) {
    sheet.deleteColumns(5, (sheet.getMaxColumns() - 4));
  }
  if (tracker.getMaxColumns() > 2) {
    tracker.deleteColumns(3, (tracker.getMaxColumns() - 2));
  }
  if (tracker.getMaxRows() > 2) {
    tracker.deleteRows(3, (tracker.getMaxRows() - 2));
  }
  if (dlq.getMaxColumns() > 5) {
    dlq.deleteColumns(6, (dlq.getMaxColumns() - 5));
  }
  // Remove the default Sheet if present
  var sheetOne = ss.getSheetByName("Sheet1");
  if (sheetOne) {
    Logger.log("Default sheet1 found! Deleting...");
    ss.deleteSheet(sheetOne);
  }
  // Fix the queue sheet's header row if broken
  if (sheet.getRange(1,2).getValue() != "Event") {
    Logger.log("Inserting new row 1 for Header");
    sheet.insertRowBefore(1);
    var values = [["Id", "Event", "Acked", "Source"]];
    var range = sheet.getRange("A1:D1");
    range.setValues(values);
    range.setHorizontalAlignment("center").setFontWeight("bold");
  }
  // Set sheet style
  dlq.getRange("A1:C1").setHorizontalAlignment("center").setFontWeight("bold");
  tracker.getRange("A1").setHorizontalAlignment("center").setFontWeight("bold");
  tracker.getRange("A2").setHorizontalAlignment("center");
  sheet.getRange("B:B").setWrap(true).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  dlq.getRange("C:C").setWrap(true).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  sheet.setTabColor("41f4d9");
  tracker.setTabColor("f4df41");
  dlq.setTabColor("ff0000");
  // Checked for acked rows to delete from the Queue and delete them if found
  var toDelete = [];
  var deleteCount = 0;
  var curMaxRows = sheet.getMaxRows();
  var rows = sheet.getRange(1, 1, curMaxRows, sheet.getMaxColumns()).getValues();
  for (var c = 0; c < curMaxRows; c++) {
    if (rows[c][2] == "") {
      toDelete.push(rows[c][0]);
    }
    else if (rows[c][2] == "Yes") {
      toDelete.push(rows[c][0]);
    }
  }
  if (toDelete.length > 0) {
    rows = sheet.getRange(1, 1, curMaxRows, sheet.getMaxColumns()).getValues();
    for (var i = 0; i < curMaxRows; i++) {
      if (rows[i][0] != "Id") {
        for (var d = 0; d < toDelete.length; d++) {
          if (rows[i][0] == toDelete[d]) {
            var rowToDelete = i + 1 - deleteCount;
            sheet.deleteRow(rowToDelete);
            deleteCount += 1;
            break;
          }
        }
      }
    }
  }
  Logger.log("Cleaned up " + deleteCount + " rows.");
}
