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

exports.server = Typed({
    type: Object,
    allowNull: false,
    properties: {
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
                timestamp: {
                    type: Boolean,
                    default: false,
                },
                verbose: {
                    type: Boolean,
                    default: false,
                },
            }
        },
        rejectable: {
            type: Boolean,
            default: false
        },
        timeout: {
            type: Number,
            default: 30,
            min: 0
        },
        useBuiltInHooks: {
            type: Boolean,
            default: true
        }
    }
});
exports.server.httpMethods = httpMethods;