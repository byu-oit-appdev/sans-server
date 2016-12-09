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
const schemata      = require('object-schemata');

const rxUrl = /^https?:\/\/[\s\S]{1,}?(?::\d+)?(?:\/[\s\S]+?)?$/;

exports.request = schemata({
    body: {
        defaultValue: undefined
    },
    headers: {
        help: 'This must be an object of key value pairs where each key and its value is a string.',
        defaultValue: {},
        transform: function(v) {
            const copy = {};
            Object.keys(v).forEach(function(key) {
                copy[key.toLowerCase()] = v[key];
            });
            return copy;
        },
        validate: isObjectKeyValueString
    },
    method: {
        defaultValue: 'GET',
        transform: function(v) { return v.toUpperCase(); }
    },
    path: {
        help: 'This must be a string that represents the URL path without the domain, query parameters, or hash.',
        defaultValue: '',
        transform: function (v) { return v.replace(/^\//, '').replace(/\/$/, ''); },
        validate: function(v) { return typeof v === 'string' && !/[?=#]/.test(v) }
    },
    query: {
        help: 'This must be an object of key value pairs where each key and its value is a string.',
        defaultValue: {},
        transform: copyObject,
        validate: isObjectKeyValueString
    }
});

const httpMethods = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH'];
exports.server = schemata({
    logs: {
        help: 'Expected a non-null object.',
        defaultValue: {
            duration: false,
            grouped: true,
            silent: false,
            timeDiff: true,
            timeStamp: false,
            verbose: false
        },
        transform: function(v) {
            return {
                duration: v.hasOwnProperty('duration') ? !!v.duration : false,
                grouped: v.hasOwnProperty('duration') ? !!v.grouped : true,
                silent: v.hasOwnProperty('silent') ? !!v.silent : true,
                timeDiff: v.hasOwnProperty('timeDiff') ? !!v.timeDiff : true,
                timeStamp: v.hasOwnProperty('timeStamp') ? !!v.timeStamp : false,
                verbose: v.hasOwnProperty('verbose') ? !!v.verbose : false
            }
        },
        validate: function(v) { return v && typeof v === 'object'; }
    },
    middleware: {
        help: 'This must be an array of functions.',
        defaultValue: [],
        validate: function(v) {
            if (!Array.isArray(v)) return false;
            for (let i = 0; i < v.length; i++) {
                if (typeof v[i] !== 'function') return false;
            }
            return true;
        }
    },
    supportedMethods: {
        help: 'This must be an array with one or more of the following values: ' + httpMethods.join(', '),
        defaultValue: httpMethods.slice(0),
        transform: function(v) {
            return v.map(function(i) { return i.toUpperCase(); });
        },
        validate: function(v) {
            if (!Array.isArray(v)) return false;
            for (let i = 0; i < v.length; i++) {
                if (httpMethods.indexOf(v[i]) === -1) return false;
            }
            return true;
        }
    },
    timeout: {
        help: 'This must be a non-negative number.',
        defaultValue: 30,
        validate: function(v) { return typeof v === 'number' && !isNaN(v) && v >= 0 }
    }
});
exports.server.httpMethods = httpMethods;



function copyObject(v) {
    return Object.assign({}, v);
}

function isObjectKeyValueString(v) {
    if (!v || typeof v !== 'object') return false;

    const keys = Object.keys(v);
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        if (typeof key !== 'string' || typeof v[key] !== 'string') return false;
    }

    return true;
}