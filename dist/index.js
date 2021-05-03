var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as core from "@actions/core";
import * as fs from "fs/promises";
import { constants as fsConstants } from "fs";
import * as aws from "aws-sdk";
import * as path from "path";
const defaultMappingFile = `${process.env['GITHUB_WORKSPACE']}/.github/aws-parameter-map.json`;
const run = () => __awaiter(this, void 0, void 0, function* () {
    try {
        const paramBasePath = core.getInput('params-root');
        const mappingFilePathOverride = core.getInput('mapping-file');
        const mappingFile = mappingFilePathOverride || defaultMappingFile;
        yield fs.access(mappingFile, fsConstants.R_OK)
            .then(() => {
            const mapping = loadFile(mappingFile);
            return mapping;
        }, () => {
            throw { message: `Failed to locate or read file at ${mappingFile}` };
        })
            .then((mappings => {
            const systemManager = new aws.SSM();
            const fullPathMap = createFullPathMap(paramBasePath, mappings);
            systemManager.getParametersByPath({
                Path: paramBasePath,
                ParameterFilters: [{
                        Key: "Name",
                        Values: mappings.map(m => m.path)
                    }]
            }, handleResponse(fullPathMap));
        }));
    }
    catch (error) {
        core.setFailed(error.message);
    }
});
const handleResponse = (fullPathMap) => (error, data) => {
    if (error) {
        throw { message: 'failed to load parameter store values', error };
    }
    if (data.Parameters) {
        const valueMap = data.Parameters.filter(p => p.Name && p.Value).map(p => ({
            envVar: fullPathMap[p.Name],
            value: p.Value
        }));
        setEnvironmentVariables(valueMap)
            .then(() => {
            const mappedCorrectly = valueMap.map(x => x.envVar);
            core.info("Environment variables set:\n" + mappedCorrectly.join('\n'));
            const notMapped = Object.values(fullPathMap).filter(x => !mappedCorrectly.includes(x));
            core.warning("Parameters expected, but not found: \n" + notMapped.join('\n'));
        });
    }
};
const createFullPathMap = (basePath, mappings) => {
    return mappings.reduce((prev, curr) => {
        return prev[path.join(`${basePath}${curr.path}`)] = curr.envVar;
    }, {});
};
const setEnvironmentVariables = (values) => __awaiter(this, void 0, void 0, function* () {
    const vars = values.reduce((prev, { envVar, value }) => {
        return prev + `${envVar}=${value}\n`;
    }, "");
    yield fs.appendFile(process.env['$GITHUB_ENV'], vars);
});
const loadFile = (mappingFile) => __awaiter(this, void 0, void 0, function* () {
    const contents = yield fs.readFile(mappingFile, 'utf-8');
    const parsed = JSON.parse(contents);
    if (typeof parsed === "object") {
        const entries = Object.entries(parsed);
        if (entries.some(([k, v]) => typeof (k) === "string" || typeof (v) === "string")) {
            return entries.map(([k, v]) => ({
                path: v,
                envVar: k
            }));
        }
    }
    throw { message: 'file format invalid, expected a string to string mapping' };
});
