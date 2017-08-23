/**
 *  @license
 *    Copyright 2016 Brigham Young University
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 **/
'use strict';
const EventEmitter          = require('events');
const httpStatus            = require('http-status');
const Middleware            = require('./middleware');
const prettyPrint           = require('../pretty-print');
const Request               = require('./request');
const schemas               = require('./schemas');
const util                  = require('../util');

module.exports = SansServer;

/**
 * Create a san-server instance.
 * @param [configuration]
 * @returns {SansServer}
 * @constructor
 * @augments {EventEmitter}
 */
function SansServer(configuration) {
    if (!(this instanceof SansServer)) return new SansServer(configuration);
    if (!configuration) configuration = {};
    if (configuration.logs === 'silent') configuration.logs = { silent: true };
    if (configuration.logs === 'verbose') configuration.logs = { verbose: true };
    const config = schemas.server.normalize(configuration);

    const middleware = new Middleware(this, 'middleware', 'MW', false);
    const hooks = new Middleware(this, 'hook', 'HK', true);

    config.middleware.forEach(middleware.add);
    config.hooks.forEach(hooks.add);

    Object.defineProperty(this, '_', {
        configurable: false,
        enumerable: false,
        value: {
            config: config,
            middleware: middleware,
            hooks: hooks
        }
    });
}

SansServer.prototype = Object.create(EventEmitter.prototype);
SansServer.prototype.name = 'SansServer';
SansServer.prototype.constructor = SansServer;

/**
 * Produce a log event. This function is overwritten by middleware runner.
 * @param {string} type
 * @param {string} message
 * @param {object} [details]
 * @fires SansServer#log
 */
SansServer.prototype.log = function(type, message, details) {

    /**
     * A log event.
     * @event SansServer#log
     * @type {LogEvent}
     */
    this.emit('log', util.log('SERVER', arguments));
};

/**
 * Have the server execute a request.
 * @name SansServer#request
 * @params {object|string} [request={}] An object that has request details or a string that is a GET endpoint.
 * @params {function} [callback] The function to call once the request has been processed.
 * @returns {Promise<ResponseState>}
 *
 * @fires SansServer#request
 * @listens SansServer#log
 * @listens Request#log
 * @listens Response#log
 * @listens SansServer#error
 * @listens Request#error
 * @listens Response#error
 */
SansServer.prototype.request = function(request, callback) {
    const server = this;
    const start = Date.now();

    // handle argument variations and get Request instance
    if (arguments.length === 0) {
        request = Request();

    } else if (arguments.length === 1 && typeof arguments[0] === 'function') {
        callback = arguments[0];
        request = Request();

    } else if (!(request instanceof Request)) {
        try {
            request = Request(request);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // initialize variables
    const config = this._.config;
    const middleware = this._.middleware;
    const hooks = this._.hooks;
    const req = request;
    const res = req.res;
    const timeoutId = setTimeout(() => res.sent ? null : res.sendStatus(504), 1000 * config.timeout);

    // event log aggregation
    const queue = config.logs.grouped ? [] : null;
    let prev = start;
    const logListener = function (event) {
        if (!config.logs.silent) {
            const now = Date.now();
            const data = {
                action: event.action,
                category: event.category,
                details: event.details,
                diff: now - prev,
                duration: now - start,
                message: event.message,
                now: now,
                requestId: req.id
            };
            prev = now;
            if (config.logs.grouped) {
                queue.push(data);
            } else {
                console.log(eventMessage(config.logs, data));
            }
        }
    };
    server.on('log', logListener);
    req.on('log', logListener);
    res.on('log', logListener);

    // error handler and listeners
    const errorHandler = function(err) {
        if (!res.sent) res.send(err);
        if (!err.logged) {
            err.logged = true;
            console.error(err.stack);
        }
    };
    server.on('error', errorHandler);
    req.on('error', errorHandler);
    res.on('error', errorHandler);

    /**
     * Request generated event.
     * @event SansServer#request
     * @type {Request}
     */
    this.emit('request', req);

    // update the request promise to follow hooks and resolve to response state
    const promise = req._.deferred.promise
        .then(() => hooks.run(req, res))
        .catch(err => {
            const message = err.message;
            const prefix = (/^Error/.test(message) ? '' : 'Error') +
                (err.code ? ' ' + err.code : '') + ': ';
            server.log('error', prefix + err.message, err);
            res.reset().status(500).body(httpStatus[500]);
        })
        .then(() => {
            clearTimeout(timeoutId);
            return res.state;
        });
    req._.deferred.promise = promise;

    // if logging is grouped then output the log now
    if (!config.logs.silent && config.logs.grouped) {
        promise.then(state => {
            const duration = queue[queue.length - 1].now - start;
            let log = state.status + ' ' + req.method + ' ' + req.url +
                (state.status === 302 ? '\n  Redirect To: ' + state.headers['location']  : '') +
                '\n  ID: ' + req.id +
                '\n  Start: ' + new Date(start).toISOString() +
                '\n  Duration: ' + prettyPrint.seconds(duration) +
                '\n  Events:\n    ' +
                queue.map(function (data) {
                    return eventMessage(config.logs, data);
                }).join('\n    ');
            console.log(log);
        });
    }

    // allow other code to run before starting request processing - allows adding event listeners
    process.nextTick(() => {

        // make sure the method is valid
        if (config.methodCheck && config.supportedMethods.indexOf(req.method) === -1) {
            res.sendStatus(405);
        }

        // run middleware and if it has an uncaught error then send an error response
        if (!res.sent) middleware.run(req, res).then(() => unhandled(res), errorHandler);
    });

    // is using a callback paradigm then execute the callback
    if (typeof callback === 'function') {
        promise.then(value => callback(null, value), err => callback(err, null));
    }

    return req;
};

/**
 * Specify a middleware to use.
 * @param {...Function} middleware
 * @throws {MetaError}
 */
SansServer.prototype.use = function(middleware) {
    const length = arguments.length;
    const store = this._.middleware;
    for (let i = 0; i < length; i++) store.add(arguments[i]);
};

/**
 * Specify a hook to use.
 * @param {...Function} hook
 * @throws {MetaError}
 */
SansServer.prototype.hook = function(hook) {
    const length = arguments.length;
    const store = this._.hooks;
    for (let i = 0; i < length; i++) store.add(arguments[i]);
};


/**
 * Produce a consistent message from event data.
 * @param {object} config SansServer logs configuration.
 * @param {object} data
 * @returns {string}
 */
function eventMessage(config, data) {
    return prettyPrint.fixedLength(data.category, 15) + '  ' +
        prettyPrint.fixedLength(data.action, 15) + '  ' +
        (config.grouped ? '' : data.requestId + '  ') +
        (config.timeStamp ? new Date(data.now).toISOString() + '  ' : '') +
        (config.timeDiff ? '+' + prettyPrint.seconds(data.diff) + '  ' : '') +
        (config.duration ? '@' + prettyPrint.seconds(data.duration) + '  ' : '') +
        data.message +
        (config.verbose && data.event && typeof data.event === 'object'
            ? '\n\t' + JSON.stringify(data.event, null, '  ').replace(/^/gm, '\t')
            : '');
}

/**
 * Built in middleware to handle any requests that fall through unhandled.
 * @param {Response} res
 */
function unhandled(res) {
    if (res.state.code === 0) {
        res.sendStatus(404);
    } else {
        res.send();
    }
}