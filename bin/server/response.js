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
const Cookie                = require('cookie');
const debug                 = require('debug')('sans-server-response');
const httpStatus            = require('http-status');
const util                  = require('../util');

module.exports = Response;

const STORE = Symbol('store');

/**
 * Create a response instance.
 * @param {Request} request The request that is relying on this response that is being created.
 * @param {Symbol} key
 * @returns {Response}
 * @constructor
 */
function Response(request, key) {

    // define private store
    const store = {
        body: '',
        cookies: [],
        headers: {},
        key: key,
        sent: false,
        statusCode: 0
    };
    this[STORE] = store;


    /**
     * The request that is tied to this response.
     * @name Response#req
     * @type {Request}
     */
    Object.defineProperty(this, 'req', {
        configurable: false,
        enumerable: true,
        value: request
    });

    /**
     * Determine if the response has already been sent.
     * @name Response#sent
     * @type {boolean}
     */
    Object.defineProperty(this, 'sent', {
        enumerable: true,
        get: () => store.sent
    });

    /**
     * Get the server instance that initialized this response.
     * @name Request#server
     * @type {SansServer}
     */
    Object.defineProperty(this, 'server', {
        enumerable: true,
        configurable: false,
        value: request.server
    });

    /**
     * Get a copy of the current response state.
     * @name Response#state
     * @type {ResponseState}
     */
    Object.defineProperty(this, 'state', {
        configurable: false,
        enumerable: true,
        get: () => {
            return {
                body: store.body,
                cookies: store.cookies.concat(),
                headers: Object.assign({}, store.headers),
                rawHeaders: rawHeaders(store.headers, store.cookies),
                statusCode: store.statusCode
            }
        }
    });

    /**
     * Get or set the status code.
     * @name Response#statusCode
     * @type {number}
     */
    Object.defineProperty(this, 'statusCode', {
        configurable: false,
        enumerable: true,
        get: () => store.statusCode,
        set: v => this.status(v)
    });
}

/**
 * Set the response body. If an object is provided then it will be converted to JSON on send. If an Error instance
 * is provided then it will cause the response to produce a 500 error but it will log the error details.
 * @param {string|Buffer|object|Array} value
 * @returns {Response}
 * @throws {Error}
 */
Response.prototype.body = function(value) {

    // set body
    this[STORE].body = value;

    // produce log
    this.log('set-body', truncateString(String(value)));

    this.req.emit('res-set-body', this);
    this.req.emit('res-state-change', this);

    return this;
};

/**
 * Clear a cookie.
 * @name Response#clearCookie
 * @param {string} name The name of the cookie.
 * @param {Object} [options={}] The cookie options. You will need to match the domain and path information for
 * the browser to clear the cookie.
 * @returns {Response}
 */
Response.prototype.clearCookie = function(name, options) {
    const opts = Object.assign({}, options || {}, { expires: new Date(1) });    // expired
    this.log('clear-cookie', name);
    return this.cookie(name, '', opts);
};

/**
 * Clear a header.
 * @name Response#clearHeader
 * @param {string} key
 * @returns {Response}
 */
Response.prototype.clearHeader = function(key) {
    const headers = this[STORE].headers;
    key = key.toLowerCase();
    if (headers.hasOwnProperty(key)) {
        const value = headers[key];
        delete headers[key];

        this.log('clear-header %s:%s', key, value);

        this.req.emit('res-clear-header', this);
        this.req.emit('res-state-change', this);
    }
    return this;
};

/**
 * Set a cookie.
 * @name Response#cookie
 * @param {string} name The name of the cookie.
 * @param {string} value The value to set for the cookie.
 * @param {Object} [options={}]
 * @returns {Response}
 * @throws {Error}
 */
Response.prototype.cookie = function(name, value, options) {
    if (typeof name !== 'string') {
        const err = Error('Cookie name must be a non-empty string. Received: ' + name);
        err.code = 'ERESC';
        throw err;
    }

    if (typeof value !== 'number' && typeof value !== 'string') {
        const err = Error('Cookie value must be a number or string. Received: ' + value);
        err.code = 'ERESC';
        throw err;
    }

    if (options && !util.isPlainObject(options)) {
        const err = Error('Cookie options must be a plain object. Received: ' + options);
        err.code = 'ERESC';
        throw err;
    }

    value = String(value);
    const cookie = {
        name: name,
        options: options,
        serialized: Cookie.serialize(name, value, options || {}),
        value: value
    };
    this[STORE].cookies.push(cookie);

    this.log('set-cookie %s:%s', name, value);

    this.req.emit('res-set-cookie', this);
    this.req.emit('res-state-change', this);
    return this;
};

/**
 * Produce a log event.
 * @param {string} message
 * @param {...*} [arg]
 * @returns {Response}
 * @fires Response#log
 */
