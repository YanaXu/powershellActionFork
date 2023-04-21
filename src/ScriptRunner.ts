import * as core from '@actions/core';
import * as os from 'os';
import * as path from 'path';

import FileUtils from "./Utilities/FileUtils";
import PowerShellToolRunner from "./Utilities/PowerShellToolRunner";
import ScriptBuilder from './Utilities/ScriptBuilder';

export default class ScriptRunner {
    static filePath: string;
    inputFile: string;
    errorActionPreference: string;
    failOnStandardErr: boolean;

    constructor(inputFile: string, errorActionPreference: string, failOnStandardErr:boolean) {
        this.inputFile = inputFile;
        this.errorActionPreference = errorActionPreference;
        this.failOnStandardErr = failOnStandardErr;
    }

    async executeFile() {
        const error: string[] = [];
        const options: any = {
            listeners: {
                stderr: (data: Buffer) => {
                    if (error.length < 10) {
                        // Truncate to at most 1000 bytes
                        if (data.length > 1000) {
                            error.push(`${data.toString('utf8', 0, 1000)}<truncated>`);
                        } else {
                            error.push(data.toString('utf8'));
                        }
                    } else if (error.length === 10) {
                        error.push('Additional writes to stderr truncated');
                    }
                }
            }
        };
        // const scriptToExecute: string = new ScriptBuilder().getInlineScriptFile(
        //     this.inlineScript, this.errorActionPreference);
        // ScriptRunner.filePath = await FileUtils.createScriptFile(scriptToExecute);
        
        ScriptRunner.filePath = path.join(process.env.GITHUB_WORKSPACE, this.inputFile);
        core.info(`script file to run: ${ScriptRunner.filePath}`);
        let checkFile = FileUtils.pathExists(ScriptRunner.filePath);
        core.info(`checkFile: ${checkFile}`);
        FileUtils.makeExecutable(ScriptRunner.filePath);
        await PowerShellToolRunner.init();
        const exitCode: number = await PowerShellToolRunner.executePowerShellScriptBlock(ScriptRunner.filePath, options);
        if (exitCode !== 0) {
            core.setOutput(`Azure PowerShell exited with code:`, exitCode.toString());
            if (this.failOnStandardErr) {
                error.forEach((err: string) => {
                    core.error(err);
                });
                throw new Error(`Standard error stream contains one or more lines`);
            }
        }
    }
}