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
const Typed             = require('fully-typed');

const httpMethods = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'];

exports.request = Typed({
    type: Object,
    allowNull: false,
    properties: {
        body: {
            validator: function(value) {
                switch (typeof value) {
                    case 'object':
                    case 'string':
                    case 'undefined':
                        return true;
                }
                return 'Expected a string, an object, or undefined';
            }
        },
        headers: {
            type: Object,
            default: {},
            schema: { type: String },   // all property values must be strings
            transform: v => v ? Object.assign({}, v) : {}
        },
        method: {
            type: String,
            default: 'GET',
            transform: v => v.toUpperCase()
        },
        path: {
            type: String,
            default: '',
            transform: v => '/' + v.replace(/^\//, '').replace(/\/$/, '')
        },
        query: {
            type: Object,
            default: {},
            schema: [       // property values can be strings or arrays of strings
                { type: String },
                { type: Array, schema: { type: String } }
            ],
            transform: cloneObject
        }
    }
});


exports.server = Typed({
    type: Object,
    allowNull: false,
    properties: {
        hooks: {
            type: Array,
            default: [],
            schema: {
                type: Function
            }
        },
        logs: {
            type: Object,
            allowNull: false,
            default: {},
            properties: {
                duration: {
                    type: Boolean,
                    default: false,
                },
                grouped: {
                    type: Boolean,
                    default: true,
                },
                silent: {
                    type: Boolean,
                    default: false,
                },
                timeDiff: {
                    type: Boolean,
                    default: true,
                },
                timeStamp: {
                    type: Boolean,
                    default: false,
                },
                verbose: {
                    type: Boolean,
                    default: false,
                },
            }
        },
        methodCheck: {
            type: Boolean,
            default: true
        },
        middleware: {
            type: Array,
            default: [],
            schema: {
                type: Function
            }
        },
        supportedMethods: {
            type: Array,
            default: httpMethods.slice(0),
            schema: {
                type: String,
                enum: httpMethods.slice(0)
            }
        },
        timeout: {
            type: Number,
            default: 30,
            min: 0
        }
    }
});
exports.server.httpMethods = httpMethods;

function cloneObject(obj) {
    if (Array.isArray(obj)) {
        return obj.map(cloneObject);
    } else if (obj && typeof obj === 'object') {
        const result = {};
        Object.keys(obj).forEach(key => result[key] = cloneObject(obj[key]));
        return result;
    } else {
        return obj;
    }
}