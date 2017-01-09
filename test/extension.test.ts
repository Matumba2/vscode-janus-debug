import * as assert from 'assert';
import { EventEmitter } from 'events';
import * as vscode from 'vscode';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { cantorPairing, reverseCantorPairing } from '../src/cantor';
import { ConnectionLike } from '../src/connection';
import { ContextCoordinator } from '../src/context';
import { SocketLike } from '../src/network';
import { Command, ErrorCode, parseResponse, Response, variableValueToString } from '../src/protocol';
import { SourceMap } from '../src/sourceMap';
import { DebugProtocolTransport } from '../src/transport';
import { VariablesContainer, VariablesMap } from '../src/variablesMap';

suite('source map tests', () => {

    suite('remoteSourceUrl', () => {

        let sourceMap: SourceMap;

        setup(() => {
            sourceMap = new SourceMap();
            sourceMap.setAllRemoteUrls([
                '/usr/lib/fubar/script1.js',
                '/usr/lib/fubar/extension/script2.js',
                '/usr/lib/fubar/extension/script3.js',
                '/usr/lib/fubar/script4.js',
            ]);
        });

        test('different urls on localhost and target', () => {
            let result = sourceMap.remoteSourceUrl('/Users/bob/fubar/src/server/script1.js');
            assert.equal(result, '/usr/lib/fubar/script1.js');
        });

        test('fallback to local url', () => {
            let result = sourceMap.remoteSourceUrl('/Users/bob/fubar/bielefeld.js');
            assert.equal(result, '/Users/bob/fubar/bielefeld.js');
        });
    });
});

