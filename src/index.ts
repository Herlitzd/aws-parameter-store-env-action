import * as core from "@actions/core"
import { promises as fs } from "fs";
import { constants as fsConstants } from "fs";
import * as aws from "aws-sdk";
import * as  path from "path";
import * as process from "process";


interface Mapping {
  path: string;
  envVar: string;
}

interface MappedValue {
  envVar: string;
  value: string;
}

const run = async () => {
  const paramBasePath = core.getInput('params-root');

  const mappingFilePath = core.getInput('mapping-file', { required: true });

  const mappingFile = path.join(process.env['GITHUB_WORKSPACE'] || '', mappingFilePath);
  const mappings = await loadFile(mappingFile);

  const systemManager = new aws.SSM();
  const fullPathMap = createFullPathMap(paramBasePath, mappings);
  systemManager.getParametersByPath({
    Path: paramBasePath
  }, handleParameterResponse(fullPathMap))

}

const handleParameterResponse = (fullPathMap: Record<string, string>) =>
  (error: aws.AWSError, data: aws.SSM.Types.GetParametersByPathResult) => {

    if (error) {
      throw { message: 'failed to load parameter store values', error }
    }
    if (data.Parameters) {
      const valueMap: MappedValue[] = data.Parameters.filter(p => p.Name && p.Value).map(p => (
        {
          envVar: fullPathMap[p.Name || '__unmapped_key'], // The filter handles these cases
          value: p.Value || '__unmapped_value'
        }
      ));
      setEnvironmentVariables(valueMap)
        .then(() => {
          const mappedCorrectly = valueMap.map(x => x.envVar);
          core.info("Environment variables set:\n" + mappedCorrectly.join('\n'));

          const notMapped = Object.values(fullPathMap).filter(x => !mappedCorrectly.includes(x));
          if (notMapped.length) {
            core.warning("Parameters expected, but not found:\n" + notMapped.join('\n'));
          }
        });
    }
  }

const createFullPathMap = (basePath: string, mappings: Mapping[]) => {
  return mappings.reduce((prev, curr) => {
    prev[path.join(basePath, curr.path)] = curr.envVar;
    return prev;
  }, {} as Record<string, string>);
}

const setEnvironmentVariables = async (values: MappedValue[]) => {
  const vars = values.reduce((prev, { envVar, value }) => {
    return prev + `${envVar}=${value}\n`
  }, "");

  const githubVarFile = process.env['GITHUB_ENV'];
  if (githubVarFile) {
    await fs.appendFile(githubVarFile, vars)
  } else {
    throw { message: 'cannot find github action environment file not specified as "GITHUB_ENV"  ' }
  }
}

const loadFile = async (mappingFile: string): Promise<Mapping[]> => {

  await fs.access(mappingFile, fsConstants.R_OK)
    .catch(e => { throw { message: `Failed to locate or read file at ${mappingFile}`, error: e } });

  const contents = await fs.readFile(mappingFile, 'utf-8');
  const parsed = JSON.parse(contents);
  if (typeof parsed === "object") {
    const entries = Object.entries(parsed);
    if (entries.some(([k, v]) => typeof (k) === "string" || typeof (v) === "string")) {
      return entries.map(([k, v]) => ({
        path: v as string,
        envVar: k
      }));
    }
  }

  throw { message: 'file format invalid, expected a string to string mapping' }
}


try {
  run();
} catch (error) {
  core.debug(JSON.stringify(error));
  core.setFailed(error.message);
}