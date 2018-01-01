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
        self.rate_limits = self.tweep_rate_limits_to_dictionary(self.api.rate_limit_status())
        self.scrapers = []
        kafka_url = "{:s}:{:s}".format(config.get_key("KAFKA_HOST"), config.get_key("KAFKA_PORT"))
        try:
            kafka = SimpleClient(kafka_url, timeout=60)
        except KafkaUnavailableError as e:
            logging.error("Could not connect to Kafka2")
            raise e

        self.producer = SimpleProducer(kafka)

    def start(self, scrapers):
        pass
        for scraper in scrapers:
            try:
                if (scraper["type"] == "/search/tweets"):
                    temp = SearchScraper(scraper["name"], scraper["search_string"], scraper["rate_limit"], self.api,
                                         self.producer)
                else:
                    logging.error("Could not start scraper " + scraper["name"] + " because not a valid scraper type")
                    raise NotImplementedError()

                if (self.rate_limits[scraper["type"]] - scraper["rate_limit"] < 0):
                    logging.error("Could not start scraper " + scraper["name"] + " because rate limit would be exeeded")
                    raise AssertionError()
                else:
                    self.rate_limits[scraper["type"]] = self.rate_limits[scraper["type"]] - scraper[
                        "rate_limit"]  # update the rate remaining
                    self.scrapers.append(temp)
                    print("Starting " + scraper["name"])
                    temp.start()
            except (NotImplementedError, AssertionError):
                pass

    def tweep_rate_limits_to_dictionary(self, tweepy_rate_limits):
        result = {}
        for resource in tweepy_rate_limits["resources"].values():  # throw away resource name because we don't care
            for type, data in resource.items():
                result[type] = data["limit"]
        return result
