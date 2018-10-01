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
const httpStatus            = require('http-status');
const prettyPrint           = require('../pretty-print');
const Request               = require('./request');
const util                  = require('../util');

const httpMethods = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'];

module.exports = SansServer;

/**
 * Create a san-server instance.
 * @param {object} [configuration] Configuration options.
 * @param {boolean} [configuration.logs=true] Whether to output grouped logs at the end of a request.
 * @param {boolean} [configuration.rejectable=false] Whether an error while processing the request should cause a failure or return a 500 response.
 * @param {number} [configuration.timeout=30] The number of seconds to wait before timeout for a request.
 * @param {boolean} [configuration.useBuiltInHooks=true] Whether to use built in middleware.
 * @returns {SansServer}
 * @constructor
 */
function SansServer(configuration) {
    if (!(this instanceof SansServer)) return new SansServer(configuration);

    const config = configuration && typeof configuration === 'object' ? Object.assign(configuration) : {};
    config.logs = config.hasOwnProperty('logs') ? config.logs : true;
    config.rejectable = config.hasOwnProperty('rejectable') ? config.rejectable : false;
    config.timeout = config.hasOwnProperty('timeout') && !isNaN(config.timeout) && config.timeout >= 0 ? config.timeout : 30;
    config.useBuiltInHooks = config.hasOwnProperty('useBuiltInHooks') ? config.useBuiltInHooks : true;

    const hooks = {};
    const keys = {};
    const runners = {
        symbols: {},
        types: {}
    };
    const server = this;

    /**
     * Define a hook that is applied to all requests.
     * @param {string} type
     * @param {number} [weight=0]
     * @param {...function} hook
     * @returns {SansServer}
     */
    this.hook = addHook.bind(server, hooks);

    /**
     * Define a hook runner and get back a Symbol that is used to execute the hooks.
     * @name SansServer#hook.define
     * @function
     * @param {string} type
     * @returns {Symbol}
     */
    this.hook.define = type => defineHookRunner(runners, type);

    /**
     * Get the hook type for a specific symbol.
     * @name SansServer#hook.type
     * @function
     * @param {Symbol} key The symbol to use to get they type.
     * @returns {string}
     */
    this.hook.type = key => runners.symbols[key];

    /**
     * Have the server execute a request.
     * @param {object|string} [req={}] An object that has request details or a string that is a GET endpoint.
     * @param {function} [callback] The function to call once the request has been processed.
     * @returns {Request}
     * @listens Request#log
     */
    this.request = (req, callback) => request(server, config, hooks, keys, req, callback);

    /**
     * Specify a middleware to use.
     * @param {...Function} middleware
     * @throws {Error}
     * @returns {SansServer}
     */
    this.use = this.hook.bind(this, 'request', 0);



    // define the request and response hooks
    keys.request = this.hook.define('request');
    keys.response = this.hook.define('response');

    // set request hooks
    if (config.timeout) this.hook('request', Number.MIN_SAFE_INTEGER + 10, timeout(config.timeout));
    if (config.useBuiltInHooks) this.hook('request', -100000, validMethod);

    // set response hooks
    if (config.useBuiltInHooks) this.hook('response', -100000, transform);
}

/**
 * Expose built in hooks.
 * @type {{validateMethod: validMethod, transformResponse: transform}}
 */
SansServer.hooks = {
    validateMethod: validMethod,
    transformResponse: transform
};


/**
 * Define a hook that is applied to all requests.
 * @param {object} hooks
 * @param {string} type
 * @param {number} [weight=0]
 * @param {...function} hook
 * @returns {SansServer}
 */
