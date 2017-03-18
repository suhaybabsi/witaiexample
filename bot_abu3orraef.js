'use strict';

const facebook = require('./facebook-send');
const fs = require("fs");
const email_validator = require("email-validator");

const select_statements = {

    greetings: [
        "يا هلا والله",
        "وعليكم السلام",
        "وعليكم السلام ورحمة الله وبركاته",
        "مراحب",
        "مرحبتين",
        "أهلين !"
    ],
    greetings1: [
        "شو بقدر أخدمك ؟!",
        "تفضل حضرتك ! ..",
        "تفضل، شو بقدر أخدمك ؟",
        "إذا بتحب اسألني: شو بتعمل ؟"
    ],
    greetings2: [
        "اذا بدك تبدا من جديد اكتب انهي",
        "اذا بدك تبدا من جديد اكتب ابدأ"
    ]
};

const actions = {

    getBooksSuggestions(recipientId, { context, entities }) {

        const subject = firstEntityValue(entities, 'ar_suggest_subject');
        
        console.log("Books requested", subject);
        if (subject) {

            facebook.fbMessage(recipientId, "وهاي أحلى كتاب علشانك عن ال" + subject + ":\nTo Be or to Have _ by Erich Fromm")
                .then(() => null)
                .catch((err) => {
                    console.error(
                        'Oops! An error occurred while forwarding the response to',
                        err.stack || err
                    );
                });

            context.success = true;
            delete context.missing;

        } else {

            context.missing = true;
            delete context.success;
        }

        return context;
    },

    validateEmail(recipientId, { context, entities }){

        let email = firstEntityValue(entities, 'email');

        if(email_validator.validate(email)){

            context.valid = true;
            context.email = email;
            delete context.notvalid;
        }else{

            context.notvalid = true;
            delete context.valid;
            delete context.email;
        }

        console.log("Email validated !!");
        return context;
    },

    searchForBook(recipientId, { context, entities }){

        let book = firstEntityValue(entities, 'ar_suggest_book');
        console.log("Book name", book);

        if(book){

            let list = filterBooksList(book);

            console.log((list.length > 0) ? "Book found" : "Book not found !");
            context[(list.length > 0) ? "found" : "notfound"] = true;
            context.book = book;
            delete context.missing;

        }else{

            context.missing = true;
            delete context.book;
            delete context.found;
            delete context.notfound;
        }

        return context;
    }
}

const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};

function acceptsAction(action) {
    let actionDoer = actions[action];
    return actionDoer !== null;
}

function performAction(action, recipientId, entities, context) {
    let doer = actions[action];
    doer(recipientId, { context, entities });
}

function hasStatements(res) {

    if (res.indexOf("select_") > -1) {

        let arrayName = res.replace("select_", "");
        let array = select_statements[arrayName];
        return array && array.length > 0;

    } else {

        return false;
    }
}

function selectStatement(res) {
    let arrayName = res.replace("select_", "");
    let array = select_statements[arrayName];

    let randI = Math.floor(Math.random() * array.length);
    return array[randI];
}


function filterBooksList(query) {

    let list = JSON.parse(fs.readFileSync(__dirname + '/public/list_history.json', 'utf8'));
    list = list.concat(JSON.parse(fs.readFileSync(__dirname + '/public/list_adab.json', 'utf8')));
    list = list.concat(JSON.parse(fs.readFileSync(__dirname + '/public/list_fikr.json', 'utf8')));
    list = list.concat(JSON.parse(fs.readFileSync(__dirname + '/public/list_history.json', 'utf8')));
    list = list.concat(JSON.parse(fs.readFileSync(__dirname + '/public/list_philosophy.json', 'utf8')));
    list = list.concat(JSON.parse(fs.readFileSync(__dirname + '/public/list_psychology.json', 'utf8')));
    list = list.concat(JSON.parse(fs.readFileSync(__dirname + '/public/list_random.json', 'utf8')));

    let foundList = list.filter(item => {
        return item.indexOf(query) > -1;
    });

    console.log("Books count", list.length);
    console.log("Books found", foundList.length);

    return foundList;
}

module.exports = {acceptsAction, performAction, hasStatements, selectStatement};