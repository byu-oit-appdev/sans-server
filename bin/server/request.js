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
const format                = require('util').format;
const httpStatus            = require('http-status');
const Middleware            = require('sans-server-middleware');
const Response              = require('./response');
const util                  = require('../util');
const uuid                  = require('../uuid');

const errors = {
    body: 'Invalid body supplied to request. Expected an object, a string, or undefined. Received: %s',
    method: 'Invalid method supplied to request. Expected a string or undefined. Received: %s',
    headers: 'Invalid header structure supplied to request. Expected an object with string values. Received: %s',
    path: 'Invalid path supplied to request. Expected a string. Received: %s',
    query: 'Invalid query supplied to request. Expected a object with property values as strings or as arrays of strings. Received: %s'
};

const STORE = Symbol('store');

module.exports = Request;

/**
 * Generate a request instance.
 * @param {SansServer} server
 * @param {string|Object} [config] A string representing the path or a configuration representing all properties
 * to accompany the request.
 * @returns {Request}
 * @constructor
 * @augments {EventEmitter}
 * @augments {Promise}
 */
function Request(server, config) {
    if (!(this instanceof Request)) return new Request(server, config);
    if (!config) config = {};
    if (typeof config !== 'object') config = { path: config };

    // IIFE closure for deferred promise management
    const promise = (() => {
        let resolved = false;

        // create a deferred promise that will always resolve to the response state
        const deferred = {};
        const result = new Promise(resolve => {
            deferred.resolve = () => {
                resolved = true;
                req.log('resolved', 'Request resolved');
                resolve(res.state);
            };
            deferred.reject = err => {
                req.log('error', err.stack.replace(/\n/g, '\n  '), err);
                if (resolved) {
                    req.log('resolved', 'Request already resolved');
                } else {
                    res.reset().set('content-type', 'text/plain').status(500).body(httpStatus[500]);
                    deferred.resolve();
                }
            };
        });

        // listen for response and error events
        this.once('response', () => deferred.resolve());
        this.once('error', err => deferred.reject(err));

        return result;
    })();

    // set private store
    this[STORE] = {
        hooks: {},
        promise: promise
    };

    // initialize variables
    const req = this;
    const res = Response(this);

    // validate and normalize input
    try {
        working here - how to normalize request and throw errors where appropriate?

        Object.assign(this, config, normalize(config));
    } catch (err) {
        req.log('error', err.stack, error);
    }

    /**
     * The request body.
     * @name Request#body
     * @type {string|Object|Buffer|undefined}
     */

    /**
     * The request headers. This is an object that has lower-case keys and string values.
     * @name Request#headers
     * @type {Object<string,string>}
     */

    /**
     * This request method. The lower case equivalents of these value are acceptable but will be automatically lower-cased.
     * @name Request#method
     * @type {string} One of: 'GET', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'
     */

    /**
     * The request path, beginning with a '/'. Does not include domain or query string.
     * @name Request#path
     * @type {string}
     */

    /**
     * An object mapping query parameters by key.
     * @name Request#query
     * @type {object<string,string>}
     */

    /**
     * Get the unique ID associated with this request.
     * @name Request#id
     * @type {string}
     * @readonly
     */
    Object.defineProperty(this, 'id', {
        configurable: false,
        enumerable: true,
        value: uuid()
    });

    /**
     * Get the response object that is tied to this request.
     * @name Request#res
     * @type {Response}
     */
    Object.defineProperty(this, 'res', {
        configurable: false,
        enumerable: true,
        value: res
    });

    /**
     * Get the server instance that initialized this request.
     * @name Request#server
     * @type {SansServer}
     */
    Object.defineProperty(this, 'server', {
        enumerable: true,
        configurable: false,
        value: server
    });

    /**
     * Get the request URL which consists of the path and the query parameters.
     * @name Request#url
     * @type {string}
     * @readonly
     */
    Object.defineProperty(this, 'url', {
        configurable: false,
        enumerable: true,
        get: () => this.path + buildQueryString(this.query || {})
    });

    // wait one tick for any event listeners to be added
    process.nextTick(() => {

        // add request middleware and run request hooks
        const middleware = new Middleware('request');
        this.getHooks('request').forEach(item => middleware.add(item.weight, item.hook));
        middleware.run(req, res).catch(err => this.emit('error', err));
    });
}

Request.prototype = Object.create(EventEmitter.prototype);
Request.prototype.name = 'Request';
Request.prototype.constructor = Request;

/**
 * Add a rejection handler to the request promise.
 * @param {Function} onRejected
 * @returns {Promise}
 */
Request.prototype.catch = function(onRejected) {
    // FYI - the promise cannot be rejected
    return Promise.resolve();
};

