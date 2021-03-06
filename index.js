/*!
 * snapshot - index.js
 * Copyright(c) 2014 dead_horse <dead_horse@qq.com>
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 */

var copy = require('copy-to');

var defaultOptions = {
  max: 50 * 1024 * 1024,  // 50mb
  maxAge: 12 * 60 * 60 * 1000,  // 12h
  length: function (n) {
    return n.body ? n.body.length : 0;
  }
};

module.exports = function (options) {
  options = options || {};
  copy(defaultOptions).to(options);

  var cache = options.cache || require('lru-cache')(options);

  return function* snapshot(next) {
    try {
      yield *next;
    } catch (err) {
      return errorHandler(err, this);
    }
    getFromCache(this);
    setCache(this);
  };

  function setCache(ctx) {
    if (ctx.noSnapshot) return;
    // only cache html
    if (!ctx.response.is('html')) return;
    // only cache 2xx
    if ((ctx.status / 100 | 0) !== 2) return;
    // update cache
    cache.set(ctx.path, {
      body: ctx.body,
      type: ctx.response.get('Content-Type') || 'html'
    });
  }

  function getFromCache(ctx) {
    if (ctx.noSnapshot) return;
    if (ctx.status < 500) return;
    var c = cache.get(ctx.path);
    if (!c) return;

    ctx.type = c.type;
    ctx.body = c.body;
    ctx.set('X-Snapshot-Status', ctx.status || 500);
    ctx.status = 200;
    return;
  }

  function errorHandler(err, ctx) {
    if (ctx.noSnapshot) throw err;
    if (err.status && err.status < 500) throw err;
    var c = cache.get(ctx.path);
    if (!c) throw err;

    ctx.app.emit('error', err);
    ctx.type = c.type;
    ctx.body = c.body;
    ctx.set('X-Snapshot-Status', err.status || 500);
    return;
  }

};
