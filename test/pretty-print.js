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
const prettyPrint           = require('../bin/pretty-print');

describe('pretty-print', function() {

    describe('#addCharacters', function() {

        it('empty add before', () => {
            expect(prettyPrint.addCharacters('', '-', false, 3)).to.equal('---');
        });

        it('not empty add before', () => {
            expect(prettyPrint.addCharacters('+', '-', false, 3)).to.equal('--+');
        });

        it('too long add before', () => {
            expect(prettyPrint.addCharacters('++++', '-', false, 3)).to.equal('++++');
        });

        it('empty add after', () => {
            expect(prettyPrint.addCharacters('', '-', true, 3)).to.equal('---');
        });

        it('not empty add after', () => {
            expect(prettyPrint.addCharacters('+', '-', true, 3)).to.equal('+--');
        });

        it('too long add after', () => {
            expect(prettyPrint.addCharacters('++++', '-', true, 3)).to.equal('++++');
        });

    });

    describe('#fixedLength', () => {

        it('will append spaces', () => {
            expect(prettyPrint.fixedLength('+', 3)).to.equal('+  ');
        });

        it('will remove characters', () => {
            expect(prettyPrint.fixedLength('++++', 3)).to.equal('+++');
        });

        it('correct length', () => {
            expect(prettyPrint.fixedLength('+++', 3)).to.equal('+++');
        });

    });

    describe('#seconds', () => {

        it('thousandths', () => {
            expect(prettyPrint.seconds(1)).to.equal('0.001');
        });

        it('hundredths', () => {
            expect(prettyPrint.seconds(12)).to.equal('0.012');
        });

        it('tenths', () => {
            expect(prettyPrint.seconds(123)).to.equal('0.123');
        });

        it('ones', () => {
            expect(prettyPrint.seconds(1234)).to.equal('1.234');
        });

        it('tens', () => {
            expect(prettyPrint.seconds(12345)).to.equal('12.35');
        });

        it('hundreds', () => {
            expect(prettyPrint.seconds(123456)).to.equal('123.5');
        });

        it('thousands', () => {
            expect(prettyPrint.seconds(1234567)).to.equal('1235 ');
        });

        it('ten-thousands', () => {
            expect(prettyPrint.seconds(12345678)).to.equal('9999+');
        });

    });

});