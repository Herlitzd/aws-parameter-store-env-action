"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const fs_1 = require("fs");
const fs_2 = require("fs");
const aws = __importStar(require("aws-sdk"));
const path = __importStar(require("path"));
const process = __importStar(require("process"));
const run = () => __awaiter(void 0, void 0, void 0, function* () {
    const paramBasePath = core.getInput('PARAMS_ROOT');
    const mappingFilePath = core.getInput('MAPPING_FILE', { required: true });
    const mappingFile = path.join(process.env['GITHUB_WORKSPACE'] || '', mappingFilePath);
    yield fs_1.promises.access(mappingFile, fs_2.constants.R_OK)
        .then(() => __awaiter(void 0, void 0, void 0, function* () {
        const mapping = yield loadFile(mappingFile);
        return mapping;
    }), () => {
        throw { message: `Failed to locate or read file at ${mappingFile}` };
    })
        .then((mappings => {
        const systemManager = new aws.SSM();
        const fullPathMap = createFullPathMap(paramBasePath, mappings);
        systemManager.getParametersByPath({
            Path: paramBasePath
        }, handleParameterResponse(fullPathMap));
    }));
});
const handleParameterResponse = (fullPathMap) => (error, data) => {
    if (error) {
        throw { message: 'failed to load parameter store values', error };
    }
    if (data.Parameters) {
        const valueMap = data.Parameters.filter(p => p.Name && p.Value).map(p => ({
            envVar: fullPathMap[p.Name || '__unmapped_key'],
            value: p.Value || '__unmapped_value'
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
        prev[path.join(basePath, curr.path)] = curr.envVar;
        return prev;
    }, {});
};
const setEnvironmentVariables = (values) => __awaiter(void 0, void 0, void 0, function* () {
    const vars = values.reduce((prev, { envVar, value }) => {
        return prev + `${envVar}=${value}\n`;
    }, "");
    const githubVarFile = process.env['GITHUB_ENV'];
    if (githubVarFile) {
        yield fs_1.promises.appendFile(githubVarFile, vars);
    }
    else {
        throw { message: 'cannot find github action environment file not specified as "GITHUB_ENV"  ' };
    }
});
const loadFile = (mappingFile) => __awaiter(void 0, void 0, void 0, function* () {
    const contents = yield fs_1.promises.readFile(mappingFile, 'utf-8');
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
try {
    run();
}
catch (error) {
    core.debug(JSON.stringify(error));
    core.setFailed(error.message);
}
//# sourceMappingURL=index.js.map