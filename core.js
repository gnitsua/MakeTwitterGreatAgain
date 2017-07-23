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

debug = false;
//check for the debug flag
if(process.argv.length > 2){
	arg = process.argv[2];

	if(arg.split('--')[1]=='debug'){
		debug = true;
	}

}

app.use('/static', express.static('static'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var Database = require('./Database');
var database = new Database();

if(debug == true){
	require('./training').init(app,database)	
}

//These keys are tied w/ the CS275_Group1 accont and are needed to access the api
var twitter = new Twitter({
	consumer_key: process.env.CONSUMER_KEY,
	consumer_secret: process.env.CONSUMER_SECRET,
	access_token_key: process.env.ACCESS_TOKEN_KEY,
	access_token_secret: process.env.ACCESS_TOKEN_SECRET
});

// create a rolling file logger based on date/time that fires process events
const opts = {
    errorEventName:'error',
    logDirectory:'user_words_logs',
    fileNamePattern:'roll-<DATE>.log',
    dateFormat:'YYYY.MM.DD'
};

const log = require('simple-node-logger').createRollingFileLogger( opts );


//Functions the server does
function cleanDatabase(){
	console.log('Cleaning');
	database.select('trump',null,'tweet_id',10,100,function(row){
		var length = row.length;
		for(var i = 0; i < length; i++){
			var tweet = {tweet_id:row[i].tweet_id,text:row[i].text};
			(function(scopedTweet){
				console.log('should delete '+ scopedTweet.tweet_id)
				database.delete('replies','trump_tweet_id='+scopedTweet.tweet_id,function(){
					console.log("deleted all replies for tweet: "+scopedTweet.tweet_id);
					database.delete('trump','tweet_id='+scopedTweet.tweet_id,function(){
						console.log('deleted trump tweet: '+scopedTweet.tweet_id);
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
				if(tweet.text.match(/^RT.*/g) == null){
					(function(scopedTweet){
						database.select('trump','tweet_id='+scopedTweet["tweet_id"],null,null,null,function(row){
						if(row.length == 0){//this means we don't have this tweet in the db
							database.insert('trump',scopedTweet);//TODO: potential issue if the tweet contains characters that aren't supported by mysql
							//eventEmitter.emit('gotTrumpTweet',scopedTweet);//TODO:this is causing replies to be checked a million times right now
							//console.log(scopedTweet)
						}
						else{
							console.log("Already added this tweet");
						}
						});
					})(tweet);
				}
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
		
		database.select('user_words','weight > 1','weight',0,100,function(row){
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
	console.log("trump sed average")
	//in this version we average the sediment
	// database.average('replies','trump_tweet_id='+trump_tweet_id,function(row){
	// 	console.log("trump_tweet_id: " + trump_tweet_id + " sed: "+row[0].average);
	// 	database.update('trump','sed='+row[0].average,'tweet_id='+trump_tweet_id);
	// });
	//in this version we get the percent negative/positive
	database.count('replies','trump_tweet_id='+trump_tweet_id,function(row){
		total = row[0].count;
		database.update('trump','replies='+row[0].count,'tweet_id='+trump_tweet_id);
		
		database.count('replies','trump_tweet_id='+trump_tweet_id+' and sed < 0',function(row){
			console.log('averaging '+trump_tweet_id+":" +row[0].count+' total: '+total);
			database.update('trump','sed='+row[0].count/total,'tweet_id='+trump_tweet_id);
		});
	});
}

function tfidf(){
	console.log("TFIDF Calculate")
	database.select('replies',null,null,0,1000,function(row){//get the most recent 1000 replies
		database.select('user_words',null,null,null,null,function(user_words_row){//get all of the user words
			log.info(user_words_row);//log the existing user words for furutre reference
			var data = {"positive":{},"negative":{}};
			for(i=0;i<user_words_row.length;i++){//add all the exisiting user words to the user words
				if(user_words_row[i].sed > 0){
					data["positive"][user_words_row[i].term] = user_words_row[i].weight*0.66;
				}
				else if(user_words_row[i].sed < 0){
					data["negative"][user_words_row[i].term] = user_words_row[i].weight*0.66;
				}
				else{
					console.log("219: not positive or negative?")
				}
			}
			positive_tfidf = new TfIdf();
			negative_tfidf = new TfIdf();
			console.log("TFIDI of "+row.length+" documents")
			for(i=0;i<row.length;i++){
				if(row[i].sed < 0){
					negative_tfidf.addDocument(row[i].text);
				}
				if(row[i].sed > 0){
					positive_tfidf.addDocument(row[i].text);
				}
			}
			console.log("positive docs: " +positive_tfidf.documents.length);
			for(i=0;i<positive_tfidf.documents.length;i++){//get the list of terms for all positive documents
				positive_tfidf.listTerms(i).forEach(function(term) {
					if(term["weight"]>3 && term["term"].length<40){//had to add the length limit because the database won't take words that long
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
			database.query('delete from user_words',function(){//clear the list of user words before added in the new words
				var sortedPositive = [];
				for(var key in data["positive"]){//check if any word that is in positive is in negative
					if(key in data["negative"]){//if a word is in both lists we aren't interested in it
						console.log("in both lists: " + key);
						delete data["negative"][String(key)];//had to the add the String() because some of our terms could be numbers and javscript can't tell the difference between a number key and an index
						delete data["positive"][String(key)];

					}
					else{//otherwise let's add it to a list that we can sort
						sortedPositive.push([key,data["positive"][String(key)]]);
					}
				}
				sortedPositive.sort(function(a,b){
					return b[1]-a[1];
				});

				var length = sortedPositive.length > 100 ? 100 : sortedPositive.length;				
				totalPositive = 0;//TODO:this should be a function and can we do it more efficently?
				for(i=0;i<length;i++){
					totalPositive += sortedPositive[i][1];
				}
				for(i=0;i<length;i++){//add the top 100 words to the user words list
					//sed = weight of current word/sum of all word weights then scaled to 0-5
					sed = (sortedPositive[i][1]/totalPositive)*50
					if(sed > 5){
						sed = 5
					}
					database.insert('user_words',{term:sortedPositive[i][0],sed:sed,weight:sortedPositive[i][1]});
				}

				var sortedNegative = [];
				for(var key in data["negative"]){//check if any word that is in negative is in postive
					if(key in data["positive"]){
						console.log("in both lists: " + key);
						delete data["positive"][String(key)];//had to the add the String() because some of our terms could be numbers and javscript can't tell the difference between a number key and an index
						delete data["negative"][String(key)];

					}
					else{
						sortedNegative.push([key,data["negative"][String(key)]]);
					}
				}
				sortedNegative.sort(function(a,b){
					return b[1]-a[1];
				});

				var length = sortedNegative.length > 100 ? 100 : sortedNegative.length;				
				totalNegative = 0;
				for(i=0;i<length;i++){
					totalNegative += sortedNegative[i][1];
				}
				for(i=0;i<length;i++){//add the top 100 words to the user words list
					//sed = weight of current word/sum of all word weights then scales to 0-5
					sed = -(sortedNegative[i][1]/totalNegative)*50
					if(sed < -5){
						sed = -5
					}
					database.insert('user_words',{term:sortedNegative[i][0],sed:sed,weight:sortedNegative[i][1]});
				}
			});
		});
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
	eventEmitter.emit('cleanUpTime');
  }, function () {
    /* This function is executed when the job stops */
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

var halfhour = new CronJob('00 30 * * * *', function() {//TODO: what in order does this execute at the top of the hour
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
app.get('/replies',function(req,res){
	if(isNaN(req.query.page)==false){
		limit1 = (parseInt(req.query.page)-1)*100;
		limit2 = 100;
		if(debug == true){
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

app.get('/userwords',function(req,res){
	database.select('user_words',null,'weight',null,null,function(row){
		res.send(row);
	});
});


app.listen(process.env.PORT,function(){
	console.log("Server Running at "+process.env.PORT+" debug is "+ debug +"…");
});

