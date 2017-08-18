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

exports.copy = function(value) {
    const map = new WeakMap();
    return copy(value, map);
};

exports.Error = MetaError;

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
 * @param {String} category
 * @param {Object} args An arguments object with: [type], message, [details]
 */
exports.log = function(category, args) {
    const event = {
        category: category,
        details: {},
        message: '',
        type: 'log'
    };

    // figure out what parameters were passed in on args
    const length = args.length;
    if (length === 0) {
        throw exports.Error('Invalid number of log arguments. Expected at least one. Received: ' + length, 'EPARM');
    } else if (length === 1 || (args.length === 2 && typeof args[1] === 'object')) {
        event.message = args[0];
        if (args[1]) event.details = args[1];
    } else if (length === 2) {
        event.type = args[0];
        event.message = args[1];
    } else {
        event.type = args[0];
        event.message = args[1];
        if (args[2]) event.details = args[2];
    }

    // type check
    if (typeof event.category !== 'string') throw exports.Error('Invalid category specified. Expected a string. Received: ' + event.category, 'EPARM');
    if (typeof event.type !== 'string') throw exports.Error('Invalid type specified. Expected a string. Received: ' + event.type, 'EPARM');
    if (typeof event.message !== 'string') throw exports.Error('Invalid message specified. Expected a string. Received: ' + event.message, 'EPARM');
    if (!exports.isPlainObject(event.details)) throw exports.Error('Invalid details specified. Expected a plain object. Received: ' + event.details, 'EPARM');

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

/**
 * Generate a MetaError instance.
 * @augments {Error}
 * @param {String} message The error message.
 * @param {*} code An identifier to assign the error.
 * @param {Object} [metadata] A non-null object of metadata to apply to the error. Take care not to override error
 * properties (code, message, stack, etc) unless you intend to.
 * @constructor
 */
function MetaError(message, code, metadata) {
    this.code = code;
    this.message = message;
    this.stack = (new Error()).stack;
    if (metadata && typeof metadata === 'object') Object.assign(this, metadata);
}
MetaError.prototype = Object.create(Error.prototype);
MetaError.prototype.name = 'MetaError';
MetaError.prototype.constructor = MetaError;