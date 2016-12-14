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
const deepMerge             = require('deepmerge');
const defer                 = require('../async/defer');
const emitter               = require('../emitter');
const Log                   = require('./log');
const prettyPrint           = require('../pretty-print');
const Request               = require('./request');
const Response              = require('./response');
const schemas               = require('./schemas');

const event = Log.firer('server');
const map = new WeakMap();
const nonBodyMethods = ['GET', 'COPY', 'HEAD', 'OPTIONS', 'PURGE'];

module.exports = SansServer;

/**
 * Create a san-server instance.
 * @param configuration
 * @returns {SansServer}
 * @constructor
 */
function SansServer(configuration) {
    const merged = deepMerge(SansServer.defaults, configuration || {}, {
        arrayMerge: function(dest, src) {
            const copy = dest.slice();
            src.forEach(function(item) {
                if (copy.indexOf(src) === -1) copy.push(item);
            });
            return copy;
        },
        clone: true
    });
    const config = schemas.server.normalize(merged);
    const server = Object.create(SansServer.prototype);

    // store configuration for this factory
    map.set(server, {
        config: config,
        middleware: []
    });

    // use each middleware in configuration
    server.use.apply(server, config.middleware);

    return server;
}

/**
 * Fire an event that is specific to this SansServer instance.
 * @param {string} name The event name.
 * @param {...*} args Arguments to pass with the event.
 */
SansServer.prototype.emit = function(name, args) {
    emitter.emit.call(this, arguments);
};

/**
 * Produce a logger function. A great tool for middleware to log events.
 * @param {string} name The name to produce all log events under.
 * @returns {Function}
 */
SansServer.prototype.logger = function(name) {
    return Log.firer(name);
};

/**
 * Have the server execute a request.
 * @name SansServer#request
 * @params {object|string} [request={}] An object that has request details or a string that is a GET endpoint.
 * @params {function} [callback] The function to call once the request has been processed.
 * @returns {Promise|undefined}
 */
