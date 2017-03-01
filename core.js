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
var app = express();
var path    = require("path");
var CronJob = require('cron').CronJob;
var sentiment = require('sentiment');
require('dotenv').config()

var Database = require('./Database');
var database = new Database();

//These keys are tied w/ the CS275_Group1 accont and are needed to access the api
var twitter = new Twitter({
	consumer_key: process.env.CONSUMER_KEY,
	consumer_secret: process.env.CONSUMER_SECRET,
	access_token_key: process.env.ACCESS_TOKEN_KEY,
	access_token_secret: process.env.ACCESS_TOKEN_SECRET
});

var clean = new CronJob('00 30 * * * *', function() {
  /*
   * Runs every 10 minutes
   */
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
  }, function () {
    /* This function is executed when the job stops */
  },
  true, /* Start the job right now */
  'America/New_York' /* Time zone of this job. */
);

var checkTrump = new CronJob('00 00 * * * *', function() {
  /*
   * Runs every hour at 00:00
   */
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

var checkForReplies = new CronJob('00 */7 * * * *', function() {
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
						database.select('replies','tweet_id='+scopedTweet["tweet_id"],'tweet_id',null,null,function(row){
							if(row.length == 0){//this means we don't have this tweet in the db
								database.select('trump',"tweet_id="+scopedTweet.trump_tweet_id,'tweet_id',null,null,function(trump_tweets){
									if(trump_tweets.length != 0){//if ==0 then this tweet is not responding to a tweet we have
										database.insert('replies',scopedTweet,function(){
											database.count('replies','trump_tweet_id='+scopedTweet.trump_tweet_id,function(row){
												if(trump_tweets[0].sed == null){
														average = scopedTweet.sed;//must be the first reply we've gotten
												}
												else{
														average = (parseInt(trump_tweets[0].sed)*row[0].count + parseInt(scopedTweet.sed))*1.0/(row[0].count+1); // find the new average
												}
												database.update('trump','sed='+average,'tweet_id='+trump_tweets[0].tweet_id,function(){
													database.update('trump','replies='+row[0].count,'tweet_id='+trump_tweets[0].tweet_id);
												});
											});
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

app.listen(process.env.PORT,function(){
	console.log("Server Running…");
});
