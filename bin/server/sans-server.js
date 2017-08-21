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
const Log                   = require('./log');
const prettyPrint           = require('../pretty-print');
const Request               = require('./request');
const Response              = require('./response');
const schemas               = require('./schemas');
const util                  = require('../util');

const event = Log.firer('server');
const map = new WeakMap();

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

    this._ = {
        config: config,
        middleware: [],
        hooks: {}
    };

    // use each middleware in configuration
    server.use.apply(server, config.middleware);

    return server;
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
 * @returns {Promise|undefined}
 *
 * @fires SansServer#request
 * @listens Request#log
 * @listens Response#log
 */
SansServer.prototype.request = function(request, callback) {
    // handle argument variations
    if (arguments.length === 0) {
        request = {};
    } else if (arguments.length === 1 && typeof arguments[0] === 'function') {
        callback = arguments[0];
        request = {};
    }

    try {

        // get middleware chain
        const config = this._.config;
        const middleware = this._.middleware.concat();
        const hooks = this._.hooks.concat();

        // use built-in post-processing middleware
        middleware.push(unhandled);

        // initialize variables
        const req = Request(this, request);
        const res = req.res;
        const start = Date.now();
        let timeoutId;

        /**
         * Request generated event.
         * @event SansServer#request
         * @type {Request}
         */
        this.emit('request', req);

        // listen for events related the the processing of the request
        const queue = config.logs.grouped ? [] : null;
        let prev = start;
        const logListener = function (firer, action, message, event) {
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
        };
        req.on('log', logListener);
        res.on('log', logListener);

        const promise = util.eventPromise(res, 'send', 'error');



        // get the promise of request resolution
        const promise = req.promise
            .catch(function(err) {
                const data = Response.error();
                data.error = err;
                return data;
            })
            .then(function(data) {
                const hasData = data && typeof data === 'object';
                const logData = {
                    statusCode: (hasData && data.statusCode) || 0,
                    location: (hasData && data.headers && typeof data.headers === 'object' && data.headers.location) || ''
                };

                // emit the end event
                const end = Date.now();
                const duration = end - start;
                const eventData = hasData ? Object.assign({}, data) : {};
                eventData.time = end;
                event(req, 'request-end', logData.statusCode + ' response status', eventData);

                // turn off event handling
                Log.off(req);

                // if grouped logging then log the events to the console now
                if (queue && !config.logs.silent) {
                    let log = logData.statusCode + ' ' + req.method + ' ' + req.url +
                        (logData.statusCode === 302 ? '\n  Redirect To: ' + logData.location  : '') +
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
                clearTimeout(timeoutId);

                return data;
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
            res.sendStatus(504);
        }, 1000 * config.timeout);

        // run the middleware
        run(chain, req, res);

        // return the result
        return paradigm(promise, callback);

    } catch (err) {
        return paradigm(Promise.reject(err), callback);
    }
};

/**
 * Specify a middleware to use.
 * @param {function} middleware...
 */
SansServer.prototype.use = function(middleware) {
    validateContext(this);

    const server = this;
    const middlewares = map.get(this).middleware;

    for (let i = 0; i < arguments.length; i++) {
        const mw = arguments[i];
        if (typeof mw !== 'function') throw Error('Invalid middleware specified. Expected a function. Received: ' + mw);

        const name = mw.name || 'middleware-' + (middlewares.length + 1);
        const logger = Log.firer(name.replace(/([A-Z])/g, function($1){return "_" + $1}));
        const wrapped = function(req, res, next) {
            server.log = function(title, message, details) {
                logger(req, title, message, details);
            };
            mw.call(server, req, res, next);
        };
        wrapped.middlewareName = name;
        middlewares.push(wrapped);
    }
};

SansServer.prototype.hook = function(hook) {
    validateContext(this);

    const length = arguments.length;
    const hooks = map.get(this).config.hooks;

    for (let i = 0; i < length; i++) {
        const hook = arguments[i];
        if (typeof hook !== 'function') throw Error('Invalid hook specified. Expected a function. Received: ' + hook);
        hooks.push(hook);
    }
};

/**
 * Expose the server emitter to allow emitting of events and adding or removing event listeners.
 * @type {Emitter}
 */
SansServer.emitter = emitter;

/**
 * Expose the request constructor. Useful for writing tests for plugins.
 * @type {Request}
 */
SansServer.Request = Request;

/**
 * Expose the response constructor. Useful for writing tests for plugins.
 * @type {Response}
 */
SansServer.Response = Response;

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
        (config.verbose && data.event && typeof data.event === 'object'
            ? '\n\t' + JSON.stringify(data.event, null, '  ').replace(/^/gm, '\t')
            : '');
}

/**
 * Check to see if the request matches a supported method.
 * @param {object} config
 * @returns {Function}
 */
function methodChecks(config) {
    // build a map of supported methods
    const methods = config.supportedMethods.reduce(function(prev, key) {
        prev[key] = true;
        return prev;
    }, {});

    // return middleware
    return function methodChecks(req, res, next) {
        if (methods[req.method]) return next();
        res.sendStatus(405);
    }
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
        const name = callback.middlewareName;
        event(req, 'middleware', 'Begin middleware: ' + name, { name: name });
        try {
            callback(req, res, function (err) {
                if (err) event(req, 'middleware', 'Error running middleware: ' + name + '. ' + err.stack, { name: name, error: err });
                if (err && !res.sent) return res.send(err);
                event(req, 'middleware', 'End middleware: ' + name, { name: name });
                run(chain, req, res);
            });
        } catch (e) {
            event(req, 'middleware', 'Unexpected error running middleware: ' + name + '. ' + e.stack, { name: name, error: e });
            event(req, 'middleware', 'End middleware: ' + name, { name: name });
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
    if (res.state.statusCode === 0) {
        res.sendStatus(404);
    } else {
        res.send();
    }
}
unhandled.middlewareName = 'unhandled';

/**
 * Validate context or throw an error.
 * @param {SansServer} context
 */
function validateContext(context) {
    if (!map.has(context)) {
        const err = Error('Invalid execution context. Must be an instance of SansServer. Currently: ' + this);
        err.code = 'ESSCTX';
        err.context = this;
        throw err;
    }
}