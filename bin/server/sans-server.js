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
const prettyPrint           = require('../pretty-print');
const Request               = require('./request');
const schema                = require('./schemas').server;

const STORE = Symbol('store');

module.exports = SansServer;

/**
 * Create a san-server instance.
 * @param {object} [configuration] Configuration options.
 * @param {object} [configuration.logs] An object configuring log output.
 * @param {boolean} [configuration.logs.duration=false] Set to true to show the time into the request at which the log occurred.
 * @param {boolean} [configuration.logs.grouped=true] Set to true to group all logs for a single request together before outputting to console.
 * @param {boolean} [configuration.logs.silent=false] Set to true to silence all logs.
 * @param {boolean} [configuration.logs.timeDiff=true] Set to true to show the time difference between log events.
 * @param {boolean} [configuration.logs.timestamp=false] Set to true to display the timestamp for each log event.
 * @param {boolean} [configuration.logs.verbose=false] Set to true to output more details about each log event.
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

    const config = schema.normalize(configuration);
    const hooks = {};
    const runners = {
        symbols: {},
        types: {}
    };

    // define the store
    const store = {
        config: config,
        keys: {},
        hooks: hooks,
        runners: runners
    };
    this[STORE] = store;

    /**
     * Define a hook runner and get back a Symbol that is used to execute the hooks.
     * @name SansServer#hook.define
     * @function
     * @param {string} type
     * @returns {Symbol}
     */
    this.hook.define = defineHookRunner.bind(this, runners);

    /**
     * Get the hook type for a specific symbol.
     * @name SansServer#hook.type
     * @function
     * @param {Symbol} key The symbol to use to get they type.
     * @returns {string}
     */
    this.hook.type = getHookType.bind(this, runners);

    // define the request and response hooks
    store.keys.request = this.hook.define('request');
    store.keys.response = this.hook.define('response');

    // set request hooks
    if (config.timeout) this.hook('request', -10000, timeout(config.timeout));
    this.hook('request', -100000, validMethod);
    this.hook('request', 100000, unhandled);
    this.hook('request', 100000, error);

    // set response hooks
    this.hook('response', 100000, transform);
    this.hook('response', 100000, error);
}

SansServer.prototype = Object.create(EventEmitter.prototype);
Request.prototype.name = 'SansServer';
Request.prototype.constructor = SansServer;

/**
 * Define a hook that is applied to all requests.
 * @param {string} type
 * @param {number} [weight=0]
 * @param {...function} hook
 * @returns {SansServer}
 */
SansServer.prototype.hook = function(type, weight, hook) {
    const length = arguments.length;
    const hooks = this[STORE].hooks;
    let start = 1;

    // handle variable input parameters
    if (typeof arguments[1] === 'number') {
        start = 2;
    } else {
        weight = 0;
    }

    if (!hooks[type]) hooks[type] = [];
    const store = hooks[type];
    for (let i = start; i < length; i++) {
        const hook = arguments[i];
        if (typeof hook !== 'function') {
            const err = Error('Invalid hook specified. Expected a function. Received: ' + hook);
            err.code = 'ESHOOK';
            throw err;
        }
        store.push({ weight: weight, hook: hook });
    }

    return this;
};

/**
 * Have the server execute a request.
 * @param {object|string} [request={}] An object that has request details or a string that is a GET endpoint.
 * @param {function} [callback] The function to call once the request has been processed.
 * @returns {Request}
 * @listens Request#log
 */
SansServer.prototype.request = function(request, callback) {
    const args = arguments;
    const start = Date.now();
    const store = this[STORE];

    // handle argument variations and get Request instance
    const req = (function() {
        const length = args.length;
        if (length === 0) {
            return Request(this, store.keys);

        } else if (length === 1 && typeof args[0] === 'function') {
            callback = args[0];
            return Request(this, store.keys);

        } else {
            return Request(this, store.keys, request);
        }
    })();

    // initialize variables
    const config = store.config;
    const hooks = store.hooks;

    // copy hooks into request
    Object.keys(hooks).forEach(type => {
        hooks[type].forEach(d => {
            req.hook(type, d.weight, d.hook)
        });
    });

    // event log aggregation
    const queue = config.logs.grouped ? [] : null;
    if (!config.logs.silent) {
        let prev = start;
        req.on('log', event => {
            const now = event.timestamp || Date.now();
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
                console.log(eventMessage({ action: 18, category: 18 }, config.logs, data));
            }
        });
    }

    // if logging is grouped then output the log now
    if (!config.logs.silent && config.logs.grouped) {
        req.then(state => {
            const duration = queue[queue.length - 1].now - start;
            const longest = { action: 0, category: 0 };
            queue.forEach(item => {
                const actionLength = item.action.length;
                const categoryLength = item.category.length;
                if (actionLength > longest.action) longest.action = actionLength;
                if (categoryLength > longest.category) longest.category = categoryLength;
            });

            let log = state.statusCode + ' ' + req.method + ' ' + req.url +
                (state.statusCode === 302 ? '\n  Redirect To: ' + state.headers['location']  : '') +
                '\n  ID: ' + req.id +
                '\n  Start: ' + new Date(start).toISOString() +
                '\n  Duration: ' + prettyPrint.seconds(duration) +
                '\n  Events:\n    ' +
                queue.map(function (data) {
                    return eventMessage(longest, config.logs, data);
                }).join('\n    ');
            console.log(log);
        });
    }

    // is using a callback paradigm then execute the callback
    if (typeof callback === 'function') req.then(callback);

    return req;
};

