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


//This gets all tweets from the client w/ associated ID
// twitter.get('statuses/user_timeline','CS275_Group1',function(error,tweets,response){
// 	if(!error){
// 		console.log('Connection established...retrieving tweets');
// 		var length = tweets.length;
// 		for(var i = 0; i < length; i++){
// 			tweetArray[i] =tweets[i].text; // This stores the actual tweet text
// 			tweetIDArray[i]=tweets[i].id_str; // This stores the associated tweet ID
// 		}
		
// 		console.log('Getting replies to tweet: ' + tweetArray[0] + ' ' + tweetIDArray[0]);
// 		twitter.get('search/tweets.json?q='+tweetIDArray[0]+'&count=100',function(error2,tweets2,response2){
// 				if(!error){
// 					var length = tweets2.statuses.length;
// 					for(var i = 0; i < length; i++){
// 						console.log(tweets2.statuses[i].quoted_status_id_str);
// 						console.log(tweets2.statuses[i].id_str);
// 						console.log(tweets2.statuses[i].text); // get text of replies
// 					}
// 				}
// 		});
		
		
		
// 		console.log('Getting replies to tweet: ' + tweetArray[1] + ' ' + tweetIDArray[1]);
// 		twitter.get('search/tweets.json?q='+tweetIDArray[1]+'&count=100',function(error2,tweets2,response2){
// 				if(!error){
// 					var length = tweets2.statuses.length;
// 					for(var i = 0; i < length; i++){
// 						console.log(tweets2.statuses[i].text);
// 					}
// 				}
// 		});
		
		
// 	}
// });

app.listen(8080,function(){
	console.log("Server Running…");
});


//This returns comments with an @tag.
/*
twitter.get('https://api.twitter.com/1.1/search/tweets.json?q=to:cs275_group1',function(error,data,response){
	if(!error){
		console.log('Found messages!');
		console.log(data);
		}
	});
	*/

	
	


//This returns retweets, without any comment
/*
twitter.get('statuses/user_timeline', params, function(error, tweets, response) {
 if (!error) {
	 console.log('Connection established...pulling tweets');
	 var length = tweets.length;
	 var testString = tweets[0].text;
	 testID = tweets[0].id_str;
	 console.log(tweets);
	 console.log(length);
	 console.log(testString);
	 console.log('Getting retweets of ' + testID);
	 
	 twitter.get('statuses/retweeters/ids.json?id='+testID+'&stringify_ids=true',function(error2,data,response){
		if(!error2){
			console.log('Found retweets of: ' + testString);
			var testID2 = data.ids[0];
			console.log(testID2);
			console.log(data);
			
			twitter.get('users/lookup.json?user_id='+testID2,function(error3,data2,response){
				console.log('Found user!');
				console.log(data2);
			});
		} else {
			console.log('Error in getting retweets!');
			console.log(error2);
		}
	});
	
	} else {
	console.log(error);
	}
});

*/