suite('variables map tests', () => {

    suite('createVariable', () => {

        let variablesMap: VariablesMap;

        setup(() => {
            variablesMap = new VariablesMap();
        });

        test('createStringVariable', () => {
            variablesMap.createVariable('stringVariable', 'myValue', 1, 1);
            let variablesContainer: VariablesContainer = variablesMap.getVariables(1);

            assert.equal(variablesContainer.variables.length, 1);
            assert.equal(variablesContainer.variables[0].name, 'stringVariable');
            assert.equal(variablesContainer.variables[0].evaluateName, 'stringVariable');
            assert.equal(variablesContainer.variables[0].value, 'myValue');
            assert.equal(variablesContainer.variables[0].type, 'string');
            assert.equal(variablesContainer.variables[0].variablesReference, 0);
        });

        test('createIntVariable', () => {
            variablesMap.createVariable('intVariable', 666, 1, 2);
            let variablesContainer: VariablesContainer = variablesMap.getVariables(2);

            assert.equal(variablesContainer.variables.length, 1);
            assert.equal(variablesContainer.variables[0].name, 'intVariable');
            assert.equal(variablesContainer.variables[0].evaluateName, 'intVariable');
            assert.equal(variablesContainer.variables[0].value, 666);
            assert.equal(variablesContainer.variables[0].type, 'number');
            assert.equal(variablesContainer.variables[0].variablesReference, 0);
        });

        test('createBooleanVariable', () => {
            variablesMap.createVariable('booleanVariable', true, 1, 3);
            let variablesContainer: VariablesContainer = variablesMap.getVariables(3);

            assert.equal(variablesContainer.variables.length, 1);
            assert.equal(variablesContainer.variables[0].name, 'booleanVariable');
            assert.equal(variablesContainer.variables[0].evaluateName, 'booleanVariable');
            assert.equal(variablesContainer.variables[0].value, 'true');
            assert.equal(variablesContainer.variables[0].type, 'boolean');
            assert.equal(variablesContainer.variables[0].variablesReference, 0);
        });

        test('createUndefinedVariable', () => {
            variablesMap.createVariable('undefinedVariable', undefined, 1, 4);
            let variablesContainer: VariablesContainer = variablesMap.getVariables(4);

            assert.equal(variablesContainer.variables.length, 1);
            assert.equal(variablesContainer.variables[0].name, 'undefinedVariable');
            assert.equal(variablesContainer.variables[0].evaluateName, 'undefinedVariable');
            assert.equal(variablesContainer.variables[0].value, 'undefined');
            assert.equal(variablesContainer.variables[0].type, 'undefined');
            assert.equal(variablesContainer.variables[0].variablesReference, 0);
        });

        test('createNullVariable', () => {
            variablesMap.createVariable('nullVariable', null, 1, 5);
            let variablesContainer: VariablesContainer = variablesMap.getVariables(5);

            assert.equal(variablesContainer.variables.length, 1);
            assert.equal(variablesContainer.variables[0].name, 'nullVariable');
            assert.equal(variablesContainer.variables[0].evaluateName, 'nullVariable');
            assert.equal(variablesContainer.variables[0].value, 'null');
            assert.equal(variablesContainer.variables[0].type, 'object');
            assert.equal(variablesContainer.variables[0].variablesReference, 0);
        });

        test('createArrayVariable', () => {
            let array = [1, 2, "test", true];
            variablesMap.createVariable('arrayVariable', array, 1, 6);
            let variablesContainer: VariablesContainer = variablesMap.getVariables(6);

            assert.equal(variablesContainer.variables.length, 1);
            assert.equal(variablesContainer.variables[0].name, 'arrayVariable');
            assert.equal(variablesContainer.variables[0].evaluateName, 'arrayVariable');
            assert.equal(variablesContainer.variables[0].value, '[Array]');
            assert.equal(variablesContainer.variables[0].type, 'array');

            let reference = variablesMap.createReference(1, 6, 'arrayVariable');
            variablesContainer = variablesMap.getVariables(reference);

            assert.notEqual(typeof variablesContainer, "undefined");
            assert.equal(variablesContainer.variables.length, array.length);

            let everyArrayEntriesPassed = array.every((element) => {
                return variablesContainer.variables.filter((variable) => {
                    return variable.value === element.toString();
                }).length === 1;
            });
            assert.equal(everyArrayEntriesPassed, true);

            let testEvaluateName = array.every((element, index) => {
                return variablesContainer.variables.filter((variable) => {
                    if (typeof variable.evaluateName !== 'undefined') {
                        return variable.evaluateName === `arrayVariable[${index}]`;
                    } else {
                        return false;
                    }
                }).length === 1;
            });
            assert.equal(testEvaluateName, true, 'Not every evaluate names are correct.');
        });

        test('createObjectVariable', () => {
            let obj = {
                stringProp: "stringValue",
                boolProp: false,
                intProp: 666
            };

            variablesMap.createVariable('objectVariable', obj, 1, 7);
            let variablesContainer: VariablesContainer = variablesMap.getVariables(7);

            assert.equal(variablesContainer.variables.length, 1);
            assert.equal(variablesContainer.variables[0].name, 'objectVariable');
            assert.equal(variablesContainer.variables[0].evaluateName, 'objectVariable');
            assert.equal(variablesContainer.variables[0].value, '[Object]');
            assert.equal(variablesContainer.variables[0].type, 'object');

            let reference = variablesMap.createReference(1, 7, 'objectVariable');
            variablesContainer = variablesMap.getVariables(reference);

            assert.notEqual(typeof variablesContainer, "undefined");
            assert.equal(variablesContainer.variables.length, Object.keys(obj).length);

            let everyPropertyEntriesPassed = variablesContainer.variables.every((variable) => {
                    if (obj.hasOwnProperty(variable.name) && obj[variable.name].toString() === variable.value) {
                        return true;
                    } else {
                        return false;
                    }
            });
            assert.equal(everyPropertyEntriesPassed, true);

            let testEvaluateName = variablesContainer.variables.forEach(variable => {
                assert.equal(
                    variable.evaluateName,
                    `objectVariable.${variable.name}`,
                    `Incorrect evaluate name. Expected "objectVariable.${variable.name}", got "${variable.evaluateName}"`
                );
            });
        });

    });
});

suite('debug adapter tests', () => {

    const DEBUG_ADAPTER = './out/src/debugSession.js';

    let debugClient: DebugClient;

    setup(() => {
        debugClient = new DebugClient('node', DEBUG_ADAPTER, 'janus');
        return debugClient.start();
    });

    teardown(() => debugClient.stop());

    suite('initialize', () => {

        test('should respond with supported features', done => {
            return debugClient.initializeRequest().then((response) => {
                let body = response.body || {};
                assert.equal(body.supportsConfigurationDoneRequest, true);
                assert.equal(body.supportsConditionalBreakpoints, false);
                done();
            }).catch(err => done(err));
        });
    });
});

