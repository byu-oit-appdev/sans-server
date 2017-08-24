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
const Middleware            = require('sans-server-middleware');
const prettyPrint           = require('../pretty-print');
const Request               = require('./request');
const schemas               = require('./schemas');
const util                  = require('../util');

module.exports = SansServer;

/**
 * Create a san-server instance.
 * @param {object} [configuration] Configuration options.
 * @param {Function[]} configuration.hooks An array of response hook functions to add to each request.
 * @param {object} [configuration.logs] An object configuring log output.
 * @param {boolean} [configuration.logs.duration=false] Set to true to show the time into the request at which the log occurred.
 * @param {boolean} [configuration.logs.grouped=true] Set to true to group all logs for a single request together before outputting to console.
 * @param {boolean} [configuration.logs.silent=false] Set to true to silence all logs.
 * @param {boolean} [configuration.logs.timeDiff=true] Set to true to show the time difference between log events.
 * @param {boolean} [configuration.logs.timestamp=false] Set to true to display the timestamp for each log event.
 * @param {boolean} [configuration.logs.verbose=false] Set to true to output more details about each log event.
 * @param {boolean} [configuration.methodCheck=true] Set to true to validate the HTTP method for each request.
 * @param {Function[]} configuration.middleware An array of middleware functions to add to each request.
 * @param {string[]} [configuration.supportedMethods=['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']] An array of supported HTTP methods.
 * @param {number} [configuration.timeout=30] The number of seconds to wait before timeout for a request.
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

    Object.defineProperty(this, '_', {
        configurable: false,
        enumerable: false,
        value: {
            config: config,
            hooks: {}
        }
    });
}

SansServer.prototype = Object.create(EventEmitter.prototype);
SansServer.prototype.name = 'SansServer';
SansServer.prototype.constructor = SansServer;

/**
 * Produce a server log event.
 * @param {string} [type='log'] A classification for the log event.
 * @param {string} message The log message.
 * @param {object} [details={}] An object listing details about the event. This value is visible in logs if log mode is set to verbose.
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
 * @param {object|string} [request={}] An object that has request details or a string that is a GET endpoint.
 * @param {function} [callback] The function to call once the request has been processed.
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
            const now = event.timestamp;
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
            const prefix = (/^Error/.test(err.message) ? '' : 'Error') +
                (err.code ? ' ' + err.code : '') + ': ';
            server.log('error', prefix + err.message, err); // TODO: can I use 'this' context?
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

            /**
             * If the sent request has an Error object in the body then emit the error.
             * @event Response#error
             * @type {Error}
             */
            server.emit('error', err);

            server.log('transform', 'Converting error to 500 response', { value: err });
            res.reset().status(500).body(httpStatus[500]);
        })
        .then(() => {
            clearTimeout(timeoutId);
            let body = res.state.body;

            // object conversion
            if (typeof body === 'object') {
                this.log('transform', 'Converting object to JSON string', { value: body });
                res.body(JSON.stringify(body)).set('Content-Type', 'application/json');
            }

            // force to string
            body = res.state.body;
            switch (typeof body) {
                case 'undefined':
                    this.log('transform', 'Setting body to empty string', { value: body });
                    res.body('');
                    break;
                case 'string':
                    break;
                default:
                    this.log('transform', 'Convert ' + (typeof body) + ' body to string', { value: body });
            }

            return res.state;
        });
    req._.deferred.promise = promise;

    // if logging is grouped then output the log now
    if (!config.logs.silent && config.logs.grouped) {
        promise.then(state => {
            const duration = queue[queue.length - 1].now - start;
            let log = state.statusCode + ' ' + req.method + ' ' + req.url +
                (state.statusCode === 302 ? '\n  Redirect To: ' + state.headers['location']  : '') +
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
    const args = Array.from(arguments);
    args.unshift('request');
    this.hook.apply(this, args);
};

/**
 * Specify a hook to use.
 * @param {string} type
 * @param {...Function} hook
 * @throws {MetaError}
 */
SansServer.prototype.hook = function(type, hook) {
    const length = arguments.length;
    const hooks = this._.hooks;
    if (!hooks[type]) hooks[type] = new Middleware(this, type);
    const store = hooks[type];
    for (let i = 1; i < length; i++) store.add(arguments[i]);
};


/**
 * Produce a consistent message from event data.
 * @private
 * @param {object} config SansServer logs configuration.
 * @param {object} data
 * @returns {string}
 */
function eventMessage(config, data) {
    return prettyPrint.fixedLength(data.category, 15) + '  ' +
        prettyPrint.fixedLength(data.action, 15) + '  ' +
        (config.grouped ? '' : data.requestId + '  ') +
        (config.timestamp ? new Date(data.now).toISOString() + '  ' : '') +
        (config.timeDiff ? '+' + prettyPrint.seconds(data.diff) + '  ' : '') +
        (config.duration ? '@' + prettyPrint.seconds(data.duration) + '  ' : '') +
        data.message +
        (config.verbose && data.event && typeof data.event === 'object'
            ? '\n\t' + JSON.stringify(data.event, null, '  ').replace(/^/gm, '\t')
            : '');
}

/**
 * Built in middleware to handle any requests that fall through unhandled.
 * @private
 * @param {Response} res
 */
function unhandled(res) {
    if (res.state.code === 0) {
        res.sendStatus(404);
    } else {
        res.send();
    }
}