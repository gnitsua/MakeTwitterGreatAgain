var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
require('dotenv').config();

var index = require('./routes/index');
var users = require('./routes/users');

var Sequelize = require('sequelize');
var sequelize = new Sequelize('replies', 'user', 'pass',
  {
    host: process.env.MYSQL_HOST,
    dialect: 'mysql',
    define: {
      timestamps: false,
      charset: 'utf8mb4',
    },
    logging: false
  });

const Reply = sequelize.define('reply', {
  tweet_id: {
    type: Sequelize.BIGINT,
    unique: true
  },
  created_at: Sequelize.DATE,
  full_text: Sequelize.TEXT,
  in_reply_to_status_id: Sequelize.BIGINT,
  cleaned: Sequelize.TEXT,
  sentiment: Sequelize.FLOAT
})

sequelize.sync()

var kafka = require('kafka-node')

kafka_url = process.env.ZOOKEEPER_HOST + ":" + process.env.ZOOKEEPER_PORT
var Consumer = kafka.Consumer
var client = new kafka.Client(kafka_url)
var consumer = new Consumer(
  client,
  [],
  { fromOffset: true }
);

consumer.on('message', function (message) {
  handleMessage(message);
});

consumer.addTopics([
    { topic: "replies_sentiment", partition: 0, offset: 0 }
  ],
  function () {
    console.log("topic added to consumer for listening")
  }
)
;

function handleMessage(message) {
  const reply = JSON.parse(message.value);
  Reply.create(reply).catch(Sequelize.ValidationError, function (err) {
	console.log("duplicate tweet")
  }).then("added tweet");
}


var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
