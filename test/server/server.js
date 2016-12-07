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
const expect            = require('chai').expect;
const SanServer         = require('../../bin/server/san-server');

describe('server/server', () => {
    SanServer.defaults.logs.silent = true;

    describe('paradigms', () => {

        it('promise paradigm resolves', () => {
            const server = SanServer();
            const result = server.request();
            expect(result).to.be.instanceof(Promise);
            return result;
        });

        it('promise paradigm rejects', () => {
            const server = SanServer();
            return server.request(5)
                .then(
                    () => { throw Error('Should not get here') },
                    err => expect(err).to.be.instanceof(Error)
                );
        });

        it('callback paradigm resolves', (done) => {
            const server = SanServer();
            const result = server.request(function(err, response) {
                done(err);
            });
            expect(result).to.equal(undefined);
        });

        it('callback paradigm resolves', (done) => {
            const server = SanServer();
            server.request(5, function(err, response) {
                expect(err).to.be.instanceof(Error);
                done();
            });
        });

    });

    /*describe('methods', () => {

        it('allows GET', () => {
            const serve = Server();
            return serve({ method: 'GET'}).then(res => expect(res.statusCode).to.equal(400));
        });

        it('does not allow FOO', () => {
            const serve = Server();
            return serve({ method: 'FOO'}).then(res => expect(res.statusCode).to.equal(405));
        });

    });

    describe('middleware', () => {

        it('can throw error', () => {
            const serve = Server({ middleware: [ function fail(req, res, next) { throw Error('Fail'); } ]});
            return serve().then(res => expect(res.statusCode).to.equal(500));
        });

        it('can next error', () => {
            const serve = Server({ middleware: [ function fail(req, res, next) { next(Error('Fail')); } ]});
            return serve().then(res => expect(res.statusCode).to.equal(500));
        });

    });

    describe('response', () => {

        it('send twice throws error', (done) => {
            const serve = Server({ middleware: [ function (req, res, next) { res.send('ok'); res.send('fail'); } ]});
            try {
                serve().then(res => expect(res.statusCode).to.equal(200));
            } catch (e) {
                expect(e.message.indexOf('Response already sent')).to.equal(0);
                done();
            }
        });

    });

    describe('timeout', () => {

        it('can timeout', () => {
            const serve = Server({ middleware: [ function timeout(req, res, next) { } ], timeout: .5 });
            return serve().then(res => expect(res.statusCode).to.equal(408));
        });

    });*/

});