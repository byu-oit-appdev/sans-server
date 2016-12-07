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
const expect                = require('chai').expect;
const Request               = require('../bin/server/request');
const Response              = require('../bin/server/response');

describe('response', () => {
    let req;

    beforeEach(function() {
        req = Request({});
    });

    it('can clear a cookie', (done) => {
        const res = Response(req, {}, function(err, res) {
            try {
                expect(res.rawHeaders).to.equal('Set-Cookie: foo=; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
                expect(res.cookies.foo.serialized).to.equal('foo=; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
                done();
            } catch (e) {
                done(e);
            }
        });

        res.clearCookie('foo');
        res.send();
    });

    it('can set a cookie', (done) => {
        const res = Response(req, {}, function(err, res) {
            try {
                expect(res.rawHeaders).to.equal('Set-Cookie: foo=bar');
                expect(res.cookies.foo.serialized).to.equal('foo=bar');
                done();
            } catch (e) {
                done(e);
            }
        });

        res.cookie('foo', 'bar');
        res.send();
    });

    it('overwrites cookie with same name', done => {
        const res = Response(req, {}, function(err, res) {
            try {
                expect(res.rawHeaders).to.equal('Set-Cookie: foo=baz');
                done();
            } catch (e) {
                done(e);
            }
        });

        res.cookie('foo', 'bar');
        res.cookie('foo', 'baz');
        res.send();
    });

    it('can produce event', done => {
        const handlers = {
            foo: [
                function(data) {
                    expect(data).to.equal('bar');
                    done();
                }
            ]
        };

        const res = Response(req, handlers, function(err, res) {});

        res.event('foo', 'bar');
        res.send();
    });

    it('can redirect', done => {
        const res = Response(req, {}, function(err, res) {
            try {
                expect(res.rawHeaders).to.equal('Location: http://foo.com');
                done();
            } catch (e) {
                done(e);
            }
        });

        res.redirect('http://foo.com');
    });

    it('can detect if sent', () => {
        const res = Response(req, {}, function(err, res) {});
        expect(res.sent).to.equal(false);
        res.send('');
        expect(res.sent).to.equal(true);
    });

    it('can send body only', done => {
        const res = Response(req, {}, function(err, res) {
            try {
                expect(res.statusCode).to.equal(200);
                expect(res.body).to.equal('body');
                done();
            } catch (e) {
                done(e);
            }
        });

        res.send('body');
    });

    it('can send code and body', done => {
        const res = Response(req, {}, function(err, res) {
            try {
                expect(res.statusCode).to.equal(100);
                expect(res.body).to.equal('body');
                done();
            } catch (e) {
                done(e);
            }
        });

        res.send(100, 'body');
    });

    it('can send body and headers', done => {
        const res = Response(req, {}, function(err, res) {
            try {
                expect(res.statusCode).to.equal(200);
                expect(res.body).to.equal('body');
                expect(res.rawHeaders).to.equal('Foo: bar');
                done();
            } catch (e) {
                done(e);
            }
        });

        res.send('body', { foo: 'bar' });
    });

    it('can send code, body, and headers', done => {
        const res = Response(req, {}, function(err, res) {
            try {
                expect(res.statusCode).to.equal(100);
                expect(res.body).to.equal('body');
                expect(res.rawHeaders).to.equal('Foo: bar');
                done();
            } catch (e) {
                done(e);
            }
        });

        res.send(100, 'body', { foo: 'bar' });
    });
});