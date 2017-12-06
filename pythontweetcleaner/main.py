import os
import json
import logging

os.environ["PYSPARK_SUBMIT_ARGS"] = '--packages org.apache.spark:spark-streaming-kafka-0-8_2.11:2.0.2 pyspark-shell'
from pyspark import SparkContext
from pyspark.streaming import StreamingContext
from pyspark.streaming.kafka import KafkaUtils
from ConfigReader import ConfigReader
from py4j.protocol import Py4JJavaError

config = ConfigReader("config.json")

zookeeper_url = "{:s}:{:s}".format(config.get_key("ZOOKEEPER_HOST"), config.get_key("ZOOKEEPER_PORT"))
kafka_url = "{:s}:{:s}".format(config.get_key("KAFKA_HOST"), config.get_key("KAFKA_PORT"))
kafka_topic = config.get_key("KAFKA_TOPIC")
output_topic = config.get_key("KAFKA_OUTPUT_TOPIC")

sc = SparkContext(appName="PythonSparkStreamingKafka")
sc.setLogLevel("WARN")
ssc = StreamingContext(sc, 10)

kafka_params = {"startingOffset": "earliest"}

kafkaStream = KafkaUtils.createStream(ssc, zookeeper_url, 'spark-streaming',
                                      {kafka_topic: 1}, kafka_params)


def handler(message):
    records = message.collect()
    for record in records:
        producer.send('spark.out', str(record))
        producer.flush()


lines = kafkaStream.map(lambda x: json.loads(x[1])).filter(lambda tweet: tweet["in_reply_to_status_id"] != None).filter(
    lambda tweet: tweet["truncated"] == False)

try:  # if there is nowhere to send our cleaned tweets, exit
    kvs = KafkaUtils.createDirectStream(ssc, [output_topic], {
        "metadata.broker.list": kafka_url})
    kvs.foreachRDD(handler)
except Py4JJavaError as e:
    logging.error("Could not connect to Kafka")
    exit(1)

lines.pprint()

ssc.start()
ssc.awaitTermination()
