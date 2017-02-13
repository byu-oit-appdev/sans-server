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
const schemas               = require('./schemas');
const uuid                  = require('../uuid');

module.exports = Request;

/**
 * Create a request instance.
 * @param {Object|string} [configuration={}]
 * @returns {Request}
 * @constructor
 */
function Request(configuration) {
    if (typeof configuration === 'string') configuration = { path: configuration };

    if (/\?/.test(configuration.path)) {
        const parts = configuration.path.split('?');
        configuration.path = parts[0];

        const query = {};
        parts[1].split('&')
            .forEach(pair => {
                const kv = pair.split('=');
                query[kv[0]] = kv[1] || '';
            });
        configuration.query = Object.assign(query, configuration.query || {})
    }

    const config = schemas.request.normalize(configuration || {});
    const factory = Object.create(Request.prototype);

    /**
     * @name Request#body
     * @type {*}
     */
    factory.body = config.body;

    /**
     * @name Request#headers
     * @type {Object<string,string>}
     */
    factory.headers = Object.keys(config.headers)
        .reduce(function(headers, key) {
            const value = config.headers[key];
            key = key
                .split('-')
                .map(function(v) {
                    return v.substr(0, 1).toUpperCase() + v.substr(1).toLowerCase()
                })
                .join('-');
            headers[key] = value;
            return headers;
        }, {});

    /**
     * @name Request#id
     * @type {string}
     */
    Object.defineProperty(factory, 'id', {
        value: uuid(),
        writable: false
    });

    /**
     * @name Request#method
     * @type {string}
     */
    factory.method = config.method;

    /**
     * @name Request#path
     * @type {string}
     */
    factory.path = config.path;

    /**
     * @name Request#query
     * @type {object<string,string>}
     */
    factory.query = config.query;

    /**
     * @name Request#url
     * @type {string}
     */
    factory.url =  config.path + buildQueryString(config.query);

    return factory;
}

/**
 * Build a query string from a query map.
 * @param {object} query
 * @returns {string}
 */
function buildQueryString(query) {
    const results = Object.keys(query).reduce(function(ar, key) {
        ar.push(key + (query[key] !== '' ? '=' + query[key] : ''));
        return ar;
    }, []);
    return results.length > 0 ? '?' + results.join('&') : '';
}