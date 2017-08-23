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
const prettyPrint   = require('../pretty-print');
const util          = require('../util');

module.exports = Middleware;

function Middleware(server, type, code, reverse) {
    this.code = code;
    this.reverse = reverse;
    this.server = server;
    this.store = [];
    this.type = type;
}

Middleware.prototype.add = function(fn) {
    const code = this.code;
    const server = this.server;
    const store = this.store;
    const type = this.type;

    // validate input
    if (typeof fn !== 'function') {
        const err = Error('Invalid ' + this.type + ' specified. Expected a function. Received: ' + fn);
        err.code = 'ES' + code;
        context.emit('error', err);
        return;
    }

    // figure out middleware name and whether it is error middleware
    const name = code + '-' + (fn.name ? fn.name.toUpperCase() : store.length + 1);
    const errHandler = fn.length >= 4;

    // create a wrapper around the middleware
    const wrapped = function(err, req, res, next) {
        if (err && !errHandler) {
            server.emit('log', {
                action: 'skip',
                category: name,
                details: { type: type },
                message: 'Has error and ' + type + ' is not error handling'
            });
            next(err);

        } else if (!err && errHandler) {
            server.emit('log', {
                action: 'skip',
                category: name,
                details: { type: type },
                message: 'No error and ' + type + ' is for error handling'
            });
            next();

        } else {
            // start timer
            const start = Date.now();

            // define middleware arguments
            const done = function(err) {
                server.emit('log', {
                    action: 'end',
                    category: name,
                    details: {type: type},
                    message: 'Run duration: ' + prettyPrint.seconds(Date.now() - start)
                });
                next(err);
            };
            const args = [ req, res, done ];
            if (err) args.unshift(err);

            // run middleware
            server.emit('log', { action: 'start', category: name, details: { type: type }, message: '' });
            try {
                fn.apply(server, args);
            } catch (err) {
                done(err);
            }

        }
    };

    store.push(wrapped);
};

/**
 * Run middleware chain.
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise}
 */
Middleware.prototype.run = function(req, res) {
    const chain = this.store.slice(0);
    const reverse = this.reverse;
    return new Promise((resolve, reject) => {
        function next(err) {
            const callback = chain[reverse ? 'pop' : 'shift']();
            if (callback) {
                callback(err, req, res, next);
            } else if (err) {
                reject(err);
            } else {
                resolve();
            }
        }
        next();
    });
};