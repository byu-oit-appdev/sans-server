/**
 *  @license
 *    Copyright 2017 Brigham Young University
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

/**
 * @interface LogEvent
 * @type {Object}
 * @property {string} action The sub-category that specifies the type of log message.
 * @property {string} category The category that the log falls within.
 * @property {object} details An object listing all the pertinent data that is associated with the log.
 * @property {string} message The log message.
 * @property {number} timestamp When the log event occurred.
 */

/**
 * If an error occurs while creating or sending the response then this event is emitted with the error. The
 * error contains
 * the send function is called multiple times for a response.
 * @interface MetaError
 * @type {Error}
 * @property {string} code A code that specifies the error classification.
 * @property {string} message The error message.
 * @property {string} stack The error message stack.
 */

/**
 * Copy a value.
 * @param {*} value
 * @returns {*}
 */
exports.copy = function(value) {
    const map = new WeakMap();
    return copy(value, map);
};

/**
 * Get a promise for an event to be fired.
 * @param {EventEmitter} emitter
 * @param {string} event
 * @param {string} [errEvent='error']
 * @returns {Promise}
 */
exports.eventPromise = function(emitter, event, errEvent) {
    if (!errEvent) errEvent = 'error';

    const deferred = {};
    deferred.promise = new Promise(function(resolve, reject) {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });

    emitter.on(event, function(data) {
        deferred.resolve(data);
    });

    emitter.on(errEvent, function(err) {
        deferred.resolve(err);
    });

    return deferred.promise;
};

exports.finally = function(promise, callback) {
    promise.then(
        value => callback(null, value),
        err => callback(err, null)
    );
};

/**
 * Check to see if an object is plain.
 * @param {Object} o
 * @returns {boolean}
 */
exports.isPlainObject = function (o) {
    if (typeof o !== 'object' || !o) return false;

    const constructor = o.constructor;
    if (typeof constructor !== 'function') return false;

    const prototype = constructor.prototype;
    return !(!prototype || typeof prototype !== 'object' || !prototype.hasOwnProperty('isPrototypeOf'));
};

/**
 * Produce a log event.
 * @param {string} category
 * @param {object} args An arguments object with: [action], message, [details]
 * @returns {LogEvent}
 */
exports.log = function(category, args) {
    const event = {
        action: 'log',
        category: String(category),
        details: {},
        message: '',
        timestamp: Date.now()
    };

    // figure out what parameters were passed in on args
    const length = args.length;
    if (length === 0) {
        const err = Error('Invalid number of log arguments. Expected at least one. Received: ' + length);
        err.code = 'EPARM';
        throw err;
    } else if (length === 1 || (args.length === 2 && typeof args[1] === 'object')) {
        event.message = String(args[0]);
        if (args[1]) event.details = args[1];
    } else if (length === 2) {
        event.action = String(args[0]);
        event.message = String(args[1]);
    } else {
        event.action = String(args[0]);
        event.message = String(args[1]);
        if (args[2]) event.details = args[2];
    }

    // type check
    if (!exports.isPlainObject(event.details) && !(event.details instanceof Error)) {
        event.details = {};
    }

    return event;
};

/**
 * Perform a deep copy of a value.
 * @param {*} obj
 * @param {WeakMap} [map]
 * @returns {*}
 */
function copy(obj, map) {
    if (map.has(obj)) {
        return map.get(obj);
    } else if (Array.isArray(obj)) {
        const result = [];
        map.set(obj, result);
        obj.forEach(item => {
            result.push(copy(item, map));
        });
        return result;
    } else if (typeof obj === 'object' && obj) {
        const result = {};
        map.set(obj, result);
        Object.keys(obj).forEach(key => {
            result[key] = copy(obj[key], map);
        });
        return result;
    } else {
        return obj;
    }
}