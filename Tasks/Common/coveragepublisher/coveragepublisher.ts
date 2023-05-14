
import * as toolRunner from 'azure-pipelines-task-lib/toolrunner';
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as UUID from 'uuid/v4';

export async function PublishCodeCoverage(inputFiles: string[], sourceDirectory?: string) {
    var reportDirectory = path.join(getTempFolder(), UUID());
    fs.mkdirSync(reportDirectory);
    publishCoverage(inputFiles, reportDirectory, sourceDirectory)
}

async function publishCoverage(inputFiles: string[], reportDirectory: string, pathToSources?: string) {

    if(!inputFiles || inputFiles.length == 0) {
        taskLib.setResult(taskLib.TaskResult.Failed, taskLib.loc("NoInputFiles"));
        return;
    }

    const osvar = process.platform;
    let dotnet: toolRunner.ToolRunner;

    const dotnetPath = taskLib.which('dotnet', false);
    if (!dotnetPath && osvar !== 'win32') {
        taskLib.warning(taskLib.loc('InstallDotNetCoreForPublishing'));
        return false;
    }

    // use full .NET to execute
    dotnet = taskLib.tool(path.join(__dirname, 'CoveragePublisher', 'CoveragePublisher.Console.exe'));
    
    dotnet.arg('"' + inputFiles.join('" "') + '"');
    dotnet.arg('--reportDirectory ' + reportDirectory);

    if(!isNullOrWhitespace(pathToSources)) {
        dotnet.arg('--sourceDirectory ' + pathToSources);
    }

    try {
        const env = {
            "SYSTEM_ACCESSTOKEN": taskLib.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false),
            "SYSTEM_TEAMFOUNDATIONCOLLECTIONURI": taskLib.getVariable('System.TeamFoundationCollectionUri'),
            "BUILD_BUILDID": taskLib.getVariable('Build.BuildId'),
            "BUILD_CONTAINERID": taskLib.getVariable('Build.ContainerId'),
            "AGENT_TEMPPATH": taskLib.getVariable('Agent.TempPath'),
            "SYSTEM_TEAMPROJECTID": taskLib.getVariable('System.TeamProjectId'),
            "PIPELINES_COVERAGEPUBLISHER_DEBUG": taskLib.getVariable('PIPELINES_COVERAGEPUBLISHER_DEBUG')
        };

        await dotnet.exec({
            env,
            ignoreReturnCode: false,
            failOnStdErr: true,
            windowsVerbatimArguments: true,
            errStream: {
                write: (data: Buffer) => {
                    console.error(data.toString());
                    taskLib.setResult(taskLib.TaskResult.Failed, undefined);
                }
            },
        } as any);

    } catch (err) {
        // Logging should be handled thorugh error stream
    }
}


function isNullOrWhitespace(input: any) {
    if (typeof input === 'undefined' || input == null) {
        return true;
    }
    return input.replace(/\s/g, '').length < 1;
}

function getTempFolder(): string {
    try {
        taskLib.assertAgent('2.115.0');
        const tmpDir = taskLib.getVariable('Agent.TempDirectory');
        return tmpDir;
    } catch (err) {
        taskLib.warning(taskLib.loc('UpgradeAgentMessage'));
        return os.tmpdir();
    }
}
