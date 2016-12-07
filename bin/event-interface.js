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
const map = new WeakMap();

exports.firer = function(firer) {
    firer = firer.toUpperCase();
    return function(request, action, message, event) {
        const handler = map.get(request);
        if (handler) handler(firer, action, message, event);
    }
};

exports.on = function(request, handler) {
    if (typeof handler !== 'function') throw Error('Invalid handler specified. Expected a function. Received: ' + handler);
    map.set(request, handler);
};

exports.off = function(request) {
    if (map.has(request)) map.delete(request);
};