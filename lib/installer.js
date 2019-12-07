"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load tempDirectory before it gets wiped by tool-cache
let tempDirectory = process.env['RUNNER_TEMPDIRECTORY'] || '';
const core = __importStar(require("@actions/core"));
const tc = __importStar(require("@actions/tool-cache"));
const restm = __importStar(require("typed-rest-client/RestClient"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const semver = __importStar(require("semver"));
let osPlat = os.platform();
let osArch = os.arch();
if (!tempDirectory) {
    let baseLocation;
    if (process.platform === 'win32') {
        // On windows use the USERPROFILE env variable
        baseLocation = process.env['USERPROFILE'] || 'C:\\';
    }
    else {
        if (process.platform === 'darwin') {
            baseLocation = '/Users';
        }
        else {
            baseLocation = '/home';
        }
    }
    tempDirectory = path.join(baseLocation, 'actions', 'temp');
}
function getKustomize(versionSpec) {
    return __awaiter(this, void 0, void 0, function* () {
        // check cache
        let toolPath;
        toolPath = tc.find('kustomize', versionSpec);
        // If not found in cache, download
        if (!toolPath) {
            let version;
            const c = semver.clean(versionSpec) || '';
            // If explicit version
            if (semver.valid(c) != null) {
                // version to download
                version = versionSpec;
            }
            else {
                // query kustomize for a matching version
                version = yield queryLatestMatch(versionSpec);
                if (!version) {
                    throw new Error(`Unable to find Kustomize version '${versionSpec}' for platform ${osPlat} and architecture ${osArch}.`);
                }
                // check cache
                toolPath = tc.find('kustomize', version);
            }
            if (!toolPath) {
                // download, extract, cache
                toolPath = yield acquireKustomize(version);
            }
        }
        core.addPath(toolPath);
    });
}
exports.getKustomize = getKustomize;
function queryLatestMatch(versionSpec) {
    return __awaiter(this, void 0, void 0, function* () {
        let dataFileName;
        switch (osPlat) {
            case 'linux':
            case 'darwin':
            case 'win32':
                dataFileName = osPlat;
                break;
            default:
                throw new Error(`Unexpected OS '${osPlat}'`);
        }
        switch (osArch) {
            case 'x64':
                dataFileName = `${dataFileName}_amd64`;
                break;
            default:
                dataFileName = `${dataFileName}_${osArch}`;
        }
        let versions = [];
        let dataUrl = 'https://api.github.com/repos/kubernetes-sigs/kustomize/releases';
        let rest = new restm.RestClient('setup-kustomize');
        let kustomizeVersions = (yield rest.get(dataUrl)).result || [];
        kustomizeVersions.forEach((kustomizeVersion) => {
            if (kustomizeVersion.assets.some(asset => asset.name.includes(dataFileName))) {
                let version = semver.clean(kustomizeVersion.name);
                if (version != null) {
                    versions.push(version);
                }
            }
        });
        return evaluateVersions(versions, versionSpec);
    });
}
function evaluateVersions(versions, versionSpec) {
    let version = '';
    core.debug(`evaluating ${versions.length} versions`);
    versions = versions.sort((a, b) => {
        if (semver.gt(a, b)) {
            return 1;
        }
        return -1;
    });
    for (let i = versions.length - 1; i >= 0; i--) {
        const potential = versions[i];
        const satisfied = semver.satisfies(potential, versionSpec);
        if (satisfied) {
            version = potential;
            break;
        }
    }
    if (version) {
        core.debug(`matched: ${version}`);
    }
    else {
        core.debug('match not found');
    }
    return version;
}
function acquireKustomize(version) {
    return __awaiter(this, void 0, void 0, function* () {
        version = semver.clean(version) || '';
        let downloadUrl;
        let toolPath;
        let toolFilename = "kustomize";
        let toolName = "kustomize";
        if (osPlat == "win32") {
            toolFilename = `${toolFilename}.exe`;
        }
        if (semver.gte(version, "3.3.0")) {
            downloadUrl = `https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize/v${version}/kustomize_v${version}_%{os}_%{arch}.tar.gz`;
        }
        else if (semver.gte(version, "3.2.1")) {
            downloadUrl = `https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize/v${version}/kustomize_kustomize.v${version}_%{os}_%{arch}`;
        }
        else {
            downloadUrl = `https://github.com/kubernetes-sigs/kustomize/releases/download/v${version}/kustomize_${version}_%{os}_%{arch}`;
        }
        switch (osPlat) {
            case 'win32':
                if (semver.lte(version, "3.2.1"))
                    throw new Error(`Unexpected OS '${osPlat}'`);
                downloadUrl = downloadUrl.replace('%{os}', 'windows');
                if (semver.lt(version, "3.3.0"))
                    downloadUrl = `${downloadUrl}.exe`;
                break;
            case 'linux':
            case 'darwin':
                downloadUrl = downloadUrl.replace('%{os}', osPlat);
                break;
            default:
                throw new Error(`Unexpected OS '${osPlat}'`);
        }
        switch (osArch) {
            case 'x64':
                downloadUrl = downloadUrl.replace('%{arch}', 'amd64');
                break;
            default:
                throw new Error(`Unexpected Arch '${osArch}'`);
        }
        try {
            toolPath = yield tc.downloadTool(downloadUrl);
        }
        catch (err) {
            core.debug(err);
            throw `Failed to download version ${version}: ${err}`;
        }
        if (downloadUrl.endsWith('.tar.gz')) {
            toolPath = yield tc.extractTar(toolPath);
            toolPath = path.join(toolPath, toolFilename);
        }
        return yield tc.cacheFile(toolPath, toolFilename, toolName, version);
    });
}
