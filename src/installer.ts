// Load tempDirectory before it gets wiped by tool-cache
let tempDirectory = process.env['RUNNER_TEMPDIRECTORY'] || '';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as restm from 'typed-rest-client/RestClient';
import * as os from 'os';
import * as path from 'path';
import * as semver from 'semver';
import * as fs from 'fs';

let osPlat: string = os.platform();
let osArch: string = os.arch();

if (!tempDirectory) {
  let baseLocation;
  if (process.platform === 'win32') {
    // On windows use the USERPROFILE env variable
    baseLocation = process.env['USERPROFILE'] || 'C:\\';
  } else {
    if (process.platform === 'darwin') {
      baseLocation = '/Users';
    } else {
      baseLocation = '/home';
    }
  }
  tempDirectory = path.join(baseLocation, 'actions', 'temp');
}

export async function getKustomize(versionSpec: string) {
  // check cache
  let toolPath: string;

  toolPath = tc.find('kustomize', versionSpec);

  // If not found in cache, download
  if (!toolPath) {
    let version: string;
    const c = semver.clean(versionSpec) || '';
    // If explicit version
    if (semver.valid(c) != null) {
      // version to download
      version = versionSpec;
    } else {
      // query kustomize for a matching version
      version = await queryLatestMatch(versionSpec);
      if (!version) {
        throw new Error(
          `Unable to find Kustomize version '${versionSpec}' for platform ${osPlat} and architecture ${osArch}.`
        );
      }

      // check cache
      toolPath = tc.find('kustomize', version);
    }

    if (!toolPath) {
      // download, extract, cache
      toolPath = await acquireKustomize(version);
    }
  }

  core.addPath(toolPath);
}

interface IAsset {
  browser_download_url: string;
  name: string;
}

interface IKustomizeVersion {
  name: string;
  assets: IAsset[];
}

async function queryLatestMatch(versionSpec: string): Promise<string> {
  let dataFileName: string;

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

  let versions: string[] = [];
  let dataUrl = 'https://api.github.com/repos/kubernetes-sigs/kustomize/releases';
  let rest: restm.RestClient = new restm.RestClient('setup-kustomize');
  let kustomizeVersions: IKustomizeVersion[] = (await rest.get<IKustomizeVersion[]>(dataUrl)).result || [];
  kustomizeVersions.forEach((kustomizeVersion: IKustomizeVersion) => {
    if (kustomizeVersion.assets.some(asset => asset.name.includes(dataFileName))) {
      versions.push(kustomizeVersion.name);
    }
  });

  // get the latest version that matches the version spec
  let version: string = evaluateVersions(versions, versionSpec);
  return version;
}

// TODO - should we just export this from @actions/tool-cache? Lifted directly from there
function evaluateVersions(versions: string[], versionSpec: string): string {
  let version = '';
  core.debug(`evaluating ${versions.length} versions`);
  versions = versions.sort((a, b) => {
    if (semver.gt(a, b)) {
      return 1;
    }
    return -1;
  });
  for (let i = versions.length - 1; i >= 0; i--) {
    const potential: string = versions[i];
    const satisfied: boolean = semver.satisfies(potential, versionSpec);
    if (satisfied) {
      version = potential;
      break;
    }
  }

  if (version) {
    core.debug(`matched: ${version}`);
  } else {
    core.debug('match not found');
  }

  return version;
}

async function acquireKustomize(version: string): Promise<string> {
  version = semver.clean(version) || '';

  let fileName: string = `kustomize_${version}`

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

  let downloadUrl = `https://github.com/kubernetes-sigs/kustomize/releases/download/v${version}/${fileName}`
  let downloadPath: string;

  try {
    downloadPath = await tc.downloadTool(downloadUrl);
  } catch (err) {
    core.debug(err);

    throw `Failed to download version ${version}: ${err}`;
  }

  fs.chmodSync(downloadPath, 0o755);

  return await tc.cacheFile(downloadPath, 'kustomize', 'kustomize', version);
}