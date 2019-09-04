import io = require('@actions/io');
import fs = require('fs');
import os = require('os');
import path = require('path');

const toolDir = path.join(__dirname, 'runner', 'tools');
const tempDir = path.join(__dirname, 'runner', 'temp');

process.env['RUNNER_TOOL_CACHE'] = toolDir;
process.env['RUNNER_TEMP'] = tempDir;

import * as installer from '../src/installer';

const IS_WINDOWS = process.platform === 'win32';

describe('installer tests', () => {
  beforeAll(async () => {
    await io.rmRF(toolDir);
    await io.rmRF(tempDir);
  }, 100000);

  // afterAll(async () => {
  //   await io.rmRF(toolDir);
  //   await io.rmRF(tempDir);
  // }, 100000);

  it('Acquires version of kustomize if no matching version is installed', async () => {
    await installer.getKustomize('3.1.0');
    const kustomizeDir = path.join(toolDir, 'kustomize', '3.1.0', os.arch());

    expect(fs.existsSync(`${kustomizeDir}.complete`)).toBe(true);

    if (IS_WINDOWS) {
      expect(fs.existsSync(path.join(kustomizeDir, 'kustomize.exe'))).toBe(true);
    } else {
      expect(fs.existsSync(path.join(kustomizeDir, 'kustomize'))).toBe(true);
    }
  }, 100000);

  it('Throws if no location contains correct kustomize version', async () => {
    let thrown = false;

    try {
      await installer.getKustomize('1000');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  it('Uses version of kustomize installed in cache', async () => {
    const kustomizeDir: string = path.join(toolDir, 'kustomize', '3.2.0', os.arch());

    await io.mkdirP(kustomizeDir);

    fs.writeFileSync(`${kustomizeDir}.complete`, 'hello');

    await installer.getKustomize('3.2.0');

    return;
  });

  it('Doesnt use version of kustomize that was only partially installed in cache', async () => {
    const kustomizeDir: string = path.join(toolDir, 'kustomize', '3.3.0', os.arch());

    await io.mkdirP(kustomizeDir);

    let thrown = false;

    try {
      await installer.getKustomize('3.3.0');
    } catch {
      thrown = true;
    }

    expect(thrown).toBe(true);

    return;
  });

  it('Resolves semantic versions of kustomize installed in cache', async () => {
    const kustomizeDir: string = path.join(toolDir, 'kustomize', '3.4.0', os.arch());

    await io.mkdirP(kustomizeDir);

    fs.writeFileSync(`${kustomizeDir}.complete`, 'hello');

    await installer.getKustomize('3.4.0');
    await installer.getKustomize('3');
    await installer.getKustomize('3.x');
  });
});