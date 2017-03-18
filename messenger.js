require('babel-register');

'use strict';

// Messenger API integration example
// We assume you have:
// * a Wit.ai bot setup (https://wit.ai/docs/quickstart)
// * a Messenger Platform setup (https://developers.facebook.com/docs/messenger-platform/quickstart)
// You need to `npm install` the following dependencies: body-parser, express, request.
//
// 1. npm install body-parser express request
// 2. Download and install ngrok from https://ngrok.com/download
// 3. ./ngrok http 8445
// 4. WIT_TOKEN=your_access_token FB_APP_SECRET=your_app_secret FB_PAGE_TOKEN=your_page_token node examples/messenger.js
// 5. Subscribe your page to the Webhooks using verify_token and `https://<your_ngrok_io>/webhook` as callback URL.
// 6. Talk to your bot on Messenger!

const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const request = require('request');
const facebook = require('./facebook-send');
const targetbot = require('./bot_abu3orraef');

import { Wit, interactive, log, WitContext } from "node-wit";

// Webserver parameter
const PORT = process.env.PORT || 8445;

// Wit.ai parameters
const WIT_TOKEN = "";

// Messenger API parameters
const FB_APP_SECRET = "";

let FB_VERIFY_TOKEN = "";
/*
crypto.randomBytes(8, (err, buff) => {
  if (err) throw err;
  FB_VERIFY_TOKEN = buff.toString('hex');
  console.log(`/webhook will accept the Verify Token "${FB_VERIFY_TOKEN}"`);
});
*/
// ----------------------------------------------------------------------------
// Wit.ai bot specific code
// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
var sessions = {};
const findOrCreateSession = (fbid) => {
  let sessionId;
  // Let's see if we already have a session for the user fbid
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      // Yep, got it!
      sessionId = k;
    }
  });
  if (!sessionId) {
    // No session found for user fbid, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = { fbid: fbid, context: {} };
  }
  return sessionId;
};

// Our bot actions
const actions = {
  send({ sessionId }, { text }) {
    console.log("Send to user", text);
  }
};

// Setting up our bot
const wit = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.INFO)
});

// Starting our webserver and putting it all together
const app = express();
app.use(({ method, url }, rsp, next) => {
  rsp.on('finish', () => {
    console.log(`${rsp.statusCode} ${method} ${url}`);
  });
  next();
});
app.use(bodyParser.json({ verify: verifyRequestSignature }));

// Webhook setup
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

// Message handler
app.post('/webhook', (req, res) => {
  // Parse the Messenger payload
  // See the Webhook reference
  // https://developers.facebook.com/docs/messenger-platform/webhook-reference
  const data = req.body;
  if (data.object === 'page') {
    data.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if (event.message && !event.message.is_echo) {
          // Yay! We got a new message!
          // We retrieve the Facebook user ID of the sender
          const sender = event.sender.id;

          // We retrieve the user's current session, or create one if it doesn't exist
          // This is needed for our bot to figure out the conversation history
          const sessionId = findOrCreateSession(sender);

          // We retrieve the message content
          const { text, attachments } = event.message;

          if (attachments) {
            // We received an attachment
            // Let's reply with an automatic message
            facebook.fbMessage(sender, 'Sorry I can only process text messages for now.')
              .catch(console.error);
          } else if (text) {
            // We received a text message
            // We read the message
            facebook.fbMarkSeen(sender);

            // Let's forward the message to the Wit.ai Bot Engine
            // This will run all actions until our bot has nothing left to do

            let context = sessions[sessionId].context || new WitContext();
            sessions[sessionId].context = context;

            console.log(context);
            converseWit(sender, sessionId, text, context);
          }
        } else {
          console.log('received event'/*, JSON.stringify(event)*/);
        }
      });
    });
  }
  res.sendStatus(200);
});

function converseWit(sender, sessionId, text, context) {

  facebook.fbTypingOn(sender);
  wit.converse(sessionId, text, context)
    .then((response) => {

      console.log(response);
      console.log(response.entities);
      console.log(context);

      const { type, action, entities, confidence } = response;
      const recipientId = sessions[sessionId].fbid;

      if (recipientId) {

        if (type === "action") {

          if (targetbot.hasStatements(action)) {

            facebook.fbMessage(recipientId, targetbot.selectStatement(action))
              .then(() => null)
              .catch((err) => {
                console.error(
                  'Oops! An error occurred while forwarding the response to',
                  err.stack || err
                );
              });

            context.select = true;
            converseWit(sender, sessionId, null, context);

          } else if (targetbot.acceptsAction(action)) {

            targetbot.performAction(action, recipientId, entities, context);
            converseWit(sender, sessionId, null, context);

          } else {

            failureMessage(recipientId);
          }

        } else if (type === "msg") {

          let { msg, quickreplies } = response;
          facebook.fbMessage(recipientId, msg, quickreplies);
          if (context.select || entities) {
            converseWit(sender, sessionId, null, context);
          }

        } else if (type === "stop" && !entities) {

          context = {};
          sessions[sessionId].context = context;

          console.log(sessions[sessionId]);
          console.log("End story !!");
          facebook.fbTypingOff(sender);

        } else if (type === "stop" && entities) {

          console.log("Wait for user resonse");
          facebook.fbTypingOff(sender);
          
        } else {

          failureMessage(recipientId);
        }

      } else {
        failureMessage(recipientId);
        console.error('Oops! Couldn\'t find user for session:', sessionId);
      }

      // Giving the wheel back to our bot
      return Promise.resolve();
    });
}

function failureMessage(rid) {
  facebook.fbMessage(rid, ":( آسف.. شكله في مشاكل.. ان شاء الله بتنحل قريباً")
    .then(() => null)
    .catch((err) => {
      console.error(
        'Oops! An error occurred while forwarding the response to',
        err.stack || err
      );
    });
}

/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', FB_APP_SECRET)
      .update(buf)
      .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

app.listen(PORT);
console.log('Listening on :' + PORT + '...');
