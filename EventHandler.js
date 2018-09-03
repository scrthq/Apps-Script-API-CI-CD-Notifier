function parseSender(event, config) {
  var tracker = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tracker");
  var dlq = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Dead Letters");
  var idRange = tracker.getRange(2, 1);
  var nextId = idRange.getValue() + 1;
  try {
    var postData = {};
    var sender = { "matched": false };
    if ('postData' in event) {
      if (event.postData.type === 'application/x-www-form-urlencoded' && 'payload' in event.parameter) {
        postData = JSON.parse(event.parameter.payload)
      }
      else {
        postData = JSON.parse(event.postData.contents);
      }
    }
    if ('token' in postData && postData.token === config.GChat.verificationToken) {
      sender = {
        "format": "raw",
        "matched": true,
        "sender": "GChat"
      };
    }
    else if ('build_url' in postData && (/^https:\/\/travis-ci.org\/.*/).test(postData.build_url)) {
      sender = {
        "format": "raw",
        "matched": true,
        "sender": "TravisCI"
      };
    }
    else if ('eventData' in postData && 'buildUrl' in postData.eventData && (/^https:\/\/ci.appveyor.com\/.*/).test(postData.eventData.buildUrl)) {
      sender = {
        "format": "raw",
        "matched": true,
        "sender": "AppVeyor"
      };
    }
    else if ('sender' in postData && 'url' in postData.sender && (/^https:\/\/api.github.com\/users.*/).test(postData.sender.url)) {
      sender = {
        "format": "raw",
        "matched": true,
        "sender": "GitHub"
      };
    }
    else if ('resource' in postData && (/^https:\/\/.*.visualstudio.com\/.*/).test(postData.resource.url) && config.VSTS.repos.includes(postData.eventData.repositoryName)) {
      sender = {
        "format": "raw",
        "matched": true,
        "sender": "VSTS"
      };
    }
    else if (('attachments' in postData && 'text' in postData.attachments[0]) || ('text' in postData && 'channel' in postData)) {
      if ((/(https:\/\/circleci.com\/.*|^Hello from CircleCI$)/).test(postData.attachments[0].text)) {
        sender = {
          "format": "slack",
          "matched": true,
          "sender": "CircleCI"
        };
      }
      else if ((/https:\/\/ci.appveyor.com\/.*/).test(postData.attachments[0].text)) {
        sender = {
          "format": "slack",
          "matched": true,
          "sender": "AppVeyor"
        };
      }
      else if (config.Unknown.passThru === true) {
        sender = {
          "format": "slack",
          "matched": true,
          "sender": "Unknown"
        };
      }
    }
    return sender;
  }
  catch (e) {
    var err = (typeof e === 'string')
          ? new Error(e)
          : e;
    Logger.severe('%s: %s (line %s, file "%s"). Stack: "%s" . While processing %s.', err.name || '', err.message || '', err.lineNumber || '', err.fileName || '', err.stack || '', '');
    dlq.appendRow([Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss:SSS Z'), nextId, JSON.stringify(event), event.postData.contents, 'Unknown[Not Validated]']);
    throw err;
  }
}

/**
 * Validates the JSON payload
 * 
 * @param {Object} e the event to validate 
 */
function validateEvent(e, config) {
  var validation = { "success": false };
  if (typeof e !== 'undefined') {
    if ('postData' in e) {
      var postData = {}
      if (e.postData.type === 'application/x-www-form-urlencoded' && 'payload' in e.parameter) {
        postData = JSON.parse(e.parameter.payload)
      }
      else {
        postData = JSON.parse(e.postData.contents);
      }
      var postToken = null;
      if ('token' in postData) {
        postToken = postData.token;
      }
      if (postToken !== null && postToken === config.GChat.verificationToken) {
        validation = {
          "message": "POST Payload token validated!",
          "success": true
        };
      }
      else if (e.parameter.token === config.APIKey || e.parameter.token === config.GChat.verificationToken || ('token' in postData && (postToken === config.APIKey || postToken === config.GChat.verificationToken))) {
        validation = {
          "message": "POST token validated!",
          "success": true
        };
      }
    }
    else if (e.parameter.token === config.APIKey || e.parameter.token === config.GChat.verificationToken) {
      validation = {
        "message": "GET Token validated!",
        "success": true
      };
    }
  }
  Logger.log('Event Validation: ' + JSON.stringify(validation));
  return validation;
}

/**
 * Validates the event.token and adds the event to the message queue
 *
 * @param {Object} event the event object from the API call
 * 
 * @param {String} sender the sender of the event returned from parseSender(e)
 */
function processPost(event, sender, config) {
  var validation = validateEvent(event, config);
  var sendConf = config[sender.sender];
  if (validation.success) {
    var postData = {}
    if (event.postData.type === 'application/x-www-form-urlencoded' && 'payload' in event.parameter) {
      postData = JSON.parse(event.parameter.payload)
    }
    else {
      postData = JSON.parse(event.postData.contents);
    }
    if (sendConf.addToQueue) {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Queue");
      var tracker = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tracker");
      var dlq = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Dead Letters");
      var idRange = tracker.getRange(2, 1);
      var nextId = idRange.getValue() + 1;
      idRange.setValue(nextId);
      if (sender.matched) {
        Logger.log("Event validated! Adding event to Sheets MQ");
        sheet.appendRow([nextId, JSON.stringify(postData), "No", sender.sender]);
      }
      else {
        Logger.log("Sender not matched but event was validated! Adding full event to Dead Letters queue for inspection");
        dlq.appendRow([Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss:SSS Z'), nextId, JSON.stringify(event), JSON.stringify(postData), 'Unknown[Validated]']);
      }
    }
    else if (sender.matched) {
      if ('destinations' in sendConf) {
        Logger.log("Fanning out message from sender [" + sender.sender + "] to webhook recipients");
        var parsed = parseMessage(postData, sender, config);
        var i = 0;
        if ('Slack' in sendConf.destinations) {
          for (i = 0; i < sendConf.destinations.Slack.length; i++) {
            try {
              if (sender.format === 'slack') {
                sendSlackMsg(parsed.message, sendConf.destinations.Slack[i].webhook, parsed.username, parsed.iconUrl, sendConf.destinations.Slack[i].channel || parsed.channel, parsed.color, postData);
              }
              else {
                sendSlackMsg(parsed.message, sendConf.destinations.Slack[i].webhook, parsed.username, parsed.iconUrl, parsed.channel, parsed.color);
              }
            }
            catch (e) {
              err = (typeof e === 'string')
                    ? new Error(e)
                    : e;
              Logger.severe('%s: %s (line %s, file "%s"). Stack: "%s" . While processing %s.', err.name || '', err.message || '', err.lineNumber || '', err.fileName || '', err.stack || '', '');
              dlq.appendRow([Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss:SSS Z'), nextId, JSON.stringify(event), JSON.stringify(parsed), JSON.stringify(sender)]);
            }
          }
        }
        if ('GChat' in sendConf.destinations) {
          for (i = 0; i < sendConf.destinations.GChat.length; i++) {
            try {
              sendGChatMsg(parsed.message, sendConf.destinations.GChat[i], parsed.username, parsed.iconUrl);
            }
            catch (e) {
              var err = (typeof e === 'string')
                    ? new Error(e)
                    : e;
              Logger.severe('%s: %s (line %s, file "%s"). Stack: "%s" . While processing %s.', err.name || '', err.message || '', err.lineNumber || '', err.fileName || '', err.stack || '', '');
              dlq.appendRow([Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss:SSS Z'), nextId, JSON.stringify(event), JSON.stringify(parsed), JSON.stringify(sender)]);
            }
          }
        }
      }
      else {
        Logger.log("Sender [" + sender.sender + "] does not have the destinations property set on the config! Skipping.")
      }
    }
  }
  else {
    var err = new Error("POST request not validated! Adding to Dead Letters sheet for inspection")
    Logger.severe('%s: %s (line %s, file "%s"). Stack: "%s" . While processing %s.', err.name || '', err.message || '', err.lineNumber || '', err.fileName || '', err.stack || '', '');
    dlq.appendRow([Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss:SSS Z'), nextId, JSON.stringify(event), JSON.stringify(postData), 'Unknown[Not Validated]']);
  }
}

/**
 * Validates the event.token and adds the event to the message queue
 *
 * @param {Object} event the event object from the API call
 * 
 * @param {String} sender the sender of the event returned from parseSender(e)
 */
function processGet(event, config) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Queue");
  var validation = validateEvent(event, config);
  var curMaxRows = sheet.getMaxRows();
  if (validation.success) {
    var sourceType = (typeof event.parameters.source === 'undefined')
                      ? ['GChat']
                      : event.parameters.source;
    var maxRows = (typeof event.parameter.maxRows === 'undefined')
                      ? 1
                      : event.parameter.maxRows;
    Logger.log("GET request validated! Dequeueing up to [" + maxRows + "] unacked row(s) for source type(s) [" + sourceType.toString() + "]");
    if (curMaxRows > 1) {
      var eventsToReturn = [];
      var matchCount = 0;
      var rows = sheet.getRange(1, 1, curMaxRows, sheet.getMaxColumns()).getValues();
      var eventValue = null;
      for (var c = 0; c < curMaxRows; c++) {
        if (sourceType.indexOf(rows[c][3]) > -1) {
          if (rows[c][2] === 'No') {
            eventValue = (event.parameter.format == 'json')
                          ? JSON.parse(rows[c][1])
                          : rows[c][1];
            eventsToReturn.push({
              "Acked": rows[c][2],
              "Event": eventValue,
              "Id": rows[c][0],
              "Source": rows[c][3]
            });
          }
          if (event.parameter.dequeue != 'no') {
            sheet.deleteRow(c - matchCount + 1);
          }
          matchCount += 1;
          if (matchCount >= maxRows) {
            break;
          }
        }
      }
    }
    Logger.log("Returning [" + eventsToReturn.length + "] events from the queue matching source type(s) [" + sourceType.toString() + "]!");
    if (eventsToReturn.length === 0) {
      return {};
    }
    else {
      return eventsToReturn;
    }
  }
  else {
    var err = new Error("GET request not validated! Adding to Dead Letters sheet for inspection")
    Logger.severe('%s: %s (line %s, file "%s"). Stack: "%s" . While processing %s.', err.name || '', err.message || '', err.lineNumber || '', err.fileName || '', err.stack || '', '');
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Dead Letters").appendRow([Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss:SSS Z'), 'N/A', JSON.stringify(event), '{}', 'GET[Not Validated]']);
    throw err;
  }
}
