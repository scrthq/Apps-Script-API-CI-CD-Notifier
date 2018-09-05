function sendSlackMsg(message, webhook, username, iconUrl, channel, color, existingPayload) {
    var payload = {};
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
    } else {
        payload = {
            "attachments": [{
                "color": color || null,
                "fallback": message,
                "mrkdwn_in": ["text"],
                "text": message
            }],
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

function sendGChatMsg(message, webhook, includeUserCard, messageHtml, username, iconUrl) {
    var payload = { "fallbackText": message };
    if (includeUserCard === true) {
        if (typeof username !== 'undefined') {
            payload.cards = [{ "header": { "title": username } }];
            if (typeof iconUrl !== 'undefined') {
                payload.cards[0].header.imageUrl = iconUrl;
                payload.cards[0].header.imageStyle = 'IMAGE';
            }
        }
        if (typeof messageHtml !== 'undefined' && messageHtml !== null) {
            if (!('cards' in payload)) {
                payload.cards = [{}];
            }
            payload.cards[0].sections = [{ "widgets": [{ "textParagraph": { "text": messageHtml } }] }];
        } else {
            payload.text = message;
        }
    } else {
        payload.text = message;
    }
    var options = {
        'contentType': 'application/json',
        'method': 'post',
        'payload': JSON.stringify(payload)
    };
    return UrlFetchApp.fetch(webhook, options);
}

function parseMessage(postData, sender, config) {
    try {
        var parsed = {
            "channel": null,
            "color": null,
            "iconUrl": null,
            "message": null,
            "messageHtml": null,
            "payload": null,
            "username": null
        };
        Logger.log('Parsing message from [' + sender.sender + '] with format [' + sender.format + ']');
        switch (sender.format) {
            case 'raw':
                switch (sender.sender) {
                    case 'AppVeyor':
                        parsed.username = 'AppVeyor CI (GAS)';
                        parsed.iconUrl = config.AppVeyor.icon || 'https://ci.appveyor.com/assets/images/appveyor-blue-144.png';
                        parsed.color = (postData.eventName.indexOf('success') > -1) ?
                            '#41aa58' :
                            '#ffff00';
                        parsed.message = "<" + postData.eventData.buildUrl + "|[" + postData.eventData.projectName + "] AppVeyor Build " + postData.eventData.buildVersion + " " + postData.eventData.status + ">\r\nCommit <" + postData.eventData.commitUrl + "|" + postData.eventData.commitId + "> by " + postData.eventData.commitAuthor + " on " + postData.eventData.commitDate + ": _" + postData.eventData.commitMessage + "_";
                        parsed.messageHtml = '<a href="' + postData.eventData.buildUrl + '">[' + postData.eventData.projectName + ']</br></br>AppVeyor Build ' + postData.eventData.buildVersion + ' ' + postData.eventData.status + '</a><br>Commit <a href="' + postData.eventData.commitUrl + '">' + postData.eventData.commitId + '</a> by ' + postData.eventData.commitAuthor + ' on ' + postData.eventData.commitDate + ': <i>' + postData.eventData.commitMessage + '</i>';
                        break;
                    case 'GitHub':
                        parsed.username = 'GitHub (GAS)';
                        parsed.iconUrl = config.GitHub.icon || 'https://assets-cdn.github.com/images/modules/logos_page/GitHub-Mark.png';
                        if ('pusher' in postData) {
                            parsed.message = postData.pusher.name + " has pushed to GitHub repo <" + postData.repository.html_url + "|" + postData.repository.full_name + ">\n<" + postData.compare + "|Compare>";
                            parsed.messageHtml = postData.pusher.name + ' has pushed to GitHub repo <a href="' + postData.repository.html_url + '">' + postData.repository.full_name + '</a><br><a href="' + postData.compare + '">Compare</a>';
                            parsed.color = '#1bcee2';
                        } else if ('description' in postData && (postData.description.indexOf('build') > -1 || postData.description.indexOf('running') > -1 || postData.description.indexOf('tests') > -1)) {
                            parsed.message = "GitHub Build Update: <" + postData.target_url + "|" + postData.description + "> for repo <" + postData.repository.html_url + "|" + postData.repository.full_name + ">\nContext: _" + postData.context + "_";
                            parsed.messageHtml = 'GitHub Build Update: <a href="' + postData.target_url + '">' + postData.description + '</a> for repo <a href="' + postData.repository.html_url + '">' + postData.repository.full_name + "</a><br>Context: <i>" + postData.context + "</i>";
                            parsed.color = (postData.description.indexOf('passed') > -1 || postData.description.indexOf('succeeded') > -1) ?
                                '#41aa58' :
                                '#ff8040';
                        } else {
                            parsed.message = "GitHub Repo Update: <" + postData.target_url + "|" + postData.description + "> for repo <" + postData.repository.html_url + "|" + postData.repository.full_name + ">\nContext: _" + postData.context + "_";
                            parsed.messageHtml = 'GitHub Repo Update: <a href="' + postData.target_url + '">' + postData.description + '</a> for repo <a href="' + postData.repository.html_url + '">' + postData.repository.full_name + "</a><br>Context: <i>" + postData.context + "</i>";
                            parsed.color = '#959595';
                        }
                        break;
                    case 'TravisCI':
                        parsed.username = 'TravisCI (GAS)';
                        parsed.iconUrl = config.TravisCI.icon || 'https://www.ocadotechnology.com/wp-content/uploads/2018/02/TravisCI-Mascot-1.png';
                        parsed.color = (postData.result_message === 'Passed') ?
                            '#41aa58' :
                            '#ffff00';
                        parsed.message = "[<" + postData.compare_url + "|" + postData.repository.name + ">] <" + postData.build_url + "|TravisCI Build " + postData.number + "> status: *" + postData.status_message + "*";
                        parsed.messageHtml = '[<a href="' + postData.compare_url + '">' + postData.repository.name + '</a>]<br><a href="' + postData.build_url + '">TravisCI Build ' + postData.number + "</a> status: <b>" + postData.status_message + "</b>";
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
                    parsed.username = 'CircleCI (GAS)';
                    parsed.iconUrl = config.CircleCI.icon || 'https://static.brandfolder.com/circleci/logo/circleci-primary-logo.png';
                } else {
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
                    parsed.message = postData.text;
                } else if ('attachments' in postData && 'text' in postData.attachments[0] && postData.attachments[0].text !== null && postData.attachments[0].text.length > 0) {
                    parsed.message = postData.attachments[0].text;
                }
                break;
            default:
                break;
        }
        Logger.log('Message parsed: ' + JSON.stringify(parsed));
        return parsed;
    } catch (e) {
        var err = (typeof e === 'string') ?
            new Error(e) :
            e;
        Logger.severe('%s: %s (line %s, file "%s"). Stack: "%s" . While processing %s.', err.name || '', err.message || '', err.lineNumber || '', err.fileName || '', err.stack || '', '');
        throw err;
    }
}