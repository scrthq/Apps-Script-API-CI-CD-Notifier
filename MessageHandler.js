function sendSlackMsg(message, webhook, username, iconUrl, channel, color, existingPayload) {
  var payload = {}
  if (typeof existingPayload !== 'undefined') {
    payload = existingPayload;
    if (username !== null && (payload.username === null || typeof payload.username === 'undefined')) {
      payload.username = username;
    }
    if (iconUrl !== null && (payload.icon_url === null || typeof payload.icon_url === 'undefined')) {
      payload.icon_url = iconUrl;
    }
    if (channel !== null && (payload.channel === null || typeof payload.channel === 'undefined')) {
      payload.channel = channel;
    }
    if (color !== null && 'attachments' in payload && (payload.attachments[0].color === null || typeof payload.attachments[0].color === 'undefined')) {
      payload.attachments[0].color = color;
    }
  }
  else {
    payload = {
      "attachments": [
        {
          "color": color || null,
          "fallback": message,
          "mrkdwn_in": ["text"],
          "text": message
        }
      ],
      "channel": channel || null,
      "icon_url": iconUrl || null,
      "username": username || null
    };
  }
  var options = {
    'contentType': 'application/json',
    'method': 'post',
    'payload': JSON.stringify(payload)
  };
  return UrlFetchApp.fetch(webhook, options);
}

function sendGChatMsg(message, webhook, includeUserCard, username, iconUrl) {
  var payload = {
    "fallbackText": message,
    "text": message
  };
  if (typeof username !== 'undefined' && includeUserCard) {
    payload.cards = [{ "header": { "title": username } }];
    if (typeof iconUrl !== 'undefined') {
      payload.cards[0].header.imageUrl = iconUrl;
      payload.cards[0].header.imageStyle = 'IMAGE';
    }
  }
  var options = {
    'contentType': 'application/json',
    'method': 'post',
    'payload': JSON.stringify(payload)
  };
  return UrlFetchApp.fetch(webhook, options);
}

function parseMessage(postData, sender, config) {
  var parsed = {
    "channel": null,
    "color": null,
    "iconUrl": null,
    "message": null,
    "payload": null,
    "username": null
  };
  Logger.log('Parsing message from [' + sender.sender + '] with format [' + sender.format + ']');
  switch (sender.format) {
    case 'raw':
      switch (sender.sender) {
        case 'AppVeyor':
          parsed.username = 'AppVeyor CI (GAS)'
          parsed.iconUrl = config.AppVeyor.icon || 'https://ci.appveyor.com/assets/images/appveyor-blue-144.png'
          parsed.color = (postData.eventName.indexOf('success') > -1)
                          ? '#41aa58'
                          : '#ffff00'
          parsed.message = "<" + postData.eventData.buildUrl + "|[" + postData.eventData.projectName + "] Build " + postData.eventData.buildVersion + " " + postData.eventData.status + ">\r\nCommit <" + postData.eventData.commitUrl + "|" + postData.eventData.commitId + "> by " + postData.eventData.commitAuthor + " on " + postData.eventData.commitDate + ": _" + postData.eventData.commitMessage + "_"
          break;
        case 'GitHub':
          parsed.username = 'GitHub (GAS)'
          parsed.iconUrl = config.GitHub.icon || 'https://static.brandfolder.com/circleci/logo/circleci-primary-logo.png'
          if ('pusher' in postData) {
            parsed.message = postData.pusher.name + " has pushed to GitHub repo <" + postData.repository.html_url + "|" + postData.repository.full_name + ">\n<" + postData.compare + "|Compare>"
            parsed.color = '#1bcee2'
          }
          else if ('description' in postData && postData.description.indexOf('build') > -1) {
            parsed.message = "GitHub Build Update: <" + postData.target_url + "|" + postData.description + "> for repo <" + postData.repository.html_url + "|" + postData.repository.full_name + ">\nContext: _" + postData.context + "_"
            parsed.color = '#ff8040'
          }
          else {
            parsed.message = "GitHub Repo Update: <" + postData.target_url + "|" + postData.description + "> for repo <" + postData.repository.html_url + "|" + postData.repository.full_name + ">\nContext: _" + postData.context + "_"
            parsed.color = '#959595'
          }
          break;
        case 'TravisCI':
          parsed.username = 'TravisCI (GAS)'
          parsed.iconUrl = config.TravisCI.icon || 'https://www.ocadotechnology.com/wp-content/uploads/2018/02/TravisCI-Mascot-1.png'
          parsed.color = (postData.result_message === 'Passed')
                          ? '#41aa58'
                          : '#ffff00'
          parsed.message = "[<" + postData.compare_url + "|" + postData.repository.name + ">] <" + postData.build_url + "|TravisCI Build " + postData.number + "> status: *" + postData.status_message + "*"
          break;
        case 'VSTS':
          break;
        default:
          break;
      }
      break;
    case 'slack':
      parsed.payload = postData;
      if (sender.sender === 'CircleCI') {
        parsed.username = 'CircleCI (GAS)'
        parsed.iconUrl = config.CircleCI.icon || 'https://static.brandfolder.com/circleci/logo/circleci-primary-logo.png'
      }
      else {
        parsed.username = postData.username || null;
        parsed.iconUrl = postData.icon_url || null;
      }
      if ('channel' in postData && postData.channel !== null && postData.channel.length > 0) {
        parsed.channel = postData.channel;
      }
      if ('attachments' in postData && 'color' in postData.attachments[0] && postData.attachments[0].color !== null && postData.attachments[0].color.length > 0) {
        parsed.color = postData.attachments[0].color;
      }
      if ('text' in postData && postData.text.length > 0) {
        parsed.message = postData.text
      }
      else if ('attachments' in postData && 'text' in postData.attachments[0] && postData.attachments[0].text !== null && postData.attachments[0].text.length > 0) {
        parsed.message = postData.attachments[0].text;
      }
      break;
    default:
      break;
  }
  Logger.log('Message parsed: ' + JSON.stringify(parsed));
  return parsed;
}