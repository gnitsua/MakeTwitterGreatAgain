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
var path    = require("path");
var CronJob = require('cron').CronJob;
var sentiment = require('sentiment');
var Sentimental = require('Sentimental');
require('dotenv').config();
var events = require('events');
var eventEmitter = new events.EventEmitter();

app.use('/static', express.static('static'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var Database = require('./Database');
var database = new Database();

//These keys are tied w/ the CS275_Group1 accont and are needed to access the api
var twitter = new Twitter({
	consumer_key: process.env.CONSUMER_KEY,
	consumer_secret: process.env.CONSUMER_SECRET,
	access_token_key: process.env.ACCESS_TOKEN_KEY,
	access_token_secret: process.env.ACCESS_TOKEN_SECRET
});



//Functions the server does
function cleanDatabase(){
	console.log('Cleaning');
	database.select('trump',null,10,100,function(row){
		var length = row.length;
		for(var i = 0; i < length; i++){
			var tweet = {tweet_id:row[i].tweet_id,text:row[i].text};
			(function(scopedTweet){
				console.log('should delete '+ tweet.tweet_id)
				database.delete('replies','trump_tweet_id='+tweet.tweet_id,function(){
					console.log("deleted all replies for tweet: "+tweet.tweet_id);
					database.delete('trump','tweet_id='+tweet.tweet_id,function(){
						console.log('deleted trump tweet: '+tweet.tweet_id);
					});
				});
			})(tweet);
		}
	});
}

function checkTrump(){
	var params = {screen_name: 'realDonaldTrump'};
	twitter.get('statuses/user_timeline',params,function(error,tweets,response){
		if(!error){
			console.log('Retrieving trump tweets');
			var length = tweets.length;
			for(var i = 0; i < length; i++){
				var tweet = {tweet_id:tweets[i].id,text:tweets[i].text};
				(function(scopedTweet){
					database.select('trump','tweet_id='+scopedTweet["tweet_id"],null,null,null,function(row){
					if(row.length == 0){//this means we don't have this tweet in the db
						database.insert('trump',scopedTweet);//TODO: potential issue if the tweet contains characters that aren't supported by mysql
						eventEmitter.emit('gotTrumpTweet',scopedTweet);
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
}

function checkReplies(){
	var params = {screen_name: 'realDonaldTrump'};
   twitter.get('search/tweets.json?q=to:realDonaldTrump&count=100',params,function(error,tweets,response){
		if(!error){
			var length = tweets.statuses.length;
			console.log("got tweets:" + length);
			for(var i = 0; i < length; i++){
				if(tweets.statuses[i].in_reply_to_status_id!==null){
					var cleanedTweet =  tweets.statuses[i].text.replace(/[^A-Za-z 0-9 \.,\?""!@#\$%\^&\*\(\)-_=\+;:<>\/\\\|\}\{\[\]`~]*/g, '');
					var tweet = {tweet_id:tweets.statuses[i].id,
								trump_tweet_id:tweets.statuses[i].in_reply_to_status_id,
								text:cleanedTweet};
					(function(scopedTweet){
						database.select('replies','tweet_id='+scopedTweet["tweet_id"],'tweet_id',null,null,function(row){
							if(row.length == 0){//this means we don't have this tweet in the db
								database.select('trump',"tweet_id="+scopedTweet.trump_tweet_id,'tweet_id',null,null,function(trump_tweets){
									if(trump_tweets.length != 0){//if ==0 then this tweet is not responding to a tweet we have
										database.insert('replies',scopedTweet,function(){//insert the reply into the repliestable
											eventEmitter.emit('newReply',scopedTweet);
										});
									}
								});
								
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
}

function calculateSed(tweet_id){
	database.select('replies','tweet_id='+tweet_id,null,null,null,function(row){
		if(row.length>1){//this should never happen
			Console.log("129: Do we have duplicate replies?");
		}
		var tweet = row[0];
		var extraCleanTweet = tweet.text.replace(/[#|@][a-zA-Z]+/g,"");
		var r1 = sentiment(extraCleanTweet);
		if(r1["positive"].length < 1 &&r1["negative"].length < 1){//we didn't get any good words so just don't count this one
			r1["score"] = null;
		}

		var r2 = Sentimental.analyze(extraCleanTweet);

		if(r2["positive"]["words"].length < 1  && r2["negative"]["words"].length < 1){
			r2["score"] = null;
		}

		if(r1["score"] == null){
			sed = r2["score"];
		}
		else if(r2["score"] == null){
			sed = r1["score"];
		}
		else{
			sed = (parseInt(r1["score"])+parseInt(r1["score"]))/2//start with a 50% average
		}
		database.update('replies','sed='+r1["score"],'tweet_id='+tweet_id,function(){
			eventEmitter.emit('newSedDataForTrumpTweet',tweet.trump_tweet_id);
		});
		database.update('replies','descriptor=\''+JSON.stringify({"semtiment":r1,"Sentimental":r2})+'\'','tweet_id='+tweet_id);
	});
	
	
}

function calculateTrumpSedAverage(trump_tweet_id){
	//update the trump average by counting the number of trump tweets and then adding to the average
	console.log("trump sed average")
	database.average('replies','trump_tweet_id='+trump_tweet_id,function(row){
		console.log("trump_tweet_id: " + trump_tweet_id + " sed: "+row[0].average);
		database.update('trump','sed='+row[0].average,'tweet_id='+trump_tweet_id);
	});
	database.count('replies','trump_tweet_id='+trump_tweet_id,function(row){
		database.update('trump','replies='+row[0].count,'tweet_id='+trump_tweet_id);
	});
}

//Event listeners
eventEmitter.on('timeToGetTrumpTweet',function(){
	checkTrump();
});
eventEmitter.on('cleanUpTime',function(){
	cleanDatabase();
})
eventEmitter.on('gotTrumpTweet',function(){
	checkReplies();
});
eventEmitter.on('newReply',function(tweet){
	calculateSed(tweet["tweet_id"]);
});
eventEmitter.on('newSedDataForTrumpTweet',function(trump_tweet_id){
	calculateTrumpSedAverage(trump_tweet_id);
});

var topOfTheHour = new CronJob('00 00 * * * *', function() {
  /*
   * Runs every hour at 00:00
   */
	eventEmitter.emit('timeToGetTrumpTweet');
  }, function () {
    /* This function is executed when the job stops */
    eventEmitter.emit('cleanUpTime');
  },
  true, /* Start the job right now */
  'America/New_York' /* Time zone of this job. */
);

var fiveMinutes = new CronJob('00 5-55/5 * * * *', function() {
  /*
   * Runs every 10 minutes '00 5-55/5 * * * *'
   */
   console.log('five minutes')
   checkReplies();
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
		database.select('trump',null,'tweet_id',limit1,limit2,function(row){
			res.send(row);
		});
	}
	else{
		res.send({error:"invalid request"});
	}
});

app.get('/replies',function(req,res){
	if(isNaN(req.query.page)==false){
		limit1 = (parseInt(req.query.page)-1)*100;
		limit2 = 100;
		database.select('replies',"trump_tweet_id="+parseInt(req.query.tweet_id),'tweet_id',limit1,limit2,function(row){
			res.send(row);
		});
	}
	else{
		res.send({error:"invalid request"});
	}
});

app.post('/train',function(req,res){
	console.log(req.body)
	if(isNaN(req.body.tweet_id)==false&&isNaN(req.body.sed_training)==false){
		database.update('replies','sed_training='+parseInt(req.body.sed_training),'tweet_id='+parseInt(req.body.tweet_id),function(){
			res.sendStatus(200);
		})
	}
	else{
		res.send({error:"invalid request"});
	}
});

app.listen(process.env.PORT,function(){
	console.log("Server Running at "+process.env.PORT+"…");
});
