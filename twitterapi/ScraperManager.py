from SearchScraper import SearchScraper
from ConfigReader import ConfigReader
import json
import logging
import tweepy
from tweepy import OAuthHandler
from threading import Timer
from kafka import SimpleClient
from kafka import SimpleProducer
from kafka.errors import KafkaUnavailableError

class ScraperManger:
    def __init__(self):
        config = ConfigReader("config.json")

        auth = OAuthHandler(config.get_key("CONSUMER_KEY"), config.get_key("CONSUMER_SECRET"))
        auth.set_access_token(config.get_key("ACCESS_TOKEN_KEY"), config.get_key("ACCESS_TOKEN_SECRET"))
        self.api = tweepy.API(auth_handler=auth, wait_on_rate_limit=True, wait_on_rate_limit_notify=True)
        self.rate_limit = config.get_key("RATE_LIMIT")
        self.scrapers = []
        kafka_url = "{:s}:{:s}".format(config.get_key("KAFKA_HOST"), config.get_key("KAFKA_PORT"))
        try:
            kafka = SimpleClient(kafka_url,timeout=60)
        except KafkaUnavailableError as e:
            logging.error("Could not connect to Kafka2")
            raise e

        self.producer = SimpleProducer(kafka)

    def get_requests_per_period(self):
        return sum(map(lambda scraper: scraper.rate_limit, self.scrapers))

    def start(self, scrapers):
        for scraper in scrapers:
            temp = SearchScraper(scraper["name"], scraper["search_string"], scraper["rate_limit"], self.api,
                                 self.producer)
            if (self.get_requests_per_period() + scraper["rate_limit"] > self.rate_limit):
                logging.error("Could not start scraper " + scraper["name"] + " because rate limit would be exceded")
            else:
                self.scrapers.append(temp)
                print("Starting " + scraper["name"])
                temp.start()
