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
var natural = require('natural');
TfIdf = natural.TfIdf;

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
				var cleanedTweet =  tweets[i].text.replace(/[^A-Za-z 0-9 \.,\?""!@#\$%\^&\*\(\)-_=\+;:<>\/\\\|\}\{\[\]`~]*/g, '');
				tweet.text = cleanedTweet;
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
					var noDomains = tweets.statuses[i].text.replace(/https:.*\s/g,' ');
					var cleanedTweet =  noDomains.replace(/[^A-Za-z 0-9 \.,\?""!@#\$%\^&\*\(\)-_=\+;:<>\/\\\|\}\{\[\]`~]*/g, '');
					var tweet = {tweet_id:tweets.statuses[i].id,
								trump_tweet_id:tweets.statuses[i].in_reply_to_status_id,
								text:cleanedTweet};
					(function(scopedTweet){
						database.select('replies','tweet_id='+scopedTweet["tweet_id"],'tweet_id',null,null,function(row){
							if(row.length == 0){//this means we don't have this tweet in the db
								database.select('trump',"tweet_id="+scopedTweet.trump_tweet_id,'tweet_id',null,null,function(trump_tweets){
									if(trump_tweets.length != 0){//if ==0 then this tweet is not responding to a tweet we have
										database.insert('replies',scopedTweet,function(){//insert the reply into the replies table
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
			console.log("129: Do we have duplicate replies?");
		}
		var tweet = row[0];
		var extraCleanTweet = tweet.text.replace(/[#|@][a-zA-Z]+/g,"");
		

		
		database.select('user_words','weight > 1',null,null,null,function(row){
			var extraWords = {};
			for(i=0;i<row.length;i++){
				extraWords[String(row[i]["term"])] = row[i]["sed"];
			}
			var r1 = sentiment(extraCleanTweet,extraWords);
			if(r1["positive"].length < 2 && r1["negative"].length < 2){//we didn't get any good words so just don't count this one
				r1["score"] = null;
			}

			//compare with the untrained algorithm
			var r2 = Sentimental.analyze(extraCleanTweet);

			if(r2["positive"]["words"].length < 1  && r2["negative"]["words"].length < 1){
				r2["score"] = null;
			}

			database.update('replies','sed='+r1["score"],'tweet_id='+tweet_id,function(){
				eventEmitter.emit('newSedDataForTrumpTweet',tweet.trump_tweet_id);
			});
			database.update('replies','descriptor=\''+JSON.stringify({"Sentimental":r2,"smart_sentiment":r1})+'\'','tweet_id='+tweet_id);

		});
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

function tfidf(){
	console.log("TFIDF Calculate")
	database.select('replies','sed_training is not null',null,0,100,function(row){
		var data = {"positive":{},"negative":{}};
		positive_tfidf = new TfIdf();
		negative_tfidf = new TfIdf();
		console.log("TFIDI of "+row.length+" documents")
		for(i=0;i<row.length;i++){
			if(row[i].sed > 0 && row[i].sed_training < 0){//only add document that have been marked as classified incorrectly
				negative_tfidf.addDocument(row[i].text);
			}
			if(row[i].sed < 0 && row[i].sed_training > 0){
				positive_tfidf.addDocument(row[i].text);
			}
		}
		console.log(JSON.stringify(positive_tfidf));
		console.log("positive docs: " +positive_tfidf.documents.length);
		for(i=0;i<positive_tfidf.documents.length;i++){//get the list of terms for all positive documents
			positive_tfidf.listTerms(i).forEach(function(term) {
				if(term["weight"]>3){
					if(term["term"] in data["positive"]){//we already have this word so average
						data["positive"][term["term"]] += 1;
					}
					else{//this is the first time we've seen this word
						data["positive"][term["term"]] = 1;
					}
				}
			});
		}
		console.log("negative docs: " +negative_tfidf.documents.length);
		for(i=0;i<negative_tfidf.documents.length;i++){//get the list of terms for all negative documents
			negative_tfidf.listTerms(i).forEach(function(term) {
				if(term["tfidf"]>3){
					if(term["term"] in data["negative"]){//we already have this word so average
						data["negative"][term["term"]] += 1;
					}
					else{//this is the first time we've seen this word
						data["negative"][term["term"]] = 1;
					}
				}
			});
		}
		for(var key in data["positive"]){//check if any word that is in positive is in negative
			console.log(key in data["negative"]);
			if(key in data["negative"]){//if a word is in both lists we aren't interested in it
				console.log("in both lists: " + key);
				delete data["negative"][String(key)];//had to the add the String() because some of our terms could be numbers and javscript can't tell the difference between a number key and an index
				delete data["positive"][String(key)];

			}
			else{//otherwise let's save it in the database
				database.replace('user_words',{term:key,sed:data["positive"][key],weight:data["positive"][key]});
			}
		}
		for(var key in data["negative"]){//check if any word that is in negative is in postive
			if(key in data["positive"]){
				console.log("in both lists: " + key);
				delete data["positive"][String(key)];//had to the add the String() because some of our terms could be numbers and javscript can't tell the difference between a number key and an index
				delete data["negative"][String(key)];

			}
			else{//otherwise let's save it in the database
				database.replace('user_words',{term:key,sed:-1*data["negative"][key],weight:data["negative"][key]});
			}
		}
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

var fiveMinutes = new CronJob('00 */5 * * * *', function() {//TODO: what in order does this execute at the top of the hour
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

var halfhour = new CronJob('00 00,30 * * * *', function() {//TODO: what in order does this execute at the top of the hour
  /*
   * Runs every 30 minutes
   */
   tfidf();
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

if(process.env.DEBUG === 'true'){
	app.get('/secret',function(req,res){
		res.send("shhhhhhhhhh");
	});
}


app.get('/replies',function(req,res){
	if(isNaN(req.query.page)==false){
		limit1 = (parseInt(req.query.page)-1)*100;
		limit2 = 100;
		if(process.env.DEBUG === 'true'){
			database.select('replies',"trump_tweet_id="+parseInt(req.query.tweet_id)+' and sed is not null' ,'tweet_id',limit1,limit2,function(row){
				res.send(row);
			});
		}
		else{
			database.select('replies',"trump_tweet_id="+parseInt(req.query.tweet_id)+' and sed is not null and sed_training is null' ,'tweet_id',limit1,limit2,function(row){
				res.send(row);
			});
		}
	}
	else{
		res.send({error:"invalid request"});
	}
});

if(process.env.DEBUG === 'true'){
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
}

app.get('/tfidf',function(req,res){
	database.select('user_words',null,'weight',null,null,function(row){
		res.send(row);
	});
});

app.get('/sed',function(req,res){
	//calculateSed(req.query.tweet_id);
	database.select('replies','tweet_id='+req.query.tweet_id,null,null,null,function(row){
		if(row.length>1){//this should never happen
			console.log("129: Do we have duplicate replies?");
		}
		var tweet = row[0];
		if(row.length < 1){
			res.send("error");
			return
		}
		else{
		var extraCleanTweet = tweet.text.replace(/[#|@][a-zA-Z]+/g,"");
		

		
		database.select('user_words','weight > 1',null,null,null,function(row){
			var extraWords = {};
			for(i=0;i<row.length;i++){
				extraWords[String(row[i]["term"])] = row[i]["sed"];
			}

			var r1 = sentiment(extraCleanTweet,extraWords);
			if(r1["positive"].length < 2 && r1["negative"].length < 2){//we didn't get any good words so just don't count this one
				r1["score"] = null;
			}

			//compare with the untrained algorithm
			var r2 = Sentimental.analyze(extraCleanTweet);

			if(r2["positive"]["words"].length < 1  && r2["negative"]["words"].length < 1){
				r2["score"] = null;
			}
			res.send({"Sentimental":r2,"smart_sentiment":r1});

		});
		}
	});
});

app.get('/tfidfer',function(req,res){
	database.select('replies','sed_training is not null',null,null,null,function(row){
		var data = {"positive":{},"negative":{}};
		positive_tfidf = new TfIdf();
		negative_tfidf = new TfIdf();
		console.log("TFIDI of "+row.length+" documents")
		for(i=0;i<row.length;i++){
			if(row[i].sed > 0 && row[i].sed_training < 0){//only add document that have been marked as classified incorrectly
				negative_tfidf.addDocument(row[i].text);
			}
			if(row[i].sed < 0 && row[i].sed_training > 0){
				positive_tfidf.addDocument(row[i].text);
			}
		}
		
		console.log("positive docs: " +positive_tfidf.documents.length);
		for(i=0;i<positive_tfidf.documents.length;i++){//get the list of terms for all positive documents
			positive_tfidf.listTerms(i).forEach(function(term) {
				if(term["weight"]>3){
					if(term["term"] in data["positive"]){//we already have this word so average
						data["positive"][term["term"]] += 1;
					}
					else{//this is the first time we've seen this word
						data["positive"][term["term"]] = 1;
					}
				}
			});
		}
		console.log("negative docs: " +negative_tfidf.documents.length);
		for(i=0;i<negative_tfidf.documents.length;i++){//get the list of terms for all negative documents
			negative_tfidf.listTerms(i).forEach(function(term) {
				if(term["tfidf"]>3){
					if(term["term"] in data["negative"]){//we already have this word so average
						data["negative"][term["term"]] += 1;
					}
					else{//this is the first time we've seen this word
						data["negative"][term["term"]] = 1;
					}
				}
			});
		}
		for(var key in data["positive"]){//check if any word that is in positive is in negative
			console.log(key in data["negative"]);
			if(key in data["negative"]){//if a word is in both lists we aren't interested in it
				console.log("in both lists: " + key);
				delete data["negative"][String(key)];//had to the add the String() because some of our terms could be numbers and javscript can't tell the difference between a number key and an index
				delete data["positive"][String(key)];

			}
			else{//otherwise let's save it in the database
				console.log("add to database")
				//database.replace('user_words',{term:key,sed:5,weight:data["negative"][key]});
			}
		}
		for(var key in data["negative"]){//check if any word that is in negative is in postive
			if(key in data["positive"]){
				console.log("in both lists: " + key);
				delete data["positive"][String(key)];//had to the add the String() because some of our terms could be numbers and javscript can't tell the difference between a number key and an index
				delete data["negative"][String(key)];

			}
			else{//otherwise let's save it in the database
				console.log("add to database")
				//database.replace('user_words',{term:key,sed:-5,weight:data["negative"][key]});
			}
		}
		res.send(data["negative"]);
	});
});

app.listen(process.env.PORT,function(){
	console.log("Server Running at "+process.env.PORT+" debug is "+process.env.DEBUG+"…");
});

