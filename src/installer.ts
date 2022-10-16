import {GitHub, getOctokitOptions} from '@actions/github/lib/utils'
import {OctokitOptions} from '@octokit/core/dist-types/types'
import {throttling} from '@octokit/plugin-throttling'
import * as core from '@actions/core'
import * as cache from '@actions/tool-cache'
import * as path from 'path'
import * as semver from 'semver'
import * as fs from 'fs'
let tempDirectory = process.env['RUNNER_TEMPDIRECTORY'] || ''

const EnhancedOctokit = GitHub.plugin(throttling)

const githubToken = core.getInput('github-token')
const failFast = core.getInput('fail-fast') === 'true' ? true : false

let options: OctokitOptions = {
  throttle: {
    onRateLimit: (retryAfter: Number, opts: OctokitOptions) => {
      core.warning(
        `Request quota exhausted for request ${opts.method} ${opts.url}`
      )
      if (!failFast) {
        core.warning(`Retrying after ${retryAfter} seconds!`)
      }
      return !failFast
    },
    onAbuseLimit: (retryAfter: Number, opts: OctokitOptions) => {
      core.warning(`Abuse detected for request ${opts.method} ${opts.url}`)
      if (!failFast) {
        core.warning(`Retrying after ${retryAfter} seconds!`)
      }
      return !failFast
    }
  }
}

if (process.env.NODE_ENV === 'test') {
  options = githubToken ? getOctokitOptions(githubToken, options) : options
} else {
  options = getOctokitOptions(githubToken, options)
}

const octokit = new EnhancedOctokit(options)
const versionRegex = /\d+\.?\d*\.?\d*/
const toolName = 'kustomize'
const platform = process.platform
const arch = process.arch === 'x64' ? 'amd64' : process.arch

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

export async function getKustomize(targetVersion: string): Promise<void> {
  if (!semver.validRange(targetVersion))
    throw new Error(`invalid semver requested: ${targetVersion}`)

  let kustomizePath = cache.find('kustomize', targetVersion)

  if (!kustomizePath) {
    const version = await getMaxSatisfyingVersion(targetVersion)
    kustomizePath = await acquireVersion(version)
  }

  return core.addPath(kustomizePath)
}

interface Version {
  resolved: string
  target: string
  url: string
}

async function getMaxSatisfyingVersion(
  targetVersion: string
): Promise<Version> {
  const version = {target: targetVersion}
  const availableVersions: Map<string, string> = new Map()

  for await (const response of octokit.paginate.iterator(
    octokit.repos.listReleases,
    {
      owner: 'kubernetes-sigs',
      repo: 'kustomize',
      per_page: 100
    }
  )) {
    for (const release of response.data) {
      const matchingAsset = release.assets.find(
        asset =>
          asset.name.includes('kustomize') &&
          asset.name.includes(platform) &&
          asset.name.includes(arch)
      )

      if (matchingAsset) {
        const kustomizeVersion = (
          versionRegex.exec(release.tag_name) || []
        ).shift()

        if (kustomizeVersion != null) {
          availableVersions.set(
            kustomizeVersion,
            matchingAsset.browser_download_url
          )
        }
      }
    }
  }

  const resolved = semver.maxSatisfying(
    [...availableVersions.keys()],
    version.target
  )

  if (!resolved) {
    throw new Error(
      `Unable to find Kustomize version '${version.target}' for platform '${platform}' and architecture ${arch}.`
    )
  }

  const url = availableVersions.get(resolved) as string

  return {...version, resolved, url}
}

async function acquireVersion(version: Version): Promise<string> {
  const toolFilename =
    process.platform === 'win32' ? `${toolName}.exe` : toolName
  let toolPath: string

  try {
    toolPath = await cache.downloadTool(version.url)
  } catch (err) {
    core.debug(err)
    throw new Error(`Failed to download version ${version.target}: ${err}`)
  }

  if (version.url.endsWith('.tar.gz')) {
    toolPath = await cache.extractTar(toolPath)
    toolPath = path.join(toolPath, toolFilename)
  }

  switch (process.platform) {
    case 'linux':
    case 'darwin':
      fs.chmodSync(toolPath, 0o755)
      break
  }

  return await cache.cacheFile(toolPath, toolFilename, toolName, version.target)
}