SansServer.prototype.request = function(request, callback) {
    // handle argument variations
    if (arguments.length === 0) {
        request = {};
    } else if (arguments.length === 1 && typeof arguments[0] === 'function') {
        callback = arguments[0];
        request = {};
    }

    // if the request is a string then wrap it
    if (typeof request === 'string') request = { path: request };

    // validate context
    if (!map.has(this)) {
        const err = Error('Invalid execution context. Must be an instance of SansServer. Currently: ' + this);
        err.code = 'ESSCTX';
        err.context = this;
        return paradigm(Promise.reject(err), callback);
    }

    try {
        // get middleware chain
        const config = map.get(this).config;
        const chain = config.middleware.concat();
        chain.unshift(function(req, res, next) {
            if (config.supportedMethods.indexOf(req.method) === -1) return res.sendStatus(405);
            if (req.body && nonBodyMethods.indexOf(req.method) !== -1) {
                event(req, 'client-error', req.method + ' cannot send body', { body: req.body });
            }
            next();
        });
        chain.unshift(jsonBody);
        chain.push(unhandled);

        // initialize variables
        const deferred = defer();
        const req = Request(request);
        const start = Date.now();
        let timeoutId;

        // listen for events related the the processing of the request
        const queue = config.logs.grouped ? [] : null;
        let prev = start;
        Log.on(req, function (firer, action, message, event) {
            if (!config.logs.silent) {
                const now = Date.now();
                const data = {
                    action: action,
                    diff: now - prev,
                    duration: now - start,
                    event: event,
                    firer: firer,
                    message: message,
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
        });

        // build the response handler
        const res = Response(req, function (err, data) {

            // emit the end event
            const end = Date.now();
            const duration = end - start;
            event(req, 'request-end', data.statusCode + ' response status', {
                error: err,
                response: data,
                time: end
            });

            // turn off event handling
            Log.off(req);

            // if grouped logging then log the events to the console now
            if (queue && !config.logs.silent) {
                let log = data.statusCode + ' ' + req.method + ' ' + req.url +
                    (data.statusCode === 302 ? '\n  Redirect To: ' + data.headers.Location : '') +
                    '\n  ID: ' + req.id +
                    '\n  Start: ' + new Date(start).toISOString() +
                    '\n  Duration: ' + prettyPrint.seconds(duration) +
                    '\n  Events:\n    ' +
                    queue.map(function (data) {
                        return eventMessage(config.logs, data);
                    }).join('\n    ');
                console.log(log);
            }

            // clear the timeout
            if (timeoutId) clearTimeout(timeoutId);

            if (err) data.error = err;
            deferred.resolve(data);
        });

        // create and emit the start event
        event(req, 'request-start', req.method + ' ' + req.path, {
            body: req.body,
            headers: req.headers,
            method: req.method,
            path: req.path,
            query: req.query,
            time: start
        });

        timeoutId = setTimeout(function () {
            if (!res.sent) res.sendStatus(408);
        }, 1000 * config.timeout);

        // run the middleware
        run(chain, req, res);

        // return the result
        return paradigm(deferred.promise, callback);

    } catch (err) {
        return paradigm(Promise.reject(err), callback);
    }
};

/**
 * Get an array of methods supported by the server.
 * @returns {string[]}
 */
SansServer.prototype.supportedMethods = function() {
    // validate context
    if (!map.has(this)) {
        const err = Error('Invalid execution context. Must be an instance of SansServer. Currently: ' + this);
        err.code = 'ESSCTX';
        err.context = this;
        throw err;
    }

    return map.get(this).config.supportedMethods.slice(0);
};

/**
 * Specify a middleware to use.
 * @param {function} middleware...
 */
SansServer.prototype.use = function(middleware) {

    // validate context
    if (!map.has(this)) {
        const err = Error('Invalid execution context. Must be an instance of SansServer. Currently: ' + this);
        err.code = 'ESSCTX';
        err.context = this;
        throw err;
    }

    const server = map.get(this);
    const middlewares = server.middleware;

    for (let i = 0; i < arguments.length; i++) {
        const mw = arguments[i];
        if (typeof mw !== 'function') throw Error('Invalid middleware specified. Expected a function. Received: ' + mw);

        const logger = Log.firer(mw.name || 'middleware-' + (middlewares.length + 1));
        const wrapped = function(req, res, next) {
            server.log = function(title, message, details) {
                logger(req, title, message, details);
            };
            mw.call(server, req, res, next);
        };
        middlewares.push(wrapped);
    }
};

/**
 * THe server configuration defaults to use when instantiating an instance.
 * @type {{logs: {duration: boolean, grouped: boolean, silent: boolean, timeDiff: boolean, timeStamp: boolean, verbose: boolean}, middleware: Array, supportedMethods: (*), timeout: number}}
 */
SansServer.defaults = {
    logs: {
        duration: false,
        grouped: true,
        silent: false,
        timeDiff: true,
        timeStamp: false,
        verbose: false
    },
    middleware: [],
    supportedMethods: schemas.server.httpMethods.slice(0),
    timeout: 30
};

/**
 * Expose the server emitter to allow emitting of events and adding or removing event listeners.
 * @type {Emitter}
 */
SansServer.emitter = emitter;

/**
 * Produce a consistent message from event data.
 * @param {object} config SansServer logs configuration.
 * @param {object} data
 * @returns {string}
 */
function eventMessage(config, data) {
    return prettyPrint.fixedLength(data.firer, 15) + '  ' +
        prettyPrint.fixedLength(data.action, 15) + '  ' +
        (config.grouped ? '' : data.requestId + '  ') +
        (config.timeStamp ? new Date(data.now).toISOString() + '  ' : '') +
        (config.timeDiff ? '+' + prettyPrint.seconds(data.diff) + '  ' : '') +
        (config.duration ? '@' + prettyPrint.seconds(data.duration) + '  ' : '') +
        data.message +
        (config.verbose ? '\n\t' + JSON.stringify(data.event, null, '  ').replace(/^/gm, '\t') : '');
}

/**
 * Middleware function that will attempt to parse the request body as JSON if the content type is set to application/json
 * @param req
 * @param res
 * @param next
 */
function jsonBody(req, res, next) {
    if (req.headers['Content-Type'] === 'application/json' && typeof req.body === 'string' && req.body) {
        try {
            req.body = JSON.parse(req.body);
        } catch (err) {
            event(req, 'client-error', 'Body provided invalid JSON', {
                body: req.body,
                error: err.stack
            });
            return res.sendStatus(400);
        }
    }
    next();
}

/**
 * Handle callback or promise paradigm.
 * @param {Promise} promise
 * @param {Function|undefined} callback
 * @returns {Promise|undefined}
 */
function paradigm(promise, callback) {
    const p = promise.then(
        function(res) { return res },
        function(err) {
            const res = Response.error();
            res.error = err;
            return res;
        }
    );
    if (typeof callback !== 'function') return p;
    p.then(function(res) { callback(res); });
}

/**
 * Run middleware chain.
 * @param {function[]} chain
 * @param {Request} req
 * @param {Response} res
 */
function run(chain, req, res) {
    if (chain.length > 0 && !res.sent) {
        const callback = chain.shift();
        event(req, 'run-middleware', callback.name, {
            name: callback.name
        });
        try {
            callback.call(req, res, function (err) {
                if (err && !res.sent) return res.send(err);
                run(chain, req, res);
            });
        } catch (e) {
            res.send(e);
        }
    }
}

/**
 * Built in middleware to handle any requests that fall through unhandled.
 * @param {Request} req
 * @param {Response} res
 */
function unhandled(req, res) {
    res.sendStatus(404);
}