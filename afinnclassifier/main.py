import os
import json
import csv
import logging

os.environ["PYSPARK_SUBMIT_ARGS"] = '--packages org.apache.spark:spark-streaming-kafka-0-8_2.11:2.0.2 pyspark-shell'
from pyspark import SparkContext
from pyspark.streaming import StreamingContext
from pyspark.streaming.kafka import KafkaUtils
from ConfigReader import ConfigReader
from kafka import SimpleProducer
from kafka import SimpleClient
from kafka.errors import KafkaUnavailableError
from kafka.errors import FailedPayloadsError

try:
    with open("app/data/AFINN-96.txt") as file:#TODO: move this to the config
        sentiment_data = dict(csv.reader(file, delimiter='\t'))
    for key in sentiment_data:
        sentiment_data[key] = int(sentiment_data[key])

except IOError as e:
    logging.error("Could not open sentiment data file " + str(e.args))
    exit(1)
except ValueError:
    logging.error("Sentiment data file not valid")
    exit(1)

config = ConfigReader("app/config.json")

zookeeper_url = "{:s}:{:s}".format(config.get_key("ZOOKEEPER_HOST"), config.get_key("ZOOKEEPER_PORT"))
kafka_url = "{:s}:{:s}".format(config.get_key("KAFKA_HOST"), config.get_key("KAFKA_PORT"))
kafka_topic = config.get_key("KAFKA_TOPIC")
output_topic = config.get_key("KAFKA_OUTPUT_TOPIC")

sc = SparkContext(appName="AfinnClassifier")
sc.setLogLevel("ERROR")
ssc = StreamingContext(sc, 10)

kafka_params = {"startingOffsets": "earliest"}

kafkaStream = KafkaUtils.createStream(ssc, zookeeper_url, 'spark-streaming',
                                      {kafka_topic: 1}, kafka_params)


# output stream
try:
    kafka = SimpleClient(kafka_url)
except KafkaUnavailableError as e:
    logging.error("Could not connect to Kafka")
    raise e

producer = SimpleProducer(kafka)

def handler(message):
    cleaned_tweets = message.collect()
    try:
        for tweet in cleaned_tweets:
            producer.send_messages(output_topic, json.dumps(tweet).encode('utf-8'))
    except FailedPayloadsError:
        logging.error("Could not connect to Kafka")


def get_line_sentiment(line):
    word_sentiments = list(map(lambda word: sentiment_data.get(word, 0), line["cleaned"].split(" ")))
    line_sentiment = sum(word_sentiments) / len(word_sentiments)
    return line.update({"sentiment": line_sentiment}) or line


lines = kafkaStream.map(lambda x: json.loads(x[1])) \
    .map(get_line_sentiment)

lines.foreachRDD(handler)  # send cleaned tweets to kafka
#lines.pprint()

ssc.start()
ssc.awaitTermination()
