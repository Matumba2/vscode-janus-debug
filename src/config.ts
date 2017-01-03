'use strict';

import { DebugProtocol } from 'vscode-debugprotocol';
import { LogConfiguration } from './log';

export interface CommonArguments {
    /** The debug port to attach to. */
    port: number;
    /** The IP address of the host where the application runs on. */
    host: string;
    /** Lets you configure diagnostic logging of the debug adapter. */
    log: LogConfiguration;
    /** Time in ms until we give up trying to connect. */
    timeout: number;
}

export interface AttachRequestArguments extends DebugProtocol.AttachRequestArguments,
    CommonArguments { 
    /** The local source file to debug (specified by the user) */
    sourceFile: string;
}

export interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments,
    CommonArguments {
    /** Automatically stop target after launching. If not specified, target does not stop. */
    stopOnEntry?: boolean;
}
