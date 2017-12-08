FROM jupyter/pyspark-notebook

RUN pip install kafka

ADD . /afinnclassifier/
WORKDIR /afinnclassifier

CMD ["python", "main.py"]