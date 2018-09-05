Logger = BetterLog.useSpreadsheet(SpreadsheetApp.getActiveSpreadsheet().getId());
Logger.SHEET_MAX_ROWS = 700;
Logger.SHEET_LOG_CELL_WIDTH = 1600;

function doGet(e) {
    Logger.log('------------ NEW GET REQUEST ------------');
    var config = getConfig();
    return ContentService.createTextOutput(JSON.stringify(processGet(e, config))).setMimeType(ContentService.MimeType.JSON);
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