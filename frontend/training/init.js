function initTraining(app,database){
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

	app.get('/tweet_sed',function(req,res){
		if(isNaN(req.query.tweet_id)==false){
			database.select('replies','tweet_id='+parseInt(req.query.tweet_id),null,null,null,function(row){
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
					res.send({"Sentimental":r2,"smart_sentiment":r1});

				});
				}
			});
		}
		else{
			res.send({error:"invalid request"});
		}
	});

	app.get('/tfidf',function(req,res){
		console.log("TFIDF Calculate")
		database.select('replies','sed_training is not null',null,0,1000,function(row){
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
			for(var key in data["positive"]){//check if any word that is in positive is in negative
				if(key in data["negative"]){//if a word is in both lists we aren't interested in it
					console.log("in both lists: " + key);
					delete data["negative"][String(key)];//had to the add the String() because some of our terms could be numbers and javscript can't tell the difference between a number key and an index
					delete data["positive"][String(key)];

				}
				else{//otherwise let's save it in the database
					database.replace('user_words',{term:key,sed:3,weight:data["positive"][key]});
				}
			}
			for(var key in data["negative"]){//check if any word that is in negative is in postive
				if(key in data["positive"]){
					console.log("in both lists: " + key);
					delete data["positive"][String(key)];//had to the add the String() because some of our terms could be numbers and javscript can't tell the difference between a number key and an index
					delete data["negative"][String(key)];

				}
				else{//otherwise let's save it in the database
					database.replace('user_words',{term:key,sed:-3,weight:data["negative"][key]});
				}
			}
			res.send(data);
		});
	});
}

function renderWordlist(res,data){
	var html = "<!DOCTYPE html>"+
			"<html lang=\"en\">"+
    		"<head>"+
        		"<link rel=\"icon\" type=\"image/png\" href=\"/static/icon.png\">"+
        		"<title>Make Twitter Great Again</title>"+
        		"<meta charset=\"utf-8\">"+
            	"<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"+
                "<link rel=\"stylesheet\" href=\"https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css\">"+
                "<link href=\"https://fonts.googleapis.com/css?family=Montserrat\" rel=\"stylesheet\">"+
                "<script src=\"https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js\"></script>"+
                "<script src=\"https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js\"></script>"
            "</head>"+
            "<body>"+
            	"<div id=\"test\">test</div>";

    html += 
    		"</body"+
    		"</html>";
	res.send(html);
}

module.exports = initTraining;