Request.prototype.getHooks = function(type) {
    const hooks = this[STORE].hooks;
    return hooks[type] || [];
};

/**
 * Add request specific hooks
 * @param {string} type
 * @param {number} [weight=0]
 * @param {...Function} hook
 */
Request.prototype.hook = function(type, weight, hook) {
    const length = arguments.length;
    const hooks = this[STORE].hooks;
    let start = 1;

    if (typeof type !== 'string') {
        const err = Error('Expected first parameter to be a string. Received: ' + type);
        err.code = 'ESHOOK';
        throw err;
    }

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
            const err = Error('Expected last parameter(s) to be a function. Received: ' + hook);
            err.code = 'ESHOOK';
            throw err;
        }

        const event = { weight: weight, hook: arguments[i] };
        store.push(event);
        this.emit('hook-add-' + type, event);
    }
};

/**
 * Produce a log event.
 * @param {string} [type='log']
 * @param {string} message
 * @param {Object} [details]
 * @returns {Request}
 * @fires Request#log
 */
Request.prototype.log = function(type, message, details) {

    /**
     * A log event.
     * @event Request#log
     * @type {LogEvent}
     */
    this.emit('log', util.log('request', arguments));
    return this;
};

Request.prototype.watchHooks = function(type, getAlso, callback) {
    if (getAlso) this.getHooks(type).forEach(callback);
    this.on('hook-add-' + type, callback);
};

/**
 * Add fulfillment or rejection handlers to the request promise.
 * @param {Function} onFulfilled
 * @param {Function} [onRejected]
 * @returns {Promise}
 */
Request.prototype.then = function(onFulfilled, onRejected) {
    // FYI - the promise cannot be rejected
    return this[STORE].promise.then(onFulfilled);
};

/**
 * This constructor has double inheritance.
 * @param {*} instance
 * @returns {boolean}
 */
Object.defineProperty(Request, Symbol.hasInstance, {
    enumerable: false,
    configurable: true,
    value: function(instance) {
        return instance instanceof EventEmitter || instance instanceof Promise;
    }
});


function buildQueryString(query) {
    const results = Object.keys(query).reduce(function(ar, key) {
        ar.push(key + (query[key] !== '' ? '=' + query[key] : ''));
        return ar;
    }, []);
    return results.length > 0 ? '?' + results.join('&') : '';
}

function error(config, property, suffix) {
    let message = format(errors[property], config[property]);
    if (suffix) message += ' ' + suffix;

    const err = Error(message);
    err.code = 'EREQ';
    return err;
}

function normalize(config) {
    const result = {};

    // validate body
    result.body = util.copy(config.body);
    switch (typeof result.body) {
        case 'object':
        case 'string':
        case 'undefined':
            break;
        default:
            throw error(result, 'body');
            break;
    }

    // validate headers
    result.headers = {};
    if (config.headers) {
        if (typeof config.headers !== 'object') throw error(result, 'headers');
        Object.keys(config.headers).forEach(key => {
            const value = config.headers[key];
            if (typeof value !== 'string') throw error(result, 'headers', 'at property ' + key);
            result.headers[key.toLowerCase()] = value;
        });
    }

    // validate method
    result.method = config.method;
    if (!result.method) result.method = 'GET';
    if (typeof result.method !== 'string') throw error(result, 'method');
    result.method = result.method.toUpperCase();

    // validate query
    result.query = util.copy(config.query);
    if (!result.query) result.query = {};
    if (typeof result.query !== 'object') throw error(result, 'query');
    Object.keys(result.query).forEach(key => {
        const value = result.query[key];
        if (Array.isArray(value)) {
            value.forEach((v, i) => {
                if (typeof value !== 'string') throw error(result, 'query', 'at property ' + key + ' index ' + i);
            })
        } else if (typeof value !== 'string') {
            throw error(result, 'query', 'at property ' + key);
        }
    });

    // validate path (and extract query parameters)
    result.path = config.path;
    if (!result.path) result.path = '';
    if (typeof result.path !== 'string') throw error(result, 'path');
    if (/\?/.test(result.path)) {
        const parts = result.path.split('?');
        result.path = parts[0];
        parts[1].split('&')
            .forEach(pair => {
                const kv = pair.split('=');
                const key = kv[0];
                const value = kv[1];
                if (Array.isArray(result.query[key])) {
                    result.query[key].push(value);
                } else if (result.hasOwnProperty(key)) {
                    result.query[key] = [ result.query[key], value ];
                } else {
                    result.query[key] = value;
                }
            });
    }
    result.path = '/' + result.path.replace(/^\//, '').replace(/\/$/, '');

    return result;
}