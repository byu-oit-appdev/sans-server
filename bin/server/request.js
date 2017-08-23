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
const Response              = require('./response');
const util                  = require('../util');
const uuid                  = require('../uuid');

const errors = {
    body: 'Invalid body supplied to request. Expected an object, a string, or undefined. Received: %s',
    headers: 'Invalid header structure supplied to request. Expected an object with string values. Received: %s',
    path: 'Invalid path supplied to request. Expected a string. Received: %s',
    query: 'Invalid query supplied to request. Expected a object with property values as strings or as arrays of strings. Received: %s'
};

module.exports = Request;

/**
 * Generate a request instance.
 * @param {String|Object} [config] A string representing the path or a configuration representing all properties
 * to accompany the request.
 * @returns {Request}
 * @constructor
 * @augments {EventEmitter}
 * @augments {Promise}
 */
function Request(config) {
    if (!(this instanceof Request)) return new Request(config);
    if (!config) config = {};
    if (typeof config === 'string') config = { path: config };
    const normal = normalize(config);

    // create a deferred promise
    const deferred = {};
    deferred.promise = new Promise((resolve, reject) => {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });

    Object.defineProperty(this, '_', {
        enumerable: false,
        configurable: false,
        value: {
            deferred: deferred
        }
    });

    /**
     * The request body.
     * @name Request#body
     * @type {String|Object|undefined}
     */
    this.body = normal.body;

    /**
     * The request headers. This is an object that has lower-case keys and string values.
     * @name Request#headers
     * @type {Object<String,String>}
     */
    this.headers = normal.headers;

    /**
     * This request method. The lower case equivalents of these value are acceptable but will be automatically lower-cased.
     * @name Request#method
     * @type {('GET'|'DELETE'|'HEAD'|'OPTIONS'|'PATCH'|'POST'|'PUT')}
     */
    this.method = normal.method;

    /**
     * The request path, beginning with a '/'. Does not include domain or query string.
     * @name Request#path
     * @type {String}
     */
    this.path = normal.path;

    /**
     * An object mapping query parameters by key.
     * @name Request#query
     * @type {object<String,String>}
     */
    this.query = normal.query;

    /**
     * Get the unique ID associated with this request.
     * @name Request#id
     * @type {String}
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
        value: Response(this)
    });

    /**
     * Get the request URL which consists of the path and the query parameters.
     * @name Request#url
     * @type {String}
     * @readonly
     */
    Object.defineProperty(this, 'url', {
        configurable: false,
        enumerable: true,
        get: () => this.path + buildQueryString(this.query)
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
    return this._.deferred.promise.catch(onRejected);
};

/**
 * Produce a log event.
 * @param {String} [type='log']
 * @param {String} message
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
    this.emit('log', util.log('REQUEST', arguments));
    return this;
};

/**
 * Add fulfillment or rejection handlers to the request promise.
 * @param {Function} onFulfilled
 * @param {Function} [onRejected]
 * @returns {Promise}
 */
Request.prototype.then = function(onFulfilled, onRejected) {
    const promise = this._.deferred.promise;
    return promise.then.apply(promise, arguments);
};


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
    if (config.headers && typeof config.headers !== 'object') throw error(result, 'headers');
    Object.keys(config.headers).forEach(key => {
        const value = config.headers[key];
        if (typeof value !== 'string') throw error(result, 'headers', 'at property ' + key);
        result.headers[key.toLowerCase()] = value;
    });

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