import * as core from '@actions/core';
import * as crypto from 'crypto';
import Utils from './Utilities/Utils';
import FileUtils from './Utilities/FileUtils';
import ScriptRunner from './ScriptRunner';
import InitializeAzure from './InitializeAzure';
import { AzModuleInstaller } from './AzModuleInstaller';

const errorActionPrefValues = new Set(['STOP', 'CONTINUE', 'SILENTLYCONTINUE']);
let azPSVersion: string;

let userAgentPrefix = !!process.env.AZURE_HTTP_USER_AGENT ? `${process.env.AZURE_HTTP_USER_AGENT}` : "";

async function main() {
    try {
        // Set user agent variable
        // console.log(`process.env: ${process.env}`);
        console.log(`__dirname: ${__dirname}`);
        console.log(`__filename : ${__filename}`);
        const envs = JSON.stringify(process.env, undefined, 3)
        console.log(`process.env: ${envs}`);
        let usrAgentRepo = crypto.createHash('sha256').update(`${process.env.GITHUB_REPOSITORY}`).digest('hex');
        let actionName = 'AzurePowerShellAction';
        let userAgentString = (!!userAgentPrefix ? `${userAgentPrefix}+` : '') + `GITHUBACTIONS_${actionName}_${usrAgentRepo}`;
        core.exportVariable('AZURE_HTTP_USER_AGENT', userAgentString);

        // const inlineScript: string = core.getInput('inlineScript', { required: true });
        const inputFile: string = core.getInput('inputFile', { required: true });
        azPSVersion = core.getInput('azPSVersion', { required: true }).trim().toLowerCase();
        const errorActionPreference: string = core.getInput('errorActionPreference');
        const failOnStandardError = core.getInput('failOnStandardError').trim().toLowerCase() === "true";
        const githubToken = core.getInput('githubToken');
        console.log(`Validating inputs`);
        // validateInputs(inlineScript, errorActionPreference);

        const githubAuth = !githubToken || Utils.isGhes() ? undefined : `token ${githubToken}`;
        const installResult = await new AzModuleInstaller(azPSVersion, githubAuth).install();
        console.log(`Module Az ${azPSVersion} installed from ${installResult.moduleSource}`);

        console.log(`Initializing Az Module`);
        await InitializeAzure.importAzModule(azPSVersion);
        console.log(`Initializing Az Module Complete`);

        console.log(`Running Az PowerShell Script`);
        const scriptRunner: ScriptRunner = new ScriptRunner(inputFile, errorActionPreference, failOnStandardError);
        await scriptRunner.executeFile();
        console.log(`Script execution Complete`);
    } catch(error) {
        core.setFailed(error);
    } finally {
        FileUtils.deleteFile(ScriptRunner.filePath);
        // Reset AZURE_HTTP_USER_AGENT
        core.exportVariable('AZURE_HTTP_USER_AGENT', userAgentPrefix);
    }
}

function validateInputs(inlineScript: string, errorActionPreference: string) {
    if (!inlineScript.trim()) {
        throw new Error(`inlineScript is empty. Please enter a valid script.`);
    }
    if (azPSVersion !== "latest") {
        if (!Utils.isValidVersion(azPSVersion)) {
            console.log(`Invalid azPSVersion : ${azPSVersion}. Using latest Az Module version.`);
            azPSVersion = 'latest';
        }
    }
    validateErrorActionPref(errorActionPreference);
}

function validateErrorActionPref(errorActionPreference: string) {
    if(!(errorActionPrefValues.has(errorActionPreference.toUpperCase()))) {
        throw new Error(`Invalid errorActionPreference: ${errorActionPreference}`);
    }
}

main()