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
var app = express();
var path    = require("path");
var CronJob = require('cron').CronJob;
var sentiment = require('sentiment');

var Database = require('./Database');
var database = new Database();

//These keys are tied w/ the CS275_Group1 accont and are needed to access the api
var twitter = new Twitter({
	consumer_key: 'p7Rn3R9I37sbNJEFOSl58nXOv',
	consumer_secret: 'x8M8A63ow9mN3vM9TTaTEhtKywizMrxpNqWeN8QMT8jHfAk6AV',
	access_token_key: '833706426908475394-dclzYhhk0t6ZRMRpboj2bYnF7lvHAzy',
	access_token_secret: 'tYtMO29K7wuJOtFhc9rYioFnX7DmWdJPFvKIaIiFSiq6j'
});

var checkTrump = new CronJob('* 00 * * * *', function() {
  /*
   * Runs every hour at 00:00
   */
	var params = {screen_name: 'realDonaldTrump'};


	twitter.get('statuses/user_timeline',params,function(error,tweets,response){
		if(!error){
			console.log('Connection established...retrieving tweets');
			var length = tweets.length;
			for(var i = 0; i < length; i++){
				var tweet = {tweet_id:tweets[i].id,text:tweets[i].text};
				(function(scopedTweet){
					database.select('trump','tweet_id='+scopedTweet["tweet_id"],null,null,function(row){
					if(row.length == 0){//this means we don't have this tweet in the db
						database.insert('trump',scopedTweet);
						//console.log(scopedTweet)
					}
					else{
						console.log("Already added this tweet");
					}
				});
				})(tweet);
			}
		}
		else{
			console.log("twitter error");
		}
	});
  }, function () {
    /* This function is executed when the job stops */
  },
  true, /* Start the job right now */
  'America/New_York' /* Time zone of this job. */
);

var checkForReplies = new CronJob('00 * * * * *', function() {
  /*
   * Runs every 10 minutes
   */
   var params = {screen_name: 'realDonaldTrump'};
   twitter.get('search/tweets.json?q=to:realDonaldTrump&count=100',params,function(error,tweets,response){
		if(!error){
			var length = tweets.statuses.length;
			console.log("got tweets:" + length);
			for(var i = 0; i < length; i++){
				if(tweets.statuses[i].in_reply_to_status_id!==null){
					var cleanedTweet =  tweets.statuses[i].text.replace(/[^A-Za-z 0-9 \.,\?""!@#\$%\^&\*\(\)-_=\+;:<>\/\\\|\}\{\[\]`~]*/g, '');
					var extraCleanTweet = cleanedTweet.replace(/[#|@][a-zA-Z]+/g,"");
					var r1 = sentiment(extraCleanTweet);
					var tweet = {tweet_id:tweets.statuses[i].id,
								trump_tweet_id:tweets.statuses[i].in_reply_to_status_id,
								text:cleanedTweet,
								sed:r1["score"]};
					(function(scopedTweet){
					database.select('replies','tweet_id='+scopedTweet["tweet_id"],null,null,function(row){
							if(row.length == 0){//this means we don't have this tweet in the db
								database.insert('replies',scopedTweet);
								//console.log(scopedTweet)
							}
							else{
								console.log("Already added this tweet");
							}
						});
					})(tweet);
				}
			}
			//console.log(tweets);
		}
		else{
			console.log("twitter error");
			console.log(error)
		}
	});
  }, function () {
    /* This function is executed when the job stops */
  },
  true, /* Start the job right now */
  'America/New_York' /* Time zone of this job. */
);

app.use('/static', express.static('public'));

app.get('/',function(req,res){
	res.sendFile(path.join(__dirname+'/index.html'));
});

app.get('/trumpTweet',function(req,res){
	if(isNaN(req.query.page)==false){
		limit1 = (parseInt(req.query.page)-1)*10;
		limit2 = 10;
		database.select('trump',null,limit1,limit2,function(row){
			res.send(row);
		});
	}
	else{
		res.send({error:"invalid request"});
	}
});

app.get('/replies',function(req,res){
	if(isNaN(req.query.page)==false){
		limit1 = (parseInt(req.query.page)-1)*10;
		limit2 = 10;
		database.select('replies',"trump_tweet_id="+req.query.tweet_id,limit1,limit2,function(row){
			res.send(row);
		});
	}
	else{
		res.send({error:"invalid request"});
	}
});

app.listen(8080,function(){
	console.log("Server Running…");
});
