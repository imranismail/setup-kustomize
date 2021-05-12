import io = require('@actions/io')
import fs = require('fs')
import os = require('os')
import path = require('path')

const toolDir = path.join(__dirname, 'runner', 'tools')
const tempDir = path.join(__dirname, 'runner', 'temp')

process.env['RUNNER_TOOL_CACHE'] = toolDir
process.env['RUNNER_TEMP'] = tempDir

import * as installer from '../src/installer'

const IS_WINDOWS = os.platform() === 'win32'

describe('installer tests', () => {
  beforeAll(async () => {
    await io.rmRF(toolDir)
    await io.rmRF(tempDir)
  })

  it('Acquires the max satisfying version range', async () => {
    await installer.getKustomize('*')
    const kustomizeDir = path.join(toolDir, 'kustomize', '*', os.arch())
    expect(fs.existsSync(`${kustomizeDir}.complete`)).toBe(true)

    if (IS_WINDOWS) {
      expect(fs.existsSync(path.join(kustomizeDir, 'kustomize.exe'))).toBe(true)
    } else {
      expect(fs.existsSync(path.join(kustomizeDir, 'kustomize'))).toBe(true)
      expect(() =>
        fs.accessSync(path.join(kustomizeDir, 'kustomize'), fs.constants.X_OK)
      ).not.toThrow()
    }
  })

  it('Acquires kustomize version 3.2.0', async () => {
    await installer.getKustomize('3.2.0')
    const kustomizeDir = path.join(toolDir, 'kustomize', '3.2.0', os.arch())

    expect(fs.existsSync(`${kustomizeDir}.complete`)).toBe(true)

    if (IS_WINDOWS) {
      expect(fs.existsSync(path.join(kustomizeDir, 'kustomize.exe'))).toBe(true)
    } else {
      expect(fs.existsSync(path.join(kustomizeDir, 'kustomize'))).toBe(true)
      expect(() =>
        fs.accessSync(path.join(kustomizeDir, 'kustomize'), fs.constants.X_OK)
      ).not.toThrow()
    }
  })

  it('Acquires kustomize version 3.2.1', async () => {
    await installer.getKustomize('3.2.1')
    const kustomizeDir = path.join(toolDir, 'kustomize', '3.2.1', os.arch())

    expect(fs.existsSync(`${kustomizeDir}.complete`)).toBe(true)

    if (IS_WINDOWS) {
      expect(fs.existsSync(path.join(kustomizeDir, 'kustomize.exe'))).toBe(true)
    } else {
      expect(fs.existsSync(path.join(kustomizeDir, 'kustomize'))).toBe(true)
      expect(() =>
        fs.accessSync(path.join(kustomizeDir, 'kustomize'), fs.constants.X_OK)
      ).not.toThrow()
    }
  })

  it('Acquires kustomize version 3.3.0', async () => {
    await installer.getKustomize('3.3.0')
    const kustomizeDir = path.join(toolDir, 'kustomize', '3.3.0', os.arch())

    expect(fs.existsSync(`${kustomizeDir}.complete`)).toBe(true)

    if (IS_WINDOWS) {
      expect(fs.existsSync(path.join(kustomizeDir, 'kustomize.exe'))).toBe(true)
    } else {
      expect(fs.existsSync(path.join(kustomizeDir, 'kustomize'))).toBe(true)
      expect(() =>
        fs.accessSync(path.join(kustomizeDir, 'kustomize'), fs.constants.X_OK)
      ).not.toThrow()
    }
  })

  it('Throws if no location contains correct kustomize version', async () => {
    let thrown = false

    try {
      await installer.getKustomize('1000')
    } catch {
      thrown = true
    }

    expect(thrown).toBe(true)
  })

  it('Uses version of kustomize installed in cache', async () => {
    const kustomizeDir = path.join(toolDir, 'kustomize', '3.2.0', os.arch())

    await io.mkdirP(kustomizeDir)

    fs.writeFileSync(`${kustomizeDir}.complete`, 'hello')

    await installer.getKustomize('3.2.0')

    return
  })

  it('Resolves semantic versions of kustomize installed in cache', async () => {
    const kustomizeDir = path.join(toolDir, 'kustomize', '3.0.0', os.arch())

    await io.mkdirP(kustomizeDir)

    fs.writeFileSync(`${kustomizeDir}.complete`, 'hello')

    await installer.getKustomize('3.0.0')
    await installer.getKustomize('3.0')
  })
})
