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
const defer                 = require('../async/defer');
const EventEmitter          = require('events');
const httpStatus            = require('http-status');
const log                   = require('./log').firer('response');
const util                  = require('../util');

const map = new WeakMap();

/**
 * @interface Cookie
 * @type {object}
 * @property {string} name The name of the cookie.
 * @property {object} options The options use to set the cookie.
 * @property {string} serialized The cookie as a string.
 * @property {string} value The cookie value.
 */

/**
 * If an error occurs while creating or sending the response then this event is emitted with the error. The
 * error contains
 * the send function is called multiple times for a response.
 * @event Response#error
 * @type {Error}
 * @property {string} code A code the specifies the error classification.
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
 * @augments {EventEmitter}
 */
function Response(request) {
    if (!(this instanceof Response)) return new Response(request);

    Object.defineProperty(this, '_', {
        enumerable: false,
        configurable: false,
        value: {
            body: '',
            cookies: [],
            headers: {},
            sent: false,
            status: 0
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
     * The sans-server instance that is tied to this response.
     * @name Response#server
     * @type {SansServer}
     */
    Object.defineProperty(this, 'server', {
        configurable: false,
        enumerable: true,
        value: request.server
    });
}

Response.prototype = Object.create(EventEmitter.prototype);
Response.prototype.name = 'Response';
Response.prototype.constructor = Response;

/**
 * Set the response body. If an object is provided then it will be converted to JSON on send. If an Error instance
 * is provided then it will cause the response to produce a 500 error but it will log the error details.
 * @param {String|Object|Buffer|Error} value
 * @returns {Response}
 * @throws {Error}
 * @fires Response#error
 */
Response.prototype.body = function(value) {
    let str;

    // validate input
    if (typeof value !== 'string' && !(value instanceof Error) && !(value instanceof Buffer) && !util.isPlainObject(value)) {
        throw error('Invalid body. Must be a string, a plain Object, a Buffer, or an Error.', 'ERESB');
    }

    // set body
    this._.body = value;

    // produce log
    const message = value instanceof Error
        ? value.message
        : truncateString('' + value);
    this.log('body-set', message, { value: value });

    return this;
};

/**
 * Clear a cookie.
 * @name Response#clearCookie
 * @param {String} name The name of the cookie.
 * @param {Object} [options={}] The cookie options. You will need to match the domain and path information for
 * the browser to clear the cookie.
 * @returns {Response}
 */
Response.prototype.clearCookie = function(name, options) {
    const opts = Object.assign({}, options || {}, { expires: new Date(1) });    // expired
    return this.cookie(name, '', opts);
};

/**
 * Clear a header.
 * @name Response#clearHeader
 * @param {String} key
 * @returns {Response}
 */
Response.prototype.clearHeader = function(key) {
    if (this._.headers.hasOwnProperty(key)) {
        const value = this._.headers[key];
        delete this._.headers[key];
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
 * @param {String} name The name of the cookie.
 * @param {String} value The value to set for the cookie.
 * @param {Object} [options={}]
 * @returns {Response}
 * @throws {Error}
 * @fires Response#error
 */
Response.prototype.cookie = function(name, value, options) {
    if (typeof name !== 'string') throw error('Cookie name must be a non-empty string. Received: ' + name, 'ERESC');
    if (typeof value !== 'string') throw error('Cookie value must be a string. Received: ' + value, 'ERESC');
    if (options && !util.isPlainObject(options)) throw error('Cookie options must be a plain object. Received: ' + options, 'ERESC');
    const cookie = {
        name: name,
        options: options,
        serialized: Cookie.serialize(name, value, options || {}),
        value: value
    };
    this._.cookies.push(cookie);
    this.log('set-cookie', name + ': ' + value, cookie);
    return this;
};

/**
 * Produce a log event.
 * @param {String} [type='log']
 * @param {String} message
 * @param {Object} [details]
 * @returns {Response}
 * @fires Response#log
 */
Response.prototype.log = function(type, message, details) {

    /**
     * A log event.
     * @event Response#log
     * @type {LogEvent}
     */
    this.emit('log', util.log('RESPONSE', arguments));
    return this;
};

/**
 * Redirect the client to a new URL.
 * @name Response#redirect
 * @param {string} url
 * @returns {Response}
 */
Response.prototype.redirect = function(url) {
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
    this._.body = '';
    this._.cookies = [];
    this._.headers = {};
    this._.status = 0;
    return this.log('reset', 'Response data reset.');
};

/**
 * Determine if the response has already been sent.
 * @name Response#sent
 * @type {boolean}
 */
Object.defineProperty(Response.prototype, 'sent', {
    enumerable: true,
    get: () => this._.sent
});

/**
 * Send the response.
 * @param {String|Object|Buffer|Error} body The body to send in the response. See {@link Response#body} for details.
 * @returns {Response}
 * @fires Response#send
 * @fires Response#error
 */
Response.prototype.send = function(body) {
    const _ = this._;

    // make sure that the response is only sent once
    if (_.sent) throw error('Response already sent for ' + this._.req.id, 'ERESS');
    _.sent = true;

    // update the body
    if (arguments.length > 0) this.body(body);

    // TODO: error hook
    /*if (error) {
        this.log('error', error.stack);
        this.reset().status(500).body('Internal Server Error');
    }*/

    // TODO: execute hooks

    // log the current state
    const rawHeaderString = rawHeaders(_.headers, _.cookies);
    const subBody = truncateString(_.body);
    this.log('sent', _.body === subBody ? _.body : subBody + '...', {
        body: _.body,
        cookies: _.cookies,
        headers: _.headers,
        status: _.status
    });

    /**
     * This event signifies that the response has been sent.
     * @event Response#send
     * @type {Response}
     */
    this.emit('send', this);

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
 * @param {String} key The header name.
 * @param {String} value The value of the header to set.
 * @returns {Response}
 */
Response.prototype.set = function(key, value) {
    this._.headers[key] = String(value);
    this.log('set-header', key + ': ' + value, {
        header: key,
        value: value
    });
    return this;
};

/**
 * Get a copy of the current response state.
 * @type {object}
 * @property {String|Object|Buffer|Error} body The response body.
 * @property {Array<Cookie>} cookies The cookies as name value pairs.
 * @property {object} headers The headers as key value pairs where each key and value is a string.
 * @property {string} rawHeaders A helper property that has the headers and cookies as a string, ready to supply via http.
 * @property {number} status The status code of the response.
 * @property {number} statusCode An alias for status.
 */
Object.defineProperty(Response, 'state', {
    enumerable: true,
    configurable: false,
    get: () => {
        const _ = this._;
        return {
            body: _.body,
            cookies: _.cookies,
            headers: _.headers,
            rawHeaders: rawHeaders(_.headers, _.cookies),
            status: _.status,
            statusCode: _.status
        }
    }
});

/**
 * Set the status code.
 * @name Response#status
 * @param {Number} code
 * @returns {Response}
 */
Response.prototype.status = function(code) {
    const _ = this._;
    _.status = code;
    this.log('set-status', code, { status: code });
    return this;
};

Response.error = function() {
    return {
        body: httpStatus[500],
        cookies: [],
        headers: { 'Content-Type': 'text/plain' },
        rawHeaders: 'Content-Type: text/plain',
        statusCode: 500
    };
};

Response.status = httpStatus;


function error(res, message, code) {
    const err = util.Error(message, code, { res: res });
    this.log('error', 'Error ' + code + ': ' + message, err);
    this.emit('error', err);
}

function executeHooks(response, hooks, request) {
    if (hooks.length === 0) return Promise.resolve();

    // get the hook to process - last is first
    const hook = hooks.pop();

    // create a deferred promise
    const deferred = defer();

    // safely execute the hook
    response.log('send-hook', 'Executing' + (hook.name ? ' ' + hook.name : ''), { hook: hook });
    if (hook.length > 1) {
        try {
            const callback = function (err) {
                if (err) return deferred.reject(err);
                deferred.resolve();
            };
            hook.call(response, response.state, callback);
        } catch (err) {
            deferred.reject(err);
        }
    } else {
        try {
            Promise.resolve(hook.call(response, response.state))
                .then(deferred.resolve, deferred.reject);
        } catch (err) {
            deferred.reject(err);
        }
    }

    // process the result of the hook
    return deferred.promise
        .then(() => executeHooks(response, hooks, request))
        .catch(function(err) {
            response.body(err);
            return executeHooks(response, hooks, request);
        });
}

function hookError(state) {
    if (state.body instanceof Error) {
        const err = state.body;
        this.log('error', err.message, {
            message: err.message,
            stack: err.stack
        });

        map.get(this).error = err;
        this.reset();
        this.status(500, true);
    }
}

function hookObject(state) {
    if (typeof state.body === 'object') {
        this.log('stringify', 'Converting object to JSON string', state.body);
        this.body(JSON.stringify(state.body));
        this.set('Content-Type', 'application/json');
    }
}

function hookString(state) {
    const type = typeof state.body;
    if (type !== 'string' && type !== 'undefined') {
        this.log('stringify', 'Converting body to string', state.body);
        this.body(state.body.toString());
    } else if (type !== 'string') {
        this.body('');
    }
}

function isPlainObject(o) {
    if (typeof o !== 'object' || !o) return false;

    const constructor = o.constructor;
    if (typeof constructor !== 'function') return false;

    const prototype = constructor.prototype;
    if (!prototype || typeof prototype !== 'object' || !prototype.hasOwnProperty('isPrototypeOf')) return false;

    return true;
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
    return results.join('\n');
}

function truncateString(value) {
    if (value.length > 40) value = value.substr(0, 37) + '...';
    return value;
}