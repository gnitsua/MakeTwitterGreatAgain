/*
* CS 275 Group 1
* Written by Brandon Tran
*
* Core.js: This program is intended to mine text 
* using the twitter stream API. 
*/

var hashMap = require('hashmap');
var Twitter = require('twitter');
var http = require('http');

//These keys are tied w/ the CS275_Group1 accont and are needed to access the api
var twitter = new Twitter({
consumer_key: 'p7Rn3R9I37sbNJEFOSl58nXOv',
consumer_secret: 'x8M8A63ow9mN3vM9TTaTEhtKywizMrxpNqWeN8QMT8jHfAk6AV',
access_token_key: '833706426908475394-dclzYhhk0t6ZRMRpboj2bYnF7lvHAzy',
access_token_secret: 'tYtMO29K7wuJOtFhc9rYioFnX7DmWdJPFvKIaIiFSiq6j'
});

var params = {screen_name: 'CS275_Group1'};
var testID = '';
var userIDS = [];
var tweetArray = [];
var tweetIDArray = [];
var map = new hashMap();

//This gets all tweets from the client w/ associated ID
twitter.get('statuses/user_timeline',params,function(error,tweets,response){
	if(!error){
		console.log('Connection established...retrieving tweets');
		var length = tweets.length;
		for(var i = 0; i < length; i++){
			tweetArray[i] =tweets[i].text; // This stores the actual tweet text
			tweetIDArray[i]=tweets[i].id_str; // This stores the associated tweet ID
		}
		
		console.log('Getting replies to tweet: ' + tweetArray[0] + ' ' + tweetIDArray[0]);
		twitter.get('search/tweets.json?q='+tweetIDArray[0]+'&count=100',function(error2,tweets2,response2){
				if(!error){
					var length = tweets2.statuses.length;
					for(var i = 0; i < length; i++){
						console.log(tweets2.statuses[i].quoted_status_id_str);
						console.log(tweets2.statuses[i].id_str);
						console.log(tweets2.statuses[i].text); // get text of replies
					}
				}
		});
		
		
		
		console.log('Getting replies to tweet: ' + tweetArray[1] + ' ' + tweetIDArray[1]);
		twitter.get('search/tweets.json?q='+tweetIDArray[1]+'&count=100',function(error2,tweets2,response2){
				if(!error){
					var length = tweets2.statuses.length;
					for(var i = 0; i < length; i++){
						console.log(tweets2.statuses[i].text);
					}
				}
		});
		
		
	}
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