function addHook(hooks, type, weight, hook) {
    const length = arguments.length;
    let start = 2;

    if (typeof type !== 'string') {
        const err = Error('Expected first parameter to be a string. Received: ' + type);
        err.code = 'ESHOOK';
        throw err;
    }

    // handle variable input parameters
    if (typeof arguments[2] === 'number') {
        start = 3;
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
}

/**
 * Define a hook runner by specifying a unique type that can only be executed using the symbol returned.
 * @param {{types: object, symbols: object}} runners
 * @param {string} type
 * @returns {Symbol}
 */
function defineHookRunner(runners, type) {
    if (runners.types.hasOwnProperty(type)) {
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
 * Get a request started.
 * @param {SansServer} server
 * @param {object} config
 * @param {object} hooks
 * @param {object} keys
 * @param {object} [request]
 * @param {function} [callback]
 */
function request(server, config, hooks, keys, request, callback) {
    const start = Date.now();

    if (typeof request === 'function' && typeof callback !== 'function') {
        callback = request;
        request = {};
    }

    // handle argument variations and get Request instance
    const args = Array.from(arguments).slice(4).filter(v => v !== undefined);
    const req = (function() {
        const length = args.length;
        if (length === 0) {
            return new Request(server, keys, config.rejectable);

        } else if (length === 1 && typeof args[0] === 'function') {
            callback = args[0];
            return new Request(server, keys, config.rejectable);

        } else {
            return new Request(server, keys, config.rejectable, request);
        }
    })();

    // event log aggregation
    const queue = config.logs ? [] : null;
    if (queue) req.on('log', event => queue.push(event));

    // if logging enabled then produce the log when the request is fulfilled or rejected
    if (queue) {
        const log = function(state) {
            const events = queue.map((event, index) => {
                const seconds = util.seconds(event.timestamp - (index > 0 ? queue[index - 1].timestamp : start));
                return '[+' + seconds + 's] ' + event.category + ':' + event.type + ' ' + event.data;
            });
            console.log(state.statusCode + ' ' + req.method + ' ' + req.url +
                (state.statusCode === 302 ? '\n  Redirect To: ' + state.headers['location']  : '') +
                '\n  ID: ' + req.id +
                '\n  Start: ' + new Date(start).toISOString() +
                '\n  Duration: ' + prettyPrint.seconds(Date.now() - start) +
                '\n  Events:\n    ' +
                events.join('\n    '));
        };
        req.then(log, () => log(req.res.state));
    }

    // copy hooks into request
    req.log('initialized');
    Object.keys(hooks).forEach(type => {
        hooks[type].forEach(d => {
            req.hook(type, d.weight, d.hook)
        });
    });
    req.log('hooks applied');

    // is using a callback paradigm then execute the callback
    if (typeof callback === 'function') req.then(state => callback(null, state), err => callback(err, req.res.state));

    return req;
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

        req.hook('response', Number.MAX_SAFE_INTEGER - 1000, function timeoutClear(req, res, next) {
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
    let contentType;

    // error conversion
    if (body instanceof Error) {
        res.log('transform', 'Converting Error to response');
        res.status(500).body(httpStatus[500]).set('content-type', 'text/plain');

    // buffer conversion
    } else if (isBuffer) {
        res.log('transform', 'Converting Buffer to base64 string');
        res.body(body.toString('base64'));
        contentType = 'application/octet-stream';

    // object conversion
    } else if (type === 'object') {
        res.log('transform', 'Converting object to JSON string');
        res.body(JSON.stringify(body));
        contentType = 'application/json';

    // not string conversion
    } else if (type !== 'string') {
        res.log('transform', 'Converting ' + type + ' to string');
        res.body(String(body));
        contentType = 'text/plain';

    } else {
        contentType = 'text/html';
    }

    // set content type if not yet set
    if (!state.headers.hasOwnProperty('content-type') && contentType) {
        res.log('transform', 'Set content type');
        res.set('Content-Type', contentType);
    }

    next();
}

/**
 * Middleware to make sure the method is valid.
 * @param {Request} req
 * @param {Response} res
 * @param {function} next
 */
function validMethod(req, res, next) {
    if (httpMethods.indexOf(req.method) === -1) {
        res.sendStatus(405);
    } else {
        next();
    }
}