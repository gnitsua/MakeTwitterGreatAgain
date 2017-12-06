import json
from threading import Timer
import logging
from kafka.errors import FailedPayloadsError


class SearchScraper():
    def __init__(self, name, search_string, rate_limit, api, producer):
        self.name = name
        self.search_string = search_string
        self.rate_limit = rate_limit
        self.interval = 15 * 60 / rate_limit
        self.api = api
        self.producer = producer

    def get_tweets(self):
        results = self.api.search(q=self.search_string, results_type="recent", count=100, tweet_mode="extended")
        try:  # if the kafka connection is broken, stop trying to send and hope that ScraperManager can reconnect
            for result in results:
                logging.debug(result._json)
                self.producer.send_messages(self.name, json.dumps(result._json).encode('utf-8'))
        except FailedPayloadsError:
            logging.error("Could not connect to Kafka")

    def start(self):
        self.get_tweets()
        self.timer = Timer(interval=self.interval, function=self.start)
        self.timer.start()  # restart the time to create looping

    def stop(self):
        if (self.timer):
            self.timer.cancel()
