var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const { createBullBoard } = require('bull-board')
const { BullAdapter } = require('bull-board/bullAdapter')
const { verifyWebhook } = require('./utill/verifyWebhook');

require('dotenv').config();

var indexRouter = require('./routes/index');
var { contractQueue, createProductQueue } = require("./utill/contractQueue");
var { ordersQueue } = require("./utill/ordersQueue");
var { transferQueue } = require("./utill/transferQueue");
const { LazyTxQueue } = require('./utill/customQueues');
const { genArtQueue } = require("./utill/genArtQueue");


var app = express();

app.use(logger('dev'));
app.use(express.json({ verify: verifyWebhook }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const { router, setQueues, replaceQueues, addQueue, removeQueue } = createBullBoard([
  new BullAdapter(contractQueue),
  new BullAdapter(ordersQueue),
  new BullAdapter(transferQueue),
  new BullAdapter(createProductQueue),
  new BullAdapter(genArtQueue),
  new BullAdapter(LazyTxQueue)
]);

app.use('/jobs/admin/bullui', router);
app.use('/admin/bullui', router);

app.use('/jobs', indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.json({
    msg: "error"
  });
});

module.exports = app;
