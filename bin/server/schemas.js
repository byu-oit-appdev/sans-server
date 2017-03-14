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
            validate: v => !v || typeof v === 'string' || v.constructor === Object
        },
        headers: {
            type: Object,
            default: {},
            transform: v => v ? Object.assign({}, v) : {},
            validate: isObjectKeyValueStringOrFalsy
        },
        method: {
            default: 'GET',
            transform: v => v.toUpperCase(),
            validate: v => httpMethods.indexOf(v.toUpperCase()) !== -1
        },
        path: {
            type: String,
            default: '',
            transform: v => '/' + v.replace(/^\//, '').replace(/\/$/, ''),
            validate: v => !/[?=#]/.test(v)
        },
        query: {
            type: Object,
            default: {},
            transform: v => v ? Object.assign({}, v) : {},
            validate: isObjectKeyValueStringOrFalsy
        }
    }
});


exports.server = Typed({
    type: Object,
    allowNull: false,
    properties: {
        logs: {
            type: Object,
            allowNull: false,
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
        },
        unhandled: {
            type: Function
        }
    }
});
exports.server.httpMethods = httpMethods;



function isObjectKeyValueStringOrFalsy(v) {
    if (!v) return true;
    if (typeof v !== 'object') return false;

    const keys = Object.keys(v);
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        if (typeof key !== 'string' || typeof v[key] !== 'string') return false;
    }

    return true;
}