/**
 * Specify a middleware to use.
 * @param {...Function} middleware
 * @throws {Error}
 * @returns {SansServer}
 */
SansServer.prototype.use = function(middleware) {
    const args = Array.from(arguments);
    args.unshift('request', 0);
    this.hook.apply(this, args);
    return this;
};


/**
 * Define a hook runner by specifying a unique type that can only be executed using the symbol returned.
 * @param {{types: object, symbols: object}} runners
 * @param {string} type
 * @returns {Symbol}
 */
function defineHookRunner(runners, type) {
    if (runners.hasOwnProperty(type)) {
        const err = Error('There is already a hook runner defined for this type: ' + type);
        err.code = 'ESHOOK';
        throw err;
    }

    const s = Symbol(type);
    runners.types[type] = s;
    runners.symbols[s] = type;

    return s;
}

/**
 * Error catching middleware.
 * @param {Error} err
 * @param {Request} req
 * @param {Response} res
 * @param {function} next
 */
function error(err, req, res, next) {
    if (!res.sent) {
        res.send(err);
    } else {
        res.log('error', err.stack.replace(/\n/g, '\n  '), err);
        res.set('content-type', 'text/plain').status(500).body(httpStatus[500]);
        next();
    }
}

/**
 * Produce a consistent message from event data.
 * @private
 * @param {object} lengths
 * @param {object} config SansServer logs configuration.
 * @param {object} data
 * @returns {string}
 */
function eventMessage(lengths, config, data) {
    const totalLength = lengths.action + lengths.category;
    const maxLength = 36;
    if (totalLength > maxLength) {
        const percent = lengths.action / totalLength;
        const larger = percent >= .5;
        lengths.action = Math[larger ? 'ceil': 'floor'](lengths.action / maxLength);
        lengths.category = Math[larger ? 'floor': 'ceil'](lengths.category / maxLength);
    }

    return prettyPrint.fixedLength(data.category.toLowerCase(), lengths.category) + '  ' +
        prettyPrint.fixedLength(data.action, lengths.action) + '  ' +
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
 * Get the hook type for a specific symbol.
 * @param {{types: object, symbols: object}} runners
 * @param {Symbol} key The symbol to use to get they type.
 * @returns {string}
 */
function getHookType(runners, key) {
    return runners.symbols[key];
}

/**
 * Request middleware to apply timeouts to the request.
 * @param {number} seconds
 * @returns {function}
 */
function timeout(seconds) {
    return function timeoutSet(req, res, next) {
        const timeoutId = setTimeout(() => {
            if (!res.sent) res.sendStatus(504)
        }, 1000 * seconds);

        req.hook('response', 10001, function timeoutClear(req, res, next) {
            clearTimeout(timeoutId);
            next();
        });

        next();
    };
}

/**
 * Response middleware for transforming the response body and setting content type.
 * @param {Request} req
 * @param {Response} res
 * @param {function} next
 */
function transform(req, res, next) {
    const state = res.state;
    const body = state.body;
    const type = typeof body;
    const isBuffer = body instanceof Buffer;

    // error conversion
    if (body instanceof Error) {
        res.log('transform', 'Converting Error to response', { value: body });
        res.status(500).body(httpStatus[500]).set('content-type', 'text/plain');

    // object conversion and content type
    } else if (type === 'object' && !isBuffer) {
        res.log('transform', 'Converting object to JSON string', { value: body });
        res.body(JSON.stringify(body));
    }

    // set content type if not yet set
    if (!state.headers.hasOwnProperty('content-type')) {
        res.log('transform', 'Modify content type');
        if (isBuffer) {
            res.set('Content-Type', 'application/octet-stream');
        } else if (type === 'object') {
            res.set('Content-Type', 'application/json');
        } else {
            res.set('Content-Type', 'text/html');
        }
    }

    next();
}

/**
 * Middleware to run if request goes unfulfilled.
 * @param {Request} req
 * @param {Response} res
 */
function unhandled(req, res) {
    req.log('unhandled', 'request not handled');
    if (res.state.statusCode === 0) {
        res.sendStatus(404);
    } else {
        res.send();
    }
}

/**
 * Middleware to make sure the method is valid.
 * @param {Request} req
 * @param {Response} res
 * @param {function} next
 */
function validMethod(req, res, next) {
    if (schema.httpMethods.indexOf(req.method) === -1) {
        res.sendStatus(405);
    } else {
        next();
    }
}