Response.prototype.log = function(message, arg) {
    const data = util.format(arguments);

    /**
     * A log event.
     * @event Response#log
     * @type {{ type: string, data: string, timestamp: number} }
     */
    this.req.emit('log', {
        type: 'response',
        data: data,
        timestamp: Date.now()
    });

    debug(this.req.id + ' ' + data);
    return this;
};

/**
 * Redirect the client to a new URL.
 * @name Response#redirect
 * @param {string} url
 * @returns {Response}
 * @throws {Error}
 */
Response.prototype.redirect = function(url) {
    if (typeof url !== 'string') {
        const err = Error('Redirect URL must be a string. Received ' + url);
        err.code = 'ERRD';
        throw err;
    }

    return this.status(302)
        .set('location', url)
        .send();
};
/**
 * Reset to the response to it's initial state. This does not reset the sent status.
 * @returns {Response}
 */
Response.prototype.reset = function() {
    const store = this[STORE];

    store.body = '';
    store.cookies = [];
    store.headers = {};
    store.statusCode = 0;

    this.log('reset Response data reset.');

    this.req.emit('res-reset', this);
    this.req.emit('res-state-change', this);
    return this;
};

/**
 * Send the response.
 * @param {*} [body] The body to send in the response. See {@link Response#body} for details.
 * @returns {Response}
 * @throws {Error}
 */
Response.prototype.send = function(body) {
    const store = this[STORE];

    // make sure that the response is only sent once
    if (store.sent) {
        const err = Error('Response already sent for ' + this.req.id);
        err.code = 'ERSENT';
        throw err;
    }
    store.sent = true;

    // if the status is still 0 then set to 200
    if (store.statusCode === 0) this.status(200);

    // update the body
    if (arguments.length > 0) this.body(body);

    // log the current state
    this.log('send %s %s', store.statusCode, truncateString(store.body));

    this.req.emit('res-send', this);

    // execute hooks and fulfill the response promise
    this.req.hook.reverse(store.key, (err) => {
        if (err) {
            this.req.emit('error', err);
        } else {
            this.req.emit('res-complete', this);
        }
    });

    return this;
};

/**
 * Send a status code with a default message.
 * @name Response#sendStatus
 * @param {Number} code
 * @returns {Response}
 */
Response.prototype.sendStatus = function(code) {
    this.log('send-status', code);
    return this.status(code)
        .set('content-type', 'text/plain')
        .send(httpStatus[code] || String(code));
};

/**
 * Set a header.
 * @name Response#set
 * @param {string} key The header name.
 * @param {string} value The value of the header to set.
 * @returns {Response}
 * @throws {Error}
 */
Response.prototype.set = function(key, value) {
    if (typeof key !== 'string') {
        const err = Error('Header key must be a string. Received ' + key);
        err.code = 'ERHDR';
        throw err;
    }

    if (typeof value !== 'string') {
        const err = Error('Header value must be a string. Received ' + key);
        err.code = 'ERHDR';
        throw err;
    }

    key = key.toLowerCase();
    this[STORE].headers[key] = value;
    this.log('set-header %s:%s', key, value);

    this.req.emit('res-set-header', this);
    this.req.emit('res-state-change', this);

    return this;
};

/**
 * @name Response#setHeader
 * @function
 * @param {string} key The header name.
 * @param {string} value The value of the header to set.
 * @returns {Response}
 * @throws {Error}
 */
Response.prototype.setHeader = Response.prototype.set;

/**
 * Set the status code.
 * @name Response#status
 * @param {Number} code
 * @returns {Response}
 * @throws {Error}
 */
Response.prototype.status = function(code) {
    if (typeof code !== 'number' || isNaN(code) || Math.round(code) !== code || code < 0) {
        const err = Error('Status code must be a non-negative integer. Received ' + code);
        err.code = 'ERST';
        throw err;
    }

    this[STORE].statusCode = code;
    this.log('set-status', String(code));

    this.req.emit('res-set-status', this);
    this.req.emit('res-state-change', this);

    return this;
};


function rawHeaders(headers, cookies) {
    const results = [];
    Object.keys(headers)
        .forEach(function(key) {
            results.push(key + ': ' + headers[key]);
        });
    cookies.forEach(function(cookie) {
        results.push('Set-Cookie: ' + cookie.serialized);
    });
    return results;
}

function truncateString(value) {
    if (value.length > 40) value = value.substr(0, 37) + '...';
    return value;
}





/**
 * @interface Cookie
 * @type {object}
 * @property {string} name The name of the cookie.
 * @property {object} options The options use to set the cookie.
 * @property {string} serialized The cookie as a string.
 * @property {string} value The cookie value.
 */

/**
 * @interface ResponseState
 * @type {object}
 * @property {string|Object|Buffer|Error} body The response body.
 * @property {Array<Cookie>} cookies The cookies as name value pairs.
 * @property {object} headers The headers as key value pairs where each key and value is a string.
 * @property {string} rawHeaders A helper property that has the headers and cookies as a string, ready to supply via http.
 * @property {number} status The status code of the response.
 * @property {number} statusCode An alias for status.
 */