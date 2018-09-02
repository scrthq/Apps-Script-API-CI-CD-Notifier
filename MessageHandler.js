function sendSlackMsg(message, webhook, username, iconUrl, channel, color) {
  var payload = {
    "attachments": [
      {
        "color": color || null,
        "fallback": message,
        "text": message
      }
    ],
    "channel": channel || null,
    "icon_url": iconUrl || null,
    "mrkdwn_in": ["text"],
    "username": username || null
  };
  var options = {
    'method': 'post',
    'payload': JSON.stringify(payload)
  };
  return UrlFetchApp.fetch(webhook, options);
}

function sendGChatMsg(message, webhook) {
  var payload = {
    "fallbackText": message,
    "text": message
  };
  var options = {
    'method': 'post',
    'payload': JSON.stringify(payload)
  };
  return UrlFetchApp.fetch(webhook, options);
}

function parseMessage(postData, sender) {
  var parsed = {
    "channel": null,
    "color": null,
    "iconUrl": null,
    "message": null,
    "username": null
  };
  switch (sender.format) {
    case 'raw':
      switch (sender.sender) {
        case 'AppVeyor':
          parsed.username = 'AppVeyor CI (via GAS)'
          parsed.iconUrl = 'https://ci.appveyor.com/assets/images/appveyor-blue-144.png'
          parsed.color = (postData.eventName === 'build_success')
                          ? '#5FE35F'
                          : '#ffff00'
            parsed.message = "<" + postData.eventData.buildUrl + "|[" + postData.eventData.projectName + "] Build " + postData.eventData.buildVersion + " " + postData.eventData.status + ">\r\nCommit <" + postData.eventData.commitUrl + "|" + postData.eventData.commitId + "> by <mailto:" + postData.eventData.commitAuthorEmail + "|" + postData.eventData.commitAuthor + "> on " + postData.eventData.commitDate + ": _" + postData.eventData.commitMessage + "_"
          break;

        case 'GitHub':
          
          break;

        case 'TravisCI':

          break;

        case 'VSTS':

          break;

        default:
          break;
      }
      break;
    case 'slack':
      parsed.channel = postData.channel || null;
      parsed.color = postData.attachments[0].color || null;
      parsed.iconUrl = postData.icon_url || null;
      parsed.message = postData.attachments[0].text || null;
      parsed.username = postData.username || null;
      break;
    default:
      break;
  }
  return parsed;
}