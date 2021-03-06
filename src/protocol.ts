'use strict';

import * as assert from 'assert';
import * as uuid from 'uuid';

export enum ErrorCode {
    UNKNOWN_COMMAND = 1,
    NO_COMMAND_NAME = 2,
    NOT_A_COMMAND_PACKAGE = 3,
    NOT_PAUSED = 4,
    BAD_ARGS = 5,
    SCRIPT_NOT_FOUND = 6,
    CANNOT_SET_BREAKPOINT = 8,
    IS_PAUSED = 9,
    UNEXPECTED_EXC = 10,
    EVALUATION_FAILED = 11,
    PC_NOT_AVAILABLE = 12,
    NO_ACTIVE_FRAME = 13,
}

export type CommandName =
    'pc' |
    'step' |
    'next' |
    'continue' |
    'source_code' |
    'delete_all_breakpoints' |
    'pause' |
    'set_breakpoint' |
    'get_stacktrace' |
    'get_variables' |
    'evaluate' |
    'get_all_source_urls' |
    'get_breakpoints' |
    'get_available_contexts' |
    'exit';

export type ResponseType = 'info' | 'error';

export type ResponseSubType =
    'pc' |
    'source_code' |
    'all_breakpoints_deleted' |
    'breakpoint_set' |
    'breakpoint_deleted' |
    'stacktrace' |
    'variables' |
    'evaluated' |
    'all_source_urls' |
    'breakpoints_list' |
    'contexts_list';

export interface Response {
    /** Tyep of the response: 'info' for normal responses, 'error' for errors. */
    type: ResponseType;
    /** Actual content of a response. */
    content: any;
    /** Name of the response. */
    subtype?: ResponseSubType;
    /** Optional numerical identifier of the JSContext in question. */
    contextId?: number;
}

export interface Breakpoint {
    bid: number;
    url: string;
    line: number;
    pending: boolean;
}

export interface StackFrame {
    url: string;
    line: number;
    rDepth: number;
}

export interface Variable {
    name: string;
    value: any;
}

export function parseResponse(responseString: string): Response {
    let contextId: number | undefined = undefined;
    let indexStart = 0;
    const match = responseString.match(/^([0-9]+)\/{/);
    if (match) {
        contextId = Number.parseInt(match[1]);
        assert.ok(!Number.isNaN(contextId), 'could not parse context id');
        indexStart = match[0].length - 1;
    }
    let obj = JSON.parse(responseString.substring(indexStart));
    let response: Response = {
        type: obj.type,
        content: {}
    };
    delete obj.type;
    if (contextId !== undefined) {
        response['contextId'] = contextId;
    }
    if (obj.subtype) {
        response['subtype'] = obj.subtype;
        delete obj.subtype;
    }
    response.content = obj;
    return response;
}

export class Command {
    private payload: any;
    private contextId: number | undefined;

    public get name(): CommandName { return this.payload.name; }
    public get type(): string { return this.payload.type; }
    public get id(): string { return this.payload.id; }

    constructor(name: CommandName, contextId?: number) {
        this.payload = {
            name: name,
            type: 'command',
        };
        this.contextId = contextId;

        // Only commands that expect a response need an id. For example, 'exit' does not entail a
        // response from the server so we do not need to generate a UUID v4 for this command.

        let needsId = true;
        const exceptions = [
            () => { return name === 'get_available_contexts'; },
            () => { return name === 'exit'; },
            () => { return name === 'continue' && contextId === undefined; },
            () => { return name === 'next'; }
        ];
        for (var i = 0; i < exceptions.length; i++) {
            needsId = !exceptions[i]();
        }
        if (needsId) {
            this.payload['id'] = uuid.v4();
        }
    }

    public append(options: Object) {
        this.payload = {
            ...this.payload,
            ...options
        };
    }

    public toString(): string {
        if (this.name === 'get_available_contexts') {
            return 'get_available_contexts\n';
        }
        if (this.name === 'exit') {
            return 'exit\n';
        }
        if ((this.name === 'continue') && !this.contextId) {
            return '{"type":"command","name":"continue"}\n';
        }
        if (this.contextId) {
            return `${this.contextId}/${JSON.stringify(this.payload)}\n`;
        }
        return `${JSON.stringify(this.payload)}\n`;
    }

    public static setBreakpoint(url: string, lineNumber: number, pending?: boolean): Command {
        let cmd = new Command('set_breakpoint');
        cmd.payload['breakpoint'] = {
            url: url,
            line: lineNumber,
            pending: pending === undefined ? true : pending
        };
        return cmd;
    }
}