suite('transport tests', () => {

    class MockSocket extends EventEmitter implements SocketLike {
        public write(data: Buffer | string, encoding?: string) { /* */ }
        public end() { /* */ }
        public receive(chunk: string): void {
            this.emit('data', new Buffer(chunk));
        }
    }

    let socket: MockSocket;
    let transport: DebugProtocolTransport;

    setup(() => {
        socket = new MockSocket();
        transport = new DebugProtocolTransport(socket);
    });

    suite('receive one response', () => {

        test('in one chunk', () => {
            transport.on('response', (response: Response) => {
                assert.equal(response.type, 'error');
                assert.equal(response.content.code, 2);
            });
            socket.receive('{"type":"error","code":2,"message":"Unknown JS Context."}\n');
        });

        test('in multiple chunks', () => {
            transport.on('response', (response: Response) => {
                assert.equal(response.type, 'info');
                assert.equal(response.subtype, 'stacktrace');
            });
            socket.receive('1/{"type":"info","subtype":"stacktr');
            socket.receive('ace","stacktrace":[{"url":"/home/bob/script.js","line":1');
            socket.receive('8,"rDepth":0}],"id":"857B3B96591A5163"}\n');
        });
    });

    suite('receive two responses', () => {

        test('in one chunk', () => {
            let responses: Response[] = [];

            transport.on('response', (response: Response) => {
                responses.push(response);
            });
            socket.receive(
                '{"type":"info","subtype":"all_breakpoints_deleted","id":"6DE62B9327DDEFEA"}\n\
                {"type":"error","code":2,"message":"Unknown JS Context."}\n');
            assert.equal(responses.length, 2);
            assert.equal(responses[0].type, 'info');
            assert.equal(responses[1].type, 'error');
        });

        test('in multiple chunks', () => {
            let responses: Response[] = [];

            transport.on('response', (response: Response) => {
                responses.push(response);
            });
            socket.receive('1/{"type":"info","subtype":"stacktr');
            socket.receive('ace","stacktrace":[{"url":"/home/bob/script.js","line":1');
            socket.receive('8,"rDepth":0}],"id":"857B3B96591A5163"}\n{"type":"error","code":2,"message":"Unknown');
            socket.receive(' JS Context."}\n');
            assert.equal(responses.length, 2);
            assert.equal(responses[0].type, 'info');
            assert.equal(responses[0].content.id, '857B3B96591A5163');
            assert.equal(responses[1].type, 'error');
            assert.equal(responses[1].content.message, 'Unknown JS Context.');
        });
    });
});

