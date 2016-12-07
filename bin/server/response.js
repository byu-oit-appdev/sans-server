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
const event                 = require('../event-interface').firer('response');
const httpStatus            = require('http-status');

module.exports = Response;

/**
 * @name Response
 * @param {Request} request The request associated with this response.
 * @param {function} callback A function that is called once completed.
 * @returns {Response}
 * @constructor
 */
function Response(request, callback) {
    const cookies = {};
    const factory = Object.create(Response.prototype);
    const _headers = {};
    let sent = false;
    let statusCode = 200;

    /**
     * Clear a cookie.
     * @name Response#clearCookie
     * @param {string} name
     * @param {object} [options={}]
     */
    factory.clearCookie = function(name, options) {
        const opts = Object.assign({}, options || {}, {
            expires: new Date(1)        // expired
        });
        return factory.cookie(name, '', opts);
    };

    /**
     * Set a cookie.
     * @name Response#cookie
     * @param {string} name
     * @param {string} value
     * @param {object} [options={}]
     */
    factory.cookie = function(name, value, options) {
        if (value && typeof value === 'object') value = JSON.stringify(value);
        cookies[name] = {
            options: options,
            serialized: cookie.serialize(name, value, options || {}),
            value: value
        };
        
        event(request, 'set-cookie', name + ': ' + cookies[name], {
            name: name,
            options: options,
            serialized: cookies[name],
            value: value
        });
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
        get: function() { return sent; }
    });

    /**
     * Build then send the response
     * @name Response#send
     * @param {number} [code=200]
     * @param {*,Error} [body='']
     * @param {object} [headers={}]
     * @returns {Response}
     */
    factory.send = function(code, body, headers) {
        let err = null;

        // make sure that the response is only sent once
        if (sent) throw Error('Response already sent for ' + request.id);
        sent = true;

        // figure out what arguments were passed in
        if (arguments.length === 0) {
            code = statusCode;
            body = '';
            headers = {};
        } else if (arguments.length === 1) {
            body = arguments[0];
            code = statusCode;
            headers = {};
        } else if (arguments.length === 2) {
            if (typeof arguments[0] !== 'number') {
                body = arguments[0];
                headers = arguments[1];
                code = statusCode;
            } else {
                headers = {};
            }
        }

        // log status code event
        if (code !== statusCode) factory.status(code);

        // set additional headers
        Object.keys(headers).forEach(function(key) {
            factory.set(key, headers[key]);
        });

        // if the body is an Error then set the status code to 500
        if (body instanceof Error) {
            err = body;
            event(request, 'error', err.message, {
                message: err.message,
                stack: err.stack
            });

            code = 500;
            body = httpStatus[500];
            removeObjectProperties(_headers);
            removeObjectProperties(cookies);
            event(request, 'reset-headers', 'All headers reset.', {});
            event(request, 'reset-cookies', 'All cookies reset.', {});
            factory.set('Content-Type', 'text/plain');
            factory.status(500);
        }

        // if the body is an object then stringify
        if (typeof body === 'object') {
            body = JSON.stringify(body);
            factory.set('Content-Type', 'application/json');
        }

        // freeze the cookies and headers
        Object.keys(cookies).forEach(function(key) { Object.freeze(cookies[key]); });
        Object.freeze(cookies);
        Object.freeze(_headers);

        // call the callback and fire an event
        const rawHeaderString = rawHeaders(_headers, cookies);
        const subBody = body.substr(0, 25);
        event(request, 'sent', body === subBody ? body : subBody + '...', {
            body: body,
            cookies: cookies,
            headers: _headers,
            statusCode: code
        });
        callback(err, {
            body: body,
            cookies: cookies,
            headers: _headers,
            rawHeaders: rawHeaderString,
            statusCode: code
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
        factory.set('Content-Type', 'text/plain');
        return factory.send(code, httpStatus[code]);
    };

    /**
     * Set a header.
     * @name Response#set
     * @param {string} key
     * @param {string} value
     * @returns {Response}
     */
    factory.set = function(key, value) {
        key = key
            .split('-')
            .map(function(v) {
                return v.substr(0, 1).toUpperCase() + v.substr(1).toLowerCase()
            })
            .join('-');
        _headers[key] = '' + value;
        event(request, 'set-header', key + ': ' + value, {
            header: key,
            value: value
        });
        return factory;
    };

    /**
     * Set the status code.
     * @name Response#status
     * @param {number} code
     * @returns {Response}
     */
    factory.status = function(code) {
        statusCode = code;
        event(request, 'set-status', code, {
            statusCode: code
        });
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

function removeObjectProperties(obj) {
    Object.keys(obj)
        .forEach(function(key) {
            delete obj[key];
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
            results.push('Set-Cookie: ' + cookies[key]);
        });
    return results.join('\n');
}