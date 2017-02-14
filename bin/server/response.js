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
const emitter               = require('../emitter');
const httpStatus            = require('http-status');
const log                   = require('./log').firer('response');
const prettyPrint           = require('../pretty-print');

module.exports = Response;

/**
 * @name Response
 * @param {Request} request The request associated with this response.
 * @param {function} callback A function that is called once completed. The function will receive an error
 * as its first parameter and the response object as its second parameter. The response object will be provided
 * regardless of whether an error occurred.
 * @returns {Response}
 * @constructor
 */
function Response(request, callback) {
    const factory = Object.create(Response.prototype);
    const hooks = {
        send: []
    };
    const state = {
        body: '',
        cookies: {},
        headers: {},
        sent: false,
        statusCode: undefined
    };

    /**
     * Set the body content.
     * @param {*} value
     * @returns {Response}
     */
    factory.body = function(value) {
        let str = '' + value;
        if (str.length > 40) str = str.substr(0, 25) + '...';

        state.body = value;
        log(request, 'body-set', str, {
            value: value
        });

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
     * @param {string} name
     * @returns {Response}
     */
    factory.clearHeader = function(name) {
        const key = prettyPrint.headerCase(name);
        if (state.headers.hasOwnProperty(key)) {
            const value = state.headers[key];
            delete state.headers[key];
            log(request, 'clear-header', key + ': ' + value, {
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
        if (value && typeof value === 'object') value = JSON.stringify(value);
        state.cookies[name] = {
            options: options,
            serialized: cookie.serialize(name, value, options || {}),
            value: value
        };
        
        log(request, 'set-cookie', name + ': ' + state.cookies[name], {
            name: name,
            options: options,
            serialized: state.cookies[name],
            value: value
        });
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

        log(request, 'send-hook', 'Hook defined', { hook: hook });
        hooks.send.push(hook);

        return factory;
    };

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
        let err = null;

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
        if (state.statusCode === undefined) factory.status(200);

        // update the body
        if (body !== state.body) factory.body(body);

        // set additional headers
        Object.keys(headers).forEach(function(key) {
            factory.set(key, headers[key]);
        });

        // call the send hooks
        executeHooks(factory, hooks.send.slice(0), log, request)
            .then(() => {

                // if the body is an Error then set the status code to 500
                if (state.body instanceof Error) {
                    err = state.body;
                    log(request, 'error', err.stack, {
                        message: err.message,
                        stack: err.stack
                    });

                    state.cookies = {};
                    state.headers = {};
                    log(request, 'reset-cookies', 'All cookies reset.', {});
                    log(request, 'reset-headers', 'All headers reset.', {});
                    factory.status(500, true);
                }

                // if the body is an object then stringify
                if (typeof state.body === 'object') {
                    factory.set('Content-Type', 'application/json');
                    factory.body(JSON.stringify(state.body));
                }

                // update body
                if (typeof state.body !== 'string') factory.body(state.body.toString());

                // call the callback and fire an event
                const rawHeaderString = rawHeaders(state.headers, state.cookies);
                const subBody = state.body.substr(0, 25);
                log(request, 'sent', state.body === subBody ? state.body : subBody + '...', {
                    body: state.body,
                    cookies: state.cookies,
                    headers: state.headers,
                    statusCode: state.statusCode
                });
                callback(err, {
                    body: state.body,
                    cookies: state.cookies,
                    headers: state.headers,
                    rawHeaders: rawHeaderString,
                    statusCode: state.statusCode
                });
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
        key = prettyPrint.headerCase(key);
        state.headers[key] = '' + value;
        log(request, 'set-header', key + ': ' + value, {
            header: key,
            value: value
        });
        return factory;
    };

    /**
     * Get the current state information for the response.
     * @name Response#state
     * @type {{body: *, cookies: {}, headers: {}, sent: boolean, statusCode: number}}
     */
    Object.defineProperty(factory, 'state', {
        get: function() {
            return {
                body: typeof state.body === 'object' ? JSON.parse(JSON.stringify(state.body)) : state.body,
                cookies: Object.assign({}, state.cookies),
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
        log(request, 'set-status', code, { statusCode: code, includeMessage: includeMessage });
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

function executeHooks(server, hooks, log, request) {
    if (hooks.length === 0) return Promise.resolve();

    // get the hook to process
    const hook = hooks.shift();

    // create a deferred promise
    const deferred = {};
    deferred.promise = new Promise(function(resolve, reject) {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });

    // safely execute the hook
    log(request, 'send-hook', 'Executing' + (hook.name ? ' ' + hook.name : ''), { hook: hook });
    if (hook.length > 1) {
        try {
            const callback = function (err) {
                if (err) return deferred.reject(err);
                deferred.resolve();
            };
            hook.call(server, server.state, callback);
        } catch (err) {
            deferred.reject(err);
        }
    } else {
        try {
            Promise.resolve(hook.call(server, server.state))
                .then(deferred.resolve, deferred.reject);
        } catch (err) {
            deferred.reject(err);
        }
    }

    // process the result of the hook
    return deferred.promise
        .then(() => executeHooks(server, hooks, log, request))
        .catch(function(err) {
            server.body(err);
        });
}

function rawHeaders(headers, cookies) {
    const results = [];
    Object.keys(headers)
        .forEach(function(key) {
            results.push(key + ': ' + headers[key]);
        });
    Object.keys(cookies)
        .forEach(function(key) {
            results.push('Set-Cookie: ' + cookies[key].serialized);
        });
    return results.join('\n');
}