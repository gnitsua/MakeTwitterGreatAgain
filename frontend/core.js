#!/usr/bin/env /usr/bin node
/*
* CS 275 Group 1
* Written by Brandon Tran
*
* Core.js: This program is intended to mine text 
* using the twitter stream API. 
*/

var Twitter = require('twitter');
var http = require('http');
var express = require('express');
var bodyParser = require("body-parser");
var app = express();
var path = require("path");
require('dotenv').config();
var events = require('events');
var eventEmitter = new events.EventEmitter();

debug = false;
//check for the debug flag
if (process.argv.length > 2) {
  arg = process.argv[2];

  if (arg.split('--')[1] == 'debug') {
    debug = true;
  }

}

app.use('/static', express.static('static'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var Database = require('./Database');
var database = new Database();

if (debug == true) {
  require('./training').init(app, database)
}

//These keys are tied w/ the CS275_Group1 accont and are needed to access the api
var twitter = new Twitter({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token_key: process.env.ACCESS_TOKEN_KEY,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET
});

app.use('/static', express.static('public'));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/about.html', function (req,res) {
  res.sendFile(path.join(__dirname + '/about.html'));
})

app.get('/trumpTweet', function (req, res) {
  if (isNaN(req.query.page) === false) {
    limit1 = (parseInt(req.query.page) - 1) * 10;
    limit2 = 10;
    var params = { screen_name: 'realDonaldTrump', count: 10, include_rts: false, tweet_mode: "extended" };
    twitter.get('statuses/user_timeline', params, function (error, tweets, response) {
      if (!error) {
        res.send(tweets);
      }
      else {
        console.log("twitter error");
      }
    });
  }
  else {
    res.send({ error: "invalid request" });
  }
});
app.get('/replies', function (req, res) {
  if (isNaN(req.query.page) === false && isNaN(req.query.tweet_id) === false) {
    limit1 = (parseInt(req.query.page) - 1) * 100;
    limit2 = 100;
    database.count('replies',"in_reply_to_status_id=" + parseInt(req.query.tweet_id),function(count){
      database.select('replies', "in_reply_to_status_id=" + parseInt(req.query.tweet_id), 'id', limit1, limit2, function (row) {
        console.log(count);
        res.send({data:row,quota_max:count[0]["count"]});
      });
    })
  }
  else {
    res.status(400).send({ error: "invalid request" });
  }
});
app.get('/sentiment', function(req, res){
  if (isNaN(req.query.tweet_id) === false) {
    database.count('replies',"in_reply_to_status_id=" + parseInt(req.query.tweet_id) + " AND sentiment > 0",function (positive_tweets) {
      database.count('replies',"in_reply_to_status_id=" + parseInt(req.query.tweet_id),function (total) {
        res.send({sentiment:(positive_tweets[0]["count"]/total[0]["count"])*100.0});
      });
    });
  }
  else {
    res.status(400).send({ error: "invalid request" });
  }
});


app.listen(process.env.PORT, function () {
  console.log("Server Running at " + process.env.PORT + " debug is " + debug + "…");
});

