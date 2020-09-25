// Load tempDirectory before it gets wiped by tool-cache
import {Octokit} from '@octokit/rest'
import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as os from 'os'
import * as path from 'path'
import * as semver from 'semver'
import * as fs from 'fs'
let tempDirectory = process.env['RUNNER_TEMPDIRECTORY'] || ''

const osPlat: string = os.platform()
const osArch: string = os.arch()
const octokit = new Octokit()
const versionRegex = /\d+\.?\d*\.?\d*/

if (!tempDirectory) {
  let baseLocation
  if (process.platform === 'win32') {
    // On windows use the USERPROFILE env variable
    baseLocation = process.env['USERPROFILE'] || 'C:\\'
  } else {
    if (process.platform === 'darwin') {
      baseLocation = '/Users'
    } else {
      baseLocation = '/home'
    }
  }
  tempDirectory = path.join(baseLocation, 'actions', 'temp')
}

export async function getKustomize(versionSpec: string): Promise<void> {
  // check cache
  let toolPath: string

  toolPath = tc.find('kustomize', versionSpec)

  // If not found in cache, download
  if (!toolPath) {
    let version: string
    const c = semver.clean(versionSpec) || ''
    // If explicit version
    if (semver.valid(c) != null) {
      // version to download
      version = versionSpec
    } else {
      // query kustomize for a matching version
      const match = await queryLatestMatch(versionSpec)

      if (!match) {
        throw new Error(
          `Unable to find Kustomize version '${versionSpec}' for platform ${osPlat} and architecture ${osArch}.`
        )
      }

      version = match
    }

    if (!toolPath) {
      // download, extract, cache
      toolPath = await acquireKustomize(version)
    }
  }

  core.addPath(toolPath)
}

async function queryLatestMatch(versionSpec: string): Promise<string | null> {
  let dataFileName: string

  switch (osPlat) {
    case 'linux':
    case 'darwin':
    case 'win32':
      dataFileName = osPlat
      break
    default:
      throw new Error(`Unexpected OS '${osPlat}'`)
  }

  switch (osArch) {
    case 'x64':
      dataFileName = `${dataFileName}_amd64`
      break
    default:
      dataFileName = `${dataFileName}_${osArch}`
  }

  const versions: string[] = []

  for await (const response of octokit.paginate.iterator(
    octokit.repos.listReleases,
    {
      owner: 'kubernetes-sigs',
      repo: 'kustomize'
    }
  )) {
    for (const release of response.data) {
      if (
        release.assets.some(
          asset =>
            asset.name.includes(dataFileName) &&
            asset.name.includes('kustomize')
        )
      ) {
        const version = (versionRegex.exec(release.name) || []).shift()

        if (version != null) {
          versions.push(version)
        }
      }
    }
  }

  return semver.maxSatisfying(versions, versionSpec)
}

async function acquireKustomize(version: string): Promise<string> {
  version = semver.clean(version) || ''

  let downloadUrl: string
  let toolPath: string
  let toolFilename = 'kustomize'
  const toolName = 'kustomize'

  if (osPlat === 'win32') {
    toolFilename = `${toolFilename}.exe`
  }

  if (semver.gte(version, '3.3.0')) {
    downloadUrl = `https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize/v${version}/kustomize_v${version}_%{os}_%{arch}.tar.gz`
  } else if (semver.gte(version, '3.2.1')) {
    downloadUrl = `https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize/v${version}/kustomize_kustomize.v${version}_%{os}_%{arch}`
  } else {
    downloadUrl = `https://github.com/kubernetes-sigs/kustomize/releases/download/v${version}/kustomize_${version}_%{os}_%{arch}`
  }

  switch (osPlat) {
    case 'win32':
      if (semver.lte(version, '3.2.1'))
        throw new Error(`Unexpected OS '${osPlat}'`)
      downloadUrl = downloadUrl.replace('%{os}', 'windows')
      if (semver.lt(version, '3.3.0')) downloadUrl = `${downloadUrl}.exe`
      break
    case 'linux':
    case 'darwin':
      downloadUrl = downloadUrl.replace('%{os}', osPlat)
      break
    default:
      throw new Error(`Unexpected OS '${osPlat}'`)
  }

  switch (osArch) {
    case 'x64':
      downloadUrl = downloadUrl.replace('%{arch}', 'amd64')
      break
    default:
      throw new Error(`Unexpected Arch '${osArch}'`)
  }

  try {
    toolPath = await tc.downloadTool(downloadUrl)
  } catch (err) {
    core.debug(err)
    throw new Error(`Failed to download version ${version}: ${err}`)
  }

  if (downloadUrl.endsWith('.tar.gz')) {
    toolPath = await tc.extractTar(toolPath)
    toolPath = path.join(toolPath, toolFilename)
  }

  switch (osPlat) {
    case 'linux':
    case 'darwin':
      fs.chmodSync(toolPath, 0o755)
      break
  }

  return await tc.cacheFile(toolPath, toolFilename, toolName, version)
}
