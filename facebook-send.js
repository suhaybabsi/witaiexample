'use strict';

// ----------------------------------------------------------------------------
// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference

const FB_PAGE_TOKEN = "";

const fbSend = (bodyObj) => {
  const body = JSON.stringify(bodyObj);
  const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
  return fetch('https://graph.facebook.com/me/messages?' + qs, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
    .then(rsp => rsp.json())
    .then(json => {
      if (json.error && json.error.message) {
        throw new Error(json.error.message);
      }
      return json;
    });
};

const fbMarkSeen = (id) => {
  return fbSend({
    recipient: { id },
    sender_action: "mark_seen"
  });
};

const fbTypingOn = (id) => {
  return fbSend({
    recipient: { id },
    sender_action: "typing_on"
  });
};

const fbTypingOff = (id) => {
  return fbSend({
    recipient: { id },
    sender_action: "typing_off"
  });
};

const fbMessage = (id, text, q_replies) => {

  let quick_replies = null;
  if (q_replies) {

    quick_replies = q_replies.map(reply => {
      return {
        "content_type": "text",
        "title": reply,
        "payload": reply
      };
    });
  }

  return fbSend({
    recipient: { id },
    message: { text, quick_replies },
  });
};

module.exports = { fbSend, fbMarkSeen, fbMessage,fbTypingOff, fbTypingOn };