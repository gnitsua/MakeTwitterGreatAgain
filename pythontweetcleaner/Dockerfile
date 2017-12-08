FROM jupyter/pyspark-notebook

RUN pip install kafka

ADD . /pythontweetcleaner/
WORKDIR /pythontweetcleaner

CMD ["python", "main.py"]