suite('protocol tests', () => {

    suite('serialize command', () => {
        test('pause', () => {
            let cmd = new Command('pause', 42);
            assert.equal(cmd.toString(), `42/{"name":"pause","type":"command","id":"${cmd.id}"}\n`);
        });

        test('next', () => {
            let cmd = new Command('next', 1);
            assert.equal(cmd.toString(), `1/{"name":"next","type":"command"}\n`);
        });

        test('get_all_source_urls', () => {
            let cmd = new Command('get_all_source_urls');
            assert.equal(cmd.toString(), `{"name":"get_all_source_urls","type":"command","id":"${cmd.id}"}\n`);
        });

        test('get_source', () => {
            let cmd = Command.getSource('fubar.js');
            assert.equal(cmd.toString(), `{"name":"get_source","type":"command","id":"${cmd.id}","url":"fubar.js"}\n`);
        });

        test('evaluate', () => {
            let cmd = Command.evaluate(42, {
                path: "toString",
                options: {
                    "show-hierarchy": true,
                    "evaluation-depth": 1
                }
            });

            assert.equal(cmd.toString(), `42/{"name":"evaluate","type":"command","id":"${cmd.id}","path":"toString","options":{"show-hierarchy":true,"evaluation-depth":1}}\n`);
        });

        suite('set_breakpoint', () => {

            test('with pending === false', () => {
                let cmd = Command.setBreakpoint('fubar.js', 17, false);
                assert.equal(cmd.toString(),
                    `{"name":"set_breakpoint","type":"command","id":"${cmd.id}",\
"breakpoint":{"line":17,"pending":false,"url":"fubar.js"}}\n`);
            });

            test('with pending === true', () => {
                let cmd = Command.setBreakpoint('script.js', 1);
                assert.equal(cmd.toString(),
                    `{"name":"set_breakpoint","type":"command","id":"${cmd.id}",\
"breakpoint":{"line":1,"pending":true,"url":"script.js"}}\n`);
            });
        });

        test('get_available_contexts', () => {
            let cmd = new Command('get_available_contexts');
            assert.equal(`get_available_contexts\n`, cmd.toString());
        });

        test('delete_all_breakpoints', () => {
            let cmd = new Command('delete_all_breakpoints');
            assert.equal(cmd.toString(), `{"name":"delete_all_breakpoints","type":"command","id":"${cmd.id}"}\n`);
        });

        test('exit', () => {
            let cmd = new Command('exit');
            assert.equal(cmd.toString(), `exit\n`);
        });

        test('get_variables', () => {
            let cmd = Command.getVariables(16, {
                depth: 0,
                options: {
                    'evaluation-depth': 1,
                    'show-hierarchy': true,
                },
            });
            assert.equal(cmd.toString(),
                `16/{"name":"get_variables","type":"command","id":"${cmd.id}",\
"query":{"depth":0,"options":{"evaluation-depth":1,"show-hierarchy":true}}}\n`);
        });

        suite('continue', () => {

            test('all contexts', () => {

                let cmd = new Command('continue');
                assert.equal(cmd.toString(), `{"type":"command","name":"continue"}\n`);
            });

            test('a single context', () => {
                let cmd = new Command('continue', 5);
                assert.equal(cmd.toString(), `5/{"name":"continue","type":"command","id":"${cmd.id}"}\n`);
            });
        });
    });

    suite('parse response', () => {

        suite('type: error', () => {

            test('NO_COMMAND_NAME', () => {
                const response =
                    '{"type":"error","code":2,"message":"Unknown JS Context."}\n';
                const result = parseResponse(response);
                assert.equal(result.type, 'error');
                assert.equal(result.content.message, 'Unknown JS Context.');
                assert.equal(result.content.code, ErrorCode.NO_COMMAND_NAME);
            });
        });

        suite('type: info', () => {

            test('contexts_list', () => {
                const response =
                    '{"type":"info","subtype":"contexts_list","contexts":\
[{"contextId":0,"contextName":"/home/bob/script.js","paused":true}]}\n';
                const result = parseResponse(response);
                assert.equal(result.type, 'info');
                assert.equal(result.subtype, 'contexts_list');
            });

            test('stacktrace', () => {
                const response =
                    '17/{"type":"info","subtype":"stacktrace","stacktrace":\
[{"url":"/home/bob/script.js","line":18,"rDepth":0}],"id":"857B3B96591A5163"}\n';
                const result = parseResponse(response);
                assert.equal(result.type, 'info');
                assert.equal(result.subtype, 'stacktrace');
                assert.equal(result.contextId, 17);
                assert.equal(result.content.id, '857B3B96591A5163');
            });

            test('variables', () => {
                const response =
                    '13/{"type":"info","subtype":"variables",\
"variables":[{"stackElement":{"url":"Some script","line":23,"rDepth":0},"variables":[\
{"name":"sleep","value":{"___jsrdbg_function_desc___":{"displayName":"sleep","name":"sleep",\
"parameterNames":["millis"]},"prototype":{"___jsrdbg_collapsed___":true},"length":1,"name":"sleep",\
"arguments":null,"caller":null}},\
{"name":"log","value":{"___jsrdbg_function_desc___":{"displayName":"log","name":"log",\
"parameterNames":["msg"]},"prototype":{"___jsrdbg_collapsed___":true},"length":1,"name":"log",\
"arguments":null,"caller":null}},\
{"name":"i","value":0},{"name":"arguments","value":{"length":0,"callee":{"___jsrdbg_collapsed___":true}}}]}],\
"id":"63DFE5D533FD5EB4"}\n';
                const result = parseResponse(response);
                assert.equal(result.type, 'info');
                assert.equal(result.subtype, 'variables');
                assert.equal(result.contextId, 13);
                assert.equal(result.content.variables.length, 1);
            });

            test('source_code', () => {
                const response =
                    '{"type":"info","subtype":"source_code","script":"fubar.js","source":\
["debugger;","var i = 42;"],"displacement":0,"id":"857B3B96591A5163"}';
                const result = parseResponse(response);
                assert.equal(result.type, 'info');
                assert.equal(result.subtype, 'source_code');
                assert.equal(result.contextId, undefined);
                assert.equal(result.content.script, 'fubar.js');
                assert.equal(result.content.source.length, 2);
                assert.equal(result.content.source[0], 'debugger;');
                assert.equal(result.content.source[1], 'var i = 42;');
            });

            test('evaluate', () => {
                const response = '{"type":"info","subtype":"evaluated","result":"666","id":"e07bc71f-4169-464a-9adf-f6c75d1643ca"}';
                const result = parseResponse(response);
                assert.equal(result.type, 'info');
                assert.equal(result.subtype, 'evaluated');
                assert.equal(result.content.result, '666');
                assert.equal(result.content.id, 'e07bc71f-4169-464a-9adf-f6c75d1643ca');
            });
        });
    });

    suite('variableValueToString', () => {

        test('value is undefined', () => {
            assert.equal(variableValueToString(
                '___jsrdbg_undefined___'),
                'undefined');
        });

        test('value is a number', () => {
            assert.equal(variableValueToString(
                '42'),
                '42');
        });

        test('value is an empty array', () => {
            assert.equal(variableValueToString(
                { length: 0, callee: { ___jsrdbg_collapsed___: true } }),
                'Array[0] []');
        });

        test('value is a function', () => {
            assert.equal(variableValueToString(
                {
                    ___jsrdbg_function_desc___: {
                        displayName: 'log',
                        name: 'log',
                        parameterNames: ['msg'],
                    },
                    arguments: null,
                    caller: null,
                    length: 1,
                    name: 'log',
                    prototype: {
                        ___jsrdbg_collapsed___: true,
                    },
                }),
                'function (msg) { … }');
        });
    });
});

suite('cantor algorithm tests', () => {

    test('pairing', () => {
        assert.equal(cantorPairing(47, 32), 3192);
    });

    test('reverse pairing', () => {
        let result = reverseCantorPairing(1432);
        assert.equal(result.x, 52);
        assert.equal(result.y, 1);
    });
});

suite('context coordinator coordinates requests and responses', () => {

    class MockConnection extends EventEmitter implements ConnectionLike {
        public sendRequest(request: Command, responseHandler?: (response: Response) => Promise<any>): Promise<any> {
            return Promise.resolve();
        }

        public handleResponse(response: Response): void {
            /* */
        }

        public disconnect(): Promise<void> {
            return Promise.resolve();
        }
    }

    let coordinator: ContextCoordinator;
    let mockConnection: MockConnection;
    let eventsEmitted: any[] = [];

    setup(() => {
        mockConnection = new MockConnection();
        coordinator = new ContextCoordinator(mockConnection);
        mockConnection.on('newContext', (contextId, contextName, stopped) => {
            eventsEmitted.push({ contextId, contextName, stopped });
        });
    });

    teardown(() => {
        eventsEmitted = [];
    });

    test('has no contexts after construction', () => {
        assert.equal(coordinator.getAllAvailableContexts().length, 0);
        assert.throws(() => { coordinator.getContext(23); }, 'No such context');
    });

    suite('a contexts_list response should...', () => {

        let response: Response = {
            content: {
                contexts: [{
                    contextId: 7,
                    contextName: 'seventh context',
                    paused: false,
                },
                {
                    contextId: 8,
                    contextName: 'eighth context',
                    paused: true,
                }],
            },
            subtype: 'contexts_list',
            type: 'info',
        };

        test('remember all contexts in the response', done => {
            coordinator.handleResponse(response).then(() => {
                let contexts = coordinator.getAllAvailableContexts();

                assert.equal(contexts.length, 2);
                assert.throws(() => { coordinator.getContext(23); }, 'No such context');

                let context = coordinator.getContext(7);
                assert.equal(context.id, 7);
                assert.equal(context.name, 'seventh context');
                assert.equal(context.isStopped(), false);

                context = coordinator.getContext(8);
                assert.equal(context.id, 8);
                assert.equal(context.name, 'eighth context');
                assert.equal(context.isStopped(), true);
                done();
            }).catch(err => done(err));
        });

        test('emit a newContext event as soon a new context is found', done => {
            coordinator.handleResponse(response).then(() => {
                assert.equal(eventsEmitted.length, 2);
                done();
            }).catch(err => done(err));
        });

        test('emit a newContext event only for unknown contexts', done => {

            coordinator.handleResponse(response).then(() => {

                // One more context got added
                let newResponse = response;
                newResponse.content.contexts.push({
                    contextId: 9,
                    contextName: 'ninth context',
                    paused: false,
                });

                eventsEmitted = []; // Reset events

                coordinator.handleResponse(newResponse).then(() => {
                    assert.equal(eventsEmitted.length, 1);
                    assert.equal(eventsEmitted[0].contextId, 9);
                    assert.equal(eventsEmitted[0].contextName, 'ninth context');
                    assert.equal(eventsEmitted[0].stopped, false);
                    done();
                }).catch(err => done(err));

            }).catch(err => done(err));
        });

        test('forget about contexts that no longer exist', done => {
            coordinator.handleResponse(response).then(() => {
                eventsEmitted = []; // Reset events

                // Context 7 got removed
                let newResponse: Response = {
                    content: {
                        contexts: [{
                            contextId: 8,
                            contextName: 'eighth context',
                            paused: true,
                        }],
                    },
                    subtype: 'contexts_list',
                    type: 'info',
                };

                coordinator.handleResponse(newResponse).then(() => {
                    assert.equal(eventsEmitted.length, 0);

                    let contexts = coordinator.getAllAvailableContexts();
                    assert.equal(contexts.length, 1);
                    assert.throws(() => { coordinator.getContext(7); }, 'No such context'); // 7 got removed
                    assert.equal(8, coordinator.getContext(8).id); // 8 is still in there
                    done();
                }).catch(err => done(err));

            }).catch(err => done(err));
        });
    });
});
