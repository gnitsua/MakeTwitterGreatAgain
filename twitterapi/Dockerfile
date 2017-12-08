FROM python:alpine3.6
RUN pip install tweepy
RUN pip install kafka

ADD . /twitterapi/
WORKDIR /twitterapi

CMD ["python", "main.py"]