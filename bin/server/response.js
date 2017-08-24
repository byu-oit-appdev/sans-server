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
const httpStatus            = require('http-status');
const util                  = require('../util');

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

/**
 * If an error occurs while creating or sending the response then this event is emitted with the error. The
 * error contains
 * the send function is called multiple times for a response.
 * @event Response#error
 * @type {Error}
 * @property {string} code A code that specifies the error classification.
 * @property {string} message The error message.
 * @property {Response} res The response that generated the error.
 * @property {string} stack The error message stack.
 */


module.exports = Response;

/**
 * Create a response instance.
 * @param {Request} request The request that is relying on this response that is being created.
 * @returns {Response}
 * @constructor
 */
function Response(request) {
    if (!(this instanceof Response)) return new Response(request);

    // create hidden data
    Object.defineProperty(this, '_', {
        enumerable: false,
        configurable: false,
        value: {
            body: '',
            cookies: [],
            headers: {},
            sent: false,
            statusCode: 0
        }
    });

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
        get: () => this._.sent
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
            const _ = this._;
            return {
                body: _.body,
                cookies: _.cookies,
                headers: _.headers,
                rawHeaders: rawHeaders(_.headers, _.cookies),
                statusCode: _.statusCode
            }
        }
    });
}

/**
 * Set the response body. If an object is provided then it will be converted to JSON on send. If an Error instance
 * is provided then it will cause the response to produce a 500 error but it will log the error details.
 * @param {*} value
 * @returns {Response}
 */
Response.prototype.body = function(value) {

    // set body
    this._.body = value;

    /**
     * The body has been set to a value.
     * @event Response#set-body
     * @type {*}
     */
    this.res.emit('set-body', value);

    // produce log
    const message = value instanceof Error
        ? value.message
        : truncateString(String(value));
    this.log('body-set', message, { value: value });

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

    /**
     * A cookie has been set to clear.
     * @event Response#clear-cookie
     * @type {*}
     */
    this.res.emit('clear-cookie', { name: name, options: options });

    const opts = Object.assign({}, options || {}, { expires: new Date(1) });    // expired
    return this.cookie(name, '', opts);
};

/**
 * Clear a header.
 * @name Response#clearHeader
 * @param {string} key
 * @returns {Response}
 */
Response.prototype.clearHeader = function(key) {
    if (this._.headers.hasOwnProperty(key)) {
        key = key.toLowerCase();
        const value = this._.headers[key];
        delete this._.headers[key];

        /**
         * Clearing a header.
         * @event Response#clear-header
         * @type {object}
         * @property {string} name The header name.
         * @property {string} value The property value being removed.
         */
        this.res.emit('clear-header', { name: key, value: value });

        this.log('clear-header', key + ': ' + value, {
            name: key,
            value: value
        });
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
 * @fires Response#error
 */
Response.prototype.cookie = function(name, value, options) {
    if (typeof name !== 'string') throw error(this, 'Cookie name must be a non-empty string. Received: ' + name, 'ERESC');
    if (typeof value !== 'string') throw error(this, 'Cookie value must be a string. Received: ' + value, 'ERESC');
    if (options && !util.isPlainObject(options)) throw error(this, 'Cookie options must be a plain object. Received: ' + options, 'ERESC');
    const cookie = {
        name: name,
        options: options,
        serialized: Cookie.serialize(name, value, options || {}),
        value: value
    };
    this._.cookies.push(cookie);

    /**
     * Set a cookie.
     * @event Response#set-cookie
     * @type {object}
     * @property {string} name The cookie name
     * @property {string} value The cookie value
     * @property {object} options The cookie options
     */
    this.res.emit('set-cookie', value);

    this.log('set-cookie', name + ': ' + value, cookie);
    return this;
};

/**
 * Produce a log event.
 * @param {string} [type='log']
 * @param {string} message
 * @param {Object} [details]
 * @returns {Response}
 * @fires Request#log
 */
Response.prototype.log = function(type, message, details) {

    /**
     * A log event.
     * @event Request#log
     * @type {LogEvent}
     */
    this.res.emit('log', util.log('RESPONSE', arguments));
    return this;
};

/**
 * Redirect the client to a new URL.
 * @name Response#redirect
 * @param {string} url
 * @returns {Response}
 */
Response.prototype.redirect = function(url) {
    if (typeof url !== 'string') throw error(this, 'Redirect URL must be a string. Received ' + url, 'ERRD');

    /**
     * Redirect to url
     * @event Response#redirect
     * @type {string}
     */
    this.res.emit('redirect', url);

    return this.status(302)
        .set('location', url)
        .send();
};

/**
 * Get a reference to the request that is tied to this response.
 * @type {Request}
 */
Object.defineProperty(Response.prototype, 'req', {
    enumerable: true,
    get: () => this._.req
});

/**
 * Reset to the response to it's initial state. This does not reset the sent status.
 * @returns {Response}
 */
Response.prototype.reset = function() {
    const state = this.state;

    this._.body = '';
    this._.cookies = [];
    this._.headers = {};
    this._.statusCode = 0;

    /**
     * Reset response.
     * @event Response#set-cookie
     * @type {object} The state prior to reset
     */
    this.res.emit('reset', state);

    return this.log('reset', 'Response data reset.');
};

/**
 * Send the response.
 * @param {string|Object|Buffer|Error} [body] The body to send in the response. See {@link Response#body} for details.
 * @returns {Response}
 * @fires Response#send
 * @fires Response#error
 */
Response.prototype.send = function(body) {
    const _ = this._;

    // make sure that the response is only sent once
    if (_.sent) throw error(this, 'Response already sent for ' + this.req.id, 'ERESS');
    _.sent = true;

    // if the status is still 0 then set to 200
    if (_.statusCode === 0) this.status(200);

    // update the body
    if (arguments.length > 0) this.body(body);

    // log the current state
    const subBody = truncateString(_.body);
    this.log('send', _.body === subBody ? _.body : subBody + '...', {
        body: _.body,
        cookies: _.cookies,
        headers: _.headers,
        statusCode: _.statusCode
    });

    /**
     * This event signifies that the response has been sent.
     * @event Response#send
     * @type {Response}
     */
    this.res.emit('send', this);

    // fulfill the request promise
    this.req._.deferred.resolve();

    return this;
};

/**
 * Send a status code with a default message.
 * @name Response#sendStatus
 * @param {Number} code
 * @returns {Response}
 */
Response.prototype.sendStatus = function(code) {
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
 */
Response.prototype.set = function(key, value) {
    if (typeof key !== 'string') throw error(this, 'Header key must be a string. Received ' + key, 'ERHDR');
    if (typeof value !== 'string') throw error(this, 'Header value must be a string. Received ' + key, 'ERHDR');

    /**
     * Set a header.
     * @event Response#set-header
     * @type {object}
     * @property {string} name The header name
     * @property {string} value The header value
     */
    this.res.emit('set-header', { name: name, value: value });

    key = key.toLowerCase();
    this._.headers[key] = String(value);
    this.log('set-header', key + ': ' + value, {
        header: key,
        value: value
    });
    return this;
};

/**
 * Set the status code.
 * @name Response#status
 * @param {Number} code
 * @returns {Response}
 */
Response.prototype.status = function(code) {
    if (typeof code !== 'number' || isNaN(code) || Math.round(code) !== code || code < 0) throw error(this, 'Redirect status code must be a non-negative integer. Received ' + code, 'ERST');

    /**
     * Set a cookie.
     * @event Response#set-status
     * @type {number}
     */
    this.res.emit('set-status', code);

    const _ = this._;
    _.statusCode = code;
    this.log('set-status', String(code), { statusCode: code });
    return this;
};


function error(res, message, code) {
    const err = Error(message);
    err.code = code;
    err.res = res;
    res.res.emit('error', err);
    return err;
}

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