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
const cookie                = require('cookie');
const defer                 = require('../async/defer');
const emitter               = require('../emitter');
const httpStatus            = require('http-status');
const log                   = require('./log').firer('response');
const util                  = require('../util');

const map = new WeakMap();

module.exports = Response;

/**
 * @name Response
 * @param {Request} request The request associated with this response.
 * @returns {Response}
 * @constructor
 */
function Response(request) {
    const factory = Object.create(Response.prototype);
    const hooks = {
        send: [hookString, hookObject, hookError]
    };
    const state = {
        body: '',
        cookies: [],
        headers: {},
        sent: false,
        statusCode: 0
    };
    map.set(factory, {
        error: null
    });

    /**
     * Set the body content.
     * @param {*} value
     * @returns {Response}
     */
    factory.body = function(value) {
        let str;

        if (value instanceof Error) {
            str = value.stack.replace(/\n/g, '\n  ');
        } else {
            str = truncateString('' + value);
        }

        state.body = value;
        factory.log('body-set', str, { value: value });

        return factory;
    };

    /**
     * Clear a cookie.
     * @name Response#clearCookie
     * @param {string} name
     * @param {object} [options={}]
     * @returns {Response}
     */
    factory.clearCookie = function(name, options) {
        const opts = Object.assign({}, options || {}, {
            expires: new Date(1)        // expired
        });
        return factory.cookie(name, '', opts);
    };

    /**
     * Clear a header.
     * @name Response#clearHeader
     * @param {string} key
     * @returns {Response}
     */
    factory.clearHeader = function(key) {
        if (state.headers.hasOwnProperty(key)) {
            const value = state.headers[key];
            delete state.headers[key];
            factory.log('clear-header', key + ': ' + value, {
                name: key,
                value: value
            });
        }
        return factory;
    };

    /**
     * Set a cookie.
     * @name Response#cookie
     * @param {string} name
     * @param {string} value
     * @param {object} [options={}]
     * @returns {Response}
     */
    factory.cookie = function(name, value, options) {
        if (!value) value = '';
        if (typeof value !== 'object') value = value.toString();
        if (typeof name !== 'string') throw Error('Cookie name must be a non-empty string. Received: ' + name);
        if (typeof value !== 'string') throw Error('Cookie value must be a string. Received: ' + value);
        const c = {
            name: name,
            options: options,
            serialized: cookie.serialize(name, value, options || {}),
            value: value
        };
        state.cookies.push(c);

        factory.log('set-cookie', name + ': ' + value, c);
        return factory;
    };

    /**
     * Add a send hook.
     * @name Response#hook
     * @param {function} hook
     * @returns {Response}
     */
    factory.hook = function(hook) {
        if (typeof hook !== 'function') {
            const err = Error('Send hook expected a function. Received: ' + hook);
            err.code = 'ESHOOK';
            throw err;
        }

        factory.log('send-hook', 'Hook defined', { hook: hook });
        hooks.send.push(hook);

        return factory;
    };

    /**
     * Produce a response log.
     * @param title
     * @param message
     * @param details
     */
    factory.log = util.reqLog(request, log);

    /**
     * Redirect the client to a new URL.
     * @name Response#redirect
     * @param {string} url
     * @returns {Response}
     */
    factory.redirect = function(url) {
        return factory.send(302, '', {
            'Location': url
        });
    };

    /**
     * Reset to the response to it's initial state. This does not reset the sent status.
     */
    factory.reset = function() {
        state.body = '';
        state.cookies = [];
        state.headers = {};
        state.statusCode = 0;
        factory.log('reset', 'Response data reset.', {});
    };

    /**
     * @name Response#sent
     * @type {boolean}
     */
    Object.defineProperty(factory, 'sent', {
        enumerable: true,
        get: function() { return state.sent; }
    });

    /**
     * Build then send the response
     * @name Response#send
     * @param {number} [code=200]
     * @param {string|object|Error} [body]
     * @param {object} [headers={}]
     * @returns {Response}
     */
    factory.send = function(code, body, headers) {

        // make sure that the response is only sent once
        if (state.sent) {
            const err = Error('Response already sent for ' + request.id);
            err.code = 'ESSENT';
            emitter.emit('error', err);
            throw err;
        }
        state.sent = true;

        // figure out what arguments were passed in
        if (arguments.length === 0) {
            code = state.statusCode;
            body = state.body;
            headers = {};
        } else if (arguments.length === 1) {
            body = arguments[0];
            code = state.statusCode;
            headers = {};
        } else if (arguments.length === 2) {
            if (typeof arguments[0] !== 'number') {
                body = arguments[0];
                headers = arguments[1];
                code = state.statusCode;
            } else {
                headers = {};
            }
        }

        // update status code
        if (code !== state.statusCode) factory.status(code);
        if (state.statusCode === 0) factory.status(200);

        // update the body
        if (body !== state.body) factory.body(body);

        // set additional headers
        Object.keys(headers).forEach(function(key) {
            factory.set(key, headers[key]);
        });

        // call the send hooks
        executeHooks(factory, hooks.send.slice(0), request)
            .then(() => {
                const store = map.get(this);

                // fire an event about the current state
                const rawHeaderString = rawHeaders(state.headers, state.cookies);
                const subBody = truncateString(state.body);
                factory.log('sent', state.body === subBody ? state.body : subBody + '...', {
                    body: state.body,
                    cookies: state.cookies,
                    headers: state.headers,
                    statusCode: state.statusCode
                });

                // resolve the request
                const sendData = {
                    body: state.body,
                    cookies: state.cookies,
                    headers: state.headers,
                    rawHeaders: rawHeaderString,
                    statusCode: state.statusCode
                };
                if (store.error) sendData.error = store.error;
                request.resolve(sendData);
            });

        return factory;
    };

    /**
     * Send a status code with a default message.
     * @name Response#sendStatus
     * @param {number} code
     * @returns {Response}
     */
    factory.sendStatus = function(code) {
        factory.status(code, true);
        factory.send();
    };

    /**
     * Set a header.
     * @name Response#set
     * @param {string} key
     * @param {string} value
     * @returns {Response}
     */
    factory.set = function(key, value) {
        state.headers[key] = '' + value;
        factory.log('set-header', key + ': ' + value, {
            header: key,
            value: value
        });
        return factory;
    };

    /**
     * Get the current state information for the response.
     * @name Response#state
     * @type {{body: *, cookies: [], headers: {}, sent: boolean, statusCode: number}}
     */
    Object.defineProperty(factory, 'state', {
        get: function() {
            let body = state.body;
            if (isPlainObject(body)) body = JSON.parse(JSON.stringify(body));
            return {
                body: body,
                cookies: state.cookies.map(cookie => {
                    const result = Object.assign({}, cookie);
                    result.options = Object.assign({}, result.options);
                    return result;
                }),
                headers: Object.assign({}, state.headers),
                sent: state.sent,
                statusCode: state.statusCode
            }
        }
    });

    /**
     * Set the status code.
     * @name Response#status
     * @param {number} code
     * @param {boolean} [includeMessage=false]
     * @returns {Response}
     */
    factory.status = function(code, includeMessage) {
        state.statusCode = code;
        if (includeMessage) {
            factory.set('Content-Type', 'text/plain');
            state.body = httpStatus[code];
        }
        factory.log('set-status', code, { statusCode: code, includeMessage: includeMessage });
        return factory;
    };

    return factory;
}

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
    } else {
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