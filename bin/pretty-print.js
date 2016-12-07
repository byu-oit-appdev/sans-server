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

/**
 * Add a repeating character at the start or end of a string until it reaches the specified length
 * @param {string} value
 * @param {string} ch
 * @param {boolean} after
 * @param {number} length
 * @returns {string}
 */
exports.addCharacters = function (value, ch, after, length) {
    let result = '' + value;
    while (result.length < length) {
        if (after) {
            result += ch;
        } else {
            result = ch + result;
        }
    }
    return result;
};

exports.fixedLength = function(str, length) {
    str += '                                                                                        ';
    if (str.length > length) str = str.substr(0, length);
    return str;
};

/**
 * Get formatted time in seconds.
 * @param {number} milliseconds
 * @returns {string}
 */
exports.seconds = function (milliseconds) {
    let seconds = milliseconds / 1000;

    const numeral = Math.floor(seconds);
    const decimalLen = 4 - numeral.toString().length;
    const decimal = exports.addCharacters(Math.round((seconds - numeral) * 1000).toString(), '0', false, 3).substr(0, decimalLen);

    return numeral + (decimal.length > 0 ? '.' : ' ') + decimal;
};