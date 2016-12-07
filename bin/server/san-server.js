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
const defer                 = require('../async/defer');
const EventInterface        = require('../event-interface');
const paradigm              = require('../async/paradigm');
const prettyPrint           = require('../pretty-print');
const Request               = require('./request');
const Response              = require('./response');
const schemas               = require('./schemas');

const event = EventInterface.firer('server');
const map = new WeakMap();

module.exports = SanServer;

/**
 * Create a san-server instance.
 * @param configuration
 * @returns {SanServer}
 * @constructor
 */
function SanServer(configuration) {
    const config = schemas.server.normalize(Object.assign({}, copy(SanServer.defaults), configuration || {}));
    const factory = Object.create(SanServer.prototype);

    // store configuration for this factory
    map.set(factory, {
        config: config,
        handlers: {}
    });

    return factory;
}

/**
 * Have the server execute a request.
 * @name SanServer#request
 * @params {object} [request={}] An object that has request details.
 * @params {function} [callback] The function to call once the request has been processed.
 * @returns {Promise|undefined}
 */
SanServer.prototype.request = function(request, callback) {
    // handle argument variations
    if (arguments.length === 0) {
        request = {};
    } else if (arguments.length === 1 && typeof arguments[0] === 'function') {
        callback = arguments[0];
        request = {};
    }

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
            if (config.supportedMethods.indexOf(req.method) !== -1) return next();
            res.sendStatus(405);
        });
        chain.push(unhandled);

        // initialize variables
        const deferred = defer();
        const req = Request(request);
        const start = Date.now();
        let timeoutId;

        // listen for events related the the processing of the request
        const queue = config.logs.grouped ? [] : null;
        let prev = start;
        EventInterface.on(req, function (firer, action, message, event) {
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
            EventInterface.off(req);

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
 * Stop listening for an event.
 * @name SanServer#off
 * @param {string} type
 * @param {function} callback
 */
SanServer.prototype.off = function(type, callback) {

    // validate context
    if (!map.has(this)) {
        const err = Error('Invalid execution context. Must be an instance of SansServer. Currently: ' + this);
        err.code = 'ESSCTX';
        err.context = this;
        throw err;
    }

    const handlers = map.get(this).handlers;
    if (handlers.hasOwnProperty(type)) {
        const index = handlers[type].indexOf(callback);
        if (index !== -1) handlers[type].splice(index, 1);
    }
};

/**
 * Start listening for an event.
 * @name SanServer#on
 * @param {string} type
 * @param {function} callback
 */
SanServer.prototype.on = function(type, callback) {

    // validate context
    if (!map.has(this)) {
        const err = Error('Invalid execution context. Must be an instance of SansServer. Currently: ' + this);
        err.code = 'ESSCTX';
        err.context = this;
        throw err;
    }

    const handlers = map.get(this).handlers;
    if (typeof callback !== 'function') throw Error('Invalid handler specified. Expected a function. Received: ' + callback);
    if (!handlers.hasOwnProperty(type)) handlers[type] = [];
    if (handlers[type].indexOf(callback) === -1) handlers[type].push(callback);
};

/**
 * Specify a middleware to use.
 * @param {function} middleware...
 */
SanServer.prototype.use = function(middleware) {

    // validate context
    if (!map.has(this)) {
        const err = Error('Invalid execution context. Must be an instance of SansServer. Currently: ' + this);
        err.code = 'ESSCTX';
        err.context = this;
        throw err;
    }

    const config = map.get(this).config;
    for (let i = 0; i < arguments.length; i++) {
        const mw = arguments[i];
        if (typeof mw !== 'function') throw Error('Invalid middleware specified. Expected a function. Received: ' + mw);
        config.middleware.push(mw);
    }
};

SanServer.defaults = {
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
 * Make a simple object copy.
 * @param {object} obj
 * @returns {{}}
 */
function copy(obj) {
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (e) {
        return {};
    }
}

/**
 * Produce a consistent message from event data.
 * @param {object} config SanServer logs configuration.
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
 *
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
            callback(req, res, function (err) {
                if (err && !res.sent) res.send(err);
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
    res.sendStatus(400);
}