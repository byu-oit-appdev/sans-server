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

exports.reqLog = function(req, log) {
    return function(title, message, details) {
        if (arguments.length === 1 || (arguments.length === 2 && typeof arguments[1] === 'object')) {
            title = 'log';
            message = arguments[0];
            details = arguments[1];
        }
        log(req, title, message, details);
    };
};