"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
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
        if (osPlat != 'win32') {
            toolPath = path.join(toolPath, 'bin');
        }
        //
        // prepend the tools path. instructs the agent to prepend for future tasks
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
                versions.push(kustomizeVersion.tag_name);
            }
        });
        // get the latest version that matches the version spec
        let version = evaluateVersions(versions, versionSpec);
        return version;
    });
}
// TODO - should we just export this from @actions/tool-cache? Lifted directly from there
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

        let fileName = `kustomize_${version}`;

        switch (osPlat) {
            case 'linux':
            case 'darwin':
            case 'win32':
                fileName = `${fileName}_${osPlat}`;
                break;
            default:
                throw new Error(`Unexpected OS '${osPlat}'`);
        }

        switch (osArch) {
            case 'x64':
                fileName = `${fileName}_amd64`;
                break;
            default:
                fileName = `${fileName}_${osArch}`;
        }

        let downloadUrl = `https://github.com/kubernetes-sigs/kustomize/releases/download/v${version}/${fileName}`;
        core.debug(downloadUrl);
        let downloadPath;
        try {
            downloadPath = yield tc.downloadTool(downloadUrl);
        }
        catch (err) {
            core.debug(err);
            throw `Failed to download version ${version}: ${err}`;
        }
        let toolRoot = path.join(downloadPath, fileName);
        return yield tc.cacheDir(toolRoot, 'kustomize', version);
    });
}
