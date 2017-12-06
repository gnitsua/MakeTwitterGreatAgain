import os
import json
import csv
import logging

os.environ["PYSPARK_SUBMIT_ARGS"] = '--packages org.apache.spark:spark-streaming-kafka-0-8_2.11:2.0.2 pyspark-shell'
from pyspark import SparkContext
from pyspark.streaming import StreamingContext
from pyspark.streaming.kafka import KafkaUtils
from ConfigReader import ConfigReader

try:
    with open("data/AFINN-96.txt") as file:
        sentiment_data = dict(csv.reader(file, delimiter='\t'))
    for key in sentiment_data:
        sentiment_data[key] = int(sentiment_data[key])

except IOError as e:
    logging.error("Could not open sentiment data file " + str(e.args))
    exit(1)
except ValueError:
    logging.error("Sentiment data file not valid")
    exit(1)

config = ConfigReader("config.json")

zookeeper_url = "{:s}:{:s}".format(config.get_key("ZOOKEEPER_HOST"), config.get_key("ZOOKEEPER_PORT"))
kafka_topic = config.get_key("KAFKA_TOPIC")

sc = SparkContext(appName="PythonTweetCleaner")
sc.setLogLevel("WARN")
ssc = StreamingContext(sc, 10)

kafka_params = {"startingOffsets": "earliest"}

kafkaStream = KafkaUtils.createStream(ssc, zookeeper_url, 'spark-streaming',
                                      {kafka_topic: 1}, kafka_params)


def get_line_sentiment(line):
    word_sentiments = list(map(lambda word: sentiment_data.get(word, 0), line["cleaned"].split(" ")))
    line_sentiment = sum(word_sentiments) / len(word_sentiments)
    return line.update({"sentiment": line_sentiment}) or line


lines = kafkaStream.map(lambda x: json.loads(x[1])) \
    .map(get_line_sentiment)

lines.pprint()

ssc.start()
ssc.awaitTermination()
