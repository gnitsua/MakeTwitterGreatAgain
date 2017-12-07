import json
import logging
from ScraperManager import ScraperManger

# logging.getLogger().setLevel(logging.DEBUG)

try:
    with open("scrapers.json") as file:
        scrapers = json.load(file)

    manager = ScraperManger()
    manager.start(scrapers)
except FileNotFoundError:
    logging.error("Could not find scraper config file")
    exit(1)
except json.decoder.JSONDecodeError as e:
    logging.error("Error in scraper config " + str(e.args))
    exit(1)
