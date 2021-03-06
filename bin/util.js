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
const util      = require('util');

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
 * Call util.format with args.
 * @param {object} args
 * @returns {string}
 */
exports.format = function(args) {
    return util.format.apply(util, args);
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

exports.seconds = function seconds(milliseconds) {
    let seconds = milliseconds / 1000;

    if (seconds > 9999) return '9999+';
    if (seconds > 999) return Math.round(seconds) + ' ';

    const numeral = Math.floor(seconds);
    const nLength = String(numeral).length;
    const decimal = String(Math.round((seconds - numeral) * Math.pow(10, 4 - nLength)) / Math.pow(10, 4 - nLength)).split('.')[1];

    return numeral + '.' + (!decimal ? '000' : decimal + '0'.repeat(3)).substr(0, 4 - nLength);
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