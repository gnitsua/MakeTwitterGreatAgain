import json
import logging

class ConfigReader:
    def __init__(self, config_file_url):
        try:  # try to read the config file, excepting if there is an issue
            with open(config_file_url, "r") as file:
                self.config = json.load(file)
        except FileNotFoundError as e:
            logging.error("Config file does not exist")
            raise e
        except json.decoder.JSONDecodeError as e:
            logging.error("Error reading JOSN file " + str(e.args))
            raise e

    def get_key(self,key):
        try:
            return self.config[key]
        except KeyError as e:
            logging.error("Error reading configuration, the following keys do not exist: " + str(e.args))
            raise e