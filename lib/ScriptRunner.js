"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const path = __importStar(require("path"));
const FileUtils_1 = __importDefault(require("./Utilities/FileUtils"));
const PowerShellToolRunner_1 = __importDefault(require("./Utilities/PowerShellToolRunner"));
class ScriptRunner {
    constructor(inlineScript, inputFile, errorActionPreference, failOnStandardErr) {
        this.isRunningInlineScript = false;
        this.inlineScript = inlineScript;
        this.inputFile = inputFile;
        this.errorActionPreference = errorActionPreference;
        this.failOnStandardErr = failOnStandardErr;
    }
    executeFile() {
        return __awaiter(this, void 0, void 0, function* () {
            const error = [];
            const options = {
                listeners: {
                    stderr: (data) => {
                        if (error.length < 10) {
                            // Truncate to at most 1000 bytes
                            if (data.length > 1000) {
                                error.push(`${data.toString('utf8', 0, 1000)}<truncated>`);
                            }
                            else {
                                error.push(data.toString('utf8'));
                            }
                        }
                        else if (error.length === 10) {
                            error.push('Additional writes to stderr truncated');
                        }
                    }
                }
            };
            let filePath;
            try {
                filePath = yield this.getScriptFile(this.inlineScript, this.inputFile);
                core.debug(`script file to run: ${filePath}`);
                let runnerScript = this.getRunnerScript(filePath, this.errorActionPreference);
                yield PowerShellToolRunner_1.default.init();
                const exitCode = yield PowerShellToolRunner_1.default.executePowerShellScriptBlock(runnerScript, options);
                if (exitCode !== 0) {
                    core.setOutput(`Azure PowerShell exited with code:`, exitCode.toString());
                    if (this.failOnStandardErr) {
                        error.forEach((err) => {
                            core.error(err);
                        });
                        throw new Error(`Standard error stream contains one or more lines`);
                    }
                }
            }
            finally {
                if (filePath && this.isRunningInlineScript) {
                    FileUtils_1.default.deleteFile(filePath);
                }
            }
        });
    }
    getScriptFile(inlineScript, inputFile) {
        if (inlineScript && inlineScript.trim()) {
            this.isRunningInlineScript = true;
            return FileUtils_1.default.createScriptFile(this.inlineScript);
        }
        else {
            if (inputFile && inputFile.trim()) {
                this.isRunningInlineScript = false;
                return path.join(process.env.GITHUB_WORKSPACE, inputFile);
                ;
            }
            else {
                throw new Error(`inlineScript and inputFile are both empty. Please enter a valid script or a valid input file.`);
            }
        }
    }
    getRunnerScript(filePath, errorActionPreference) {
        return `
        $ErrorActionPreference = '${errorActionPreference}'
        ${filePath}
        `;
    }
}
exports.default = ScriptRunner;
