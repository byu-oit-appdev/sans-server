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
const log                   = require('../bin/server/log');
const Request               = require('../bin/server/request');

describe('log', function() {

    describe('on', () => {

        it('can register function', () => {
            const req = Request('/');
            expect(() => log.on(req, () => {})).not.to.throw(Error);
        });

        it('cannot register non-function', () => {
            const req = Request('/');
            expect(() => log.on(req, 'foo')).to.throw(Error);
        });

    });

    it('can fire log event', done => {
        const req = Request('/');
        const e = {};

        const firer = log.firer('test');

        log.on(req, (firer, action, message, event) => {
            try {
                expect(firer).to.equal('TEST');
                expect(action).to.equal('fired');
                expect(message).to.equal('message');
                expect(event).to.equal(e);
                done();
            } catch (err) {
                done(err);
            }
        });

        firer(req, 'fired', 'message', e);
    });

    describe('off', () => {

        it('can remove existing handler', () => {
            const req = Request('/');
            log.on(req, () => {});
            expect(() => log.off(req)).not.to.throw(Error);
        });

        it('does not throw error for non-existent handler', () => {
            const req = Request('/');
            expect(() => log.off(req)).not.to.throw(Error);
        });

    });

});