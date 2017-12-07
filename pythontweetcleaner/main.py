import os
import json
import logging
import re

os.environ["PYSPARK_SUBMIT_ARGS"] = '--packages org.apache.spark:spark-streaming-kafka-0-8_2.11:2.0.2 pyspark-shell'
from pyspark import SparkContext
from pyspark.streaming import StreamingContext
from pyspark.streaming.kafka import KafkaUtils
from kafka import SimpleProducer
from kafka import SimpleClient
from kafka.errors import KafkaUnavailableError
from kafka.errors import FailedPayloadsError
from ConfigReader import ConfigReader

config = ConfigReader("config.json")
zookeeper_url = "{:s}:{:s}".format(config.get_key("ZOOKEEPER_HOST"), config.get_key("ZOOKEEPER_PORT"))
kafka_url = "{:s}:{:s}".format(config.get_key("KAFKA_HOST"), config.get_key("KAFKA_PORT"))
kafka_topic = config.get_key("KAFKA_TOPIC")
output_topic = config.get_key("KAFKA_OUTPUT_TOPIC")

# input stream
sc = SparkContext(appName="PythonTweetCleaner")
sc.setLogLevel("WARN")
ssc = StreamingContext(sc, 10)

kafka_params = {"startingOffsets": "earliest"}
kafkaStream = KafkaUtils.createStream(ssc, zookeeper_url, 'spark-streaming',
                                      {kafka_topic: 1}, kafka_params)
# output stream
try:
    kafka = SimpleClient("192.168.99.100:9092")
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


# actual cleaning
# filter all that aren't a reply
# filter all the truncated tweets
# get rid of all extra fields
# convert to lower case
# remove hashtags, @'s, and punctuation TODO: this is filtering out emojis
lines = kafkaStream.map(lambda x: json.loads(x[1])) \
    .filter(lambda tweet: tweet["in_reply_to_status_id"] != None) \
    .filter(lambda tweet: tweet["truncated"] == False) \
    .map(lambda line: {"created_at": line["created_at"], "full_text": line["full_text"],
                       "in_reply_to_status_id": line["in_reply_to_status_id"]}) \
    .map(lambda line: (line.update({"cleaned": line["full_text"].lower()}) or line)) \
    .map(lambda line: (line.update({"cleaned": ' '.join(
    re.sub("(@[A-Za-z0-9]+)|([^0-9A-Za-z \t])|(\w+:\/\/\S+)", " ", line["cleaned"]).split())}) or line))
lines.foreachRDD(handler)  # send cleaned tweets to kafka
lines.pprint()

ssc.start()
ssc.awaitTermination()
