# MakeTwitterGreatAgain
The aim of this project was to incorporate machine learning semantic analysis on a Twitter account or any social media platform that relies on a textual medium of conversion. We chose to do Twitter because current events led us to wonder the overall opinion of the web on President Donald Trump's tweets. His tweets have a widespread influence on the world and are read by thousands of people each day so learning about the consensus on his tweets can help mold the opinions of others.

## Installation
Instillation of this project is primarily handled via Docker. While this should have been made easy by docker-compose, much fighting and swear has at this point been futile. I will therefor try to make the build processes as easy as possible. Run the following commands

To start Kafka:
``` 
cd kafka
docker-compose up -d
```

To start the Twitter scraper
```
cd twitterapi
docker build -t twitterapi .
docker run -d twitterapi
```

To start the tweet cleaner
```
cd pythontweetcleaner
docker build -t pythontweetcleaner .
docker run -d pythontweetcleaner
```

To start the classifier
```
cd afinnclassifier
docker build -t afinnclassifier .
docker run -d afinnclassifier
```

To start the MySQL database
```
cd database
docker-compose up -d

```

To start the Kafka to MySQL adapter
```
cd nodedatabaseadapter
docker build -t nodedatabaseadapter .
docker run -d nodedatabaseadapter
```

To start the front end
```
cd frontend
docker build -t frontend .
docker run -d frontend
```
