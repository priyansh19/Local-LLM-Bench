'use strict';
const os = require('os');
const { spawn, execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

const GB = 1024 ** 3;

/**
 * Live system metrics.
 *
 * Sampling rates are dictated by the hardware/OS, not by preference:
 *   - CPU + RAM come from Node's `os` module (~1.3ms per read) -> 250ms.
 *   - GPU counters have a 1-second minimum sample interval in Windows, and a
 *     one-shot `Get-Counter` costs ~1.6s in process-spawn overhead. So a single
 *     long-lived PowerShell streams them instead of respawning per poll.
 *   - Disk changes slowly -> 30s.
 * Values that genuinely cannot be read on this hardware stay null; callers
 * render them as "—" rather than inventing a plausible number.
 */
class Metrics {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
    this.state = {
      cpu: null,
      cores: os.cpus().length,
      cpuPct: null,
      memory: null,
      memoryUsed: null,
      os: null,
      gpu: null,
      gpuPct: null,
      // For an integrated GPU there is no dedicated VRAM: Windows exposes a
      // *shared* pool carved out of system RAM. Report that, and say so.
      vram: null,
      vramUsed: null,
      vramShared: false,
      gpuTemp: null,
      gpuPower: null,
      gpuTempReason: null,
      diskUsed: null,
      diskTotal: null,
    };
    this._prevCpu = this._cpuTimes();
    this._timers = [];
    this._ps = null;
  }

  _cpuTimes() {
    const t = os.cpus().reduce(
      (a, c) => {
        a.idle += c.times.idle;
        a.total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
        return a;
      },
      { idle: 0, total: 0 }
    );
    return t;
  }

  _emit(patch) {
    Object.assign(this.state, patch);
    this.onUpdate(this.state);
  }

  // ---- fast path: pure Node, no process spawn -----------------------------
  _sampleCpuAndRam() {
    const now = this._cpuTimes();
    const idle = now.idle - this._prevCpu.idle;
    const total = now.total - this._prevCpu.total;
    this._prevCpu = now;
    const cpuPct = total > 0 ? Math.max(0, Math.min(100, (1 - idle / total) * 100)) : null;

    const totalMem = os.totalmem();
    const usedMem = totalMem - os.freemem();
    this._emit({
      cpuPct: cpuPct === null ? null : Math.round(cpuPct * 10) / 10,
      memory: Math.round(totalMem / GB),
      memoryUsed: Math.round((usedMem / GB) * 10) / 10,
    });
  }

  // ---- one-off static facts ----------------------------------------------
  async _readStatic() {
    const cpuModel = (os.cpus()[0]?.model || 'Unknown CPU')
      .replace(/\(R\)|\(TM\)|CPU|Processor/g, '')
      .replace(/\s+@.*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    const build = Number((os.release().split('.')[2] || 0));
    const osName =
      process.platform !== 'win32' ? `${process.platform} ${os.release()}` : build >= 22000 ? 'Windows 11' : 'Windows 10';
    this._emit({ cpu: cpuModel, os: osName, cores: os.cpus().length });

    if (process.platform !== 'win32') return;
    try {
      const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-Command', '(Get-CimInstance Win32_VideoController | Select-Object -First 1).Name'],
        { timeout: 8000 }
      );
      const gpu = stdout.trim();
      if (gpu) {
        // Win32_VideoController.AdapterRAM is capped at 2^31-1 for integrated
        // parts, so it is useless. Windows sizes the shared pool at half of
        // system RAM, which is what Task Manager shows.
        const shared = Math.round(os.totalmem() / 2 / GB);
        this._emit({ gpu, vram: shared, vramShared: true });
      }
    } catch {
      /* leave gpu null */
    }
  }

  async _sampleDisk() {
    if (process.platform !== 'win32') return;
    try {
      const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-Command', "$d = Get-PSDrive -Name C; '{0} {1}' -f $d.Used, ($d.Used + $d.Free)"],
        { timeout: 8000 }
      );
      const [used, total] = stdout.trim().split(/\s+/).map(Number);
      if (Number.isFinite(used) && Number.isFinite(total) && total > 0) {
        this._emit({ diskUsed: Math.round(used / GB), diskTotal: Math.round(total / GB) });
      }
    } catch {
      /* leave disk null */
    }
  }

  // ---- GPU: one long-lived streaming PowerShell ---------------------------
  _startGpuStream() {
    if (process.platform !== 'win32') return;

    // Emits one "util|sharedBytes" line per second. Engine utilisation is summed
    // across engines (3D/compute/copy) the way Task Manager presents it.
    const script = `
$ErrorActionPreference='SilentlyContinue'
Get-Counter -Counter '\\GPU Engine(*)\\Utilization Percentage','\\GPU Adapter Memory(*)\\Shared Usage' -SampleInterval 1 -Continuous |
ForEach-Object {
  $u = ($_.CounterSamples | Where-Object { $_.Path -like '*utilization*' } | Measure-Object CookedValue -Sum).Sum
  $m = ($_.CounterSamples | Where-Object { $_.Path -like '*shared usage*' } | Measure-Object CookedValue -Maximum).Maximum
  Write-Output ("{0}|{1}" -f $u, $m)
  [Console]::Out.Flush()
}`.trim();

    try {
      this._ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
        windowsHide: true,
      });
    } catch {
      return;
    }

    let buf = '';
    this._ps.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const line of lines) {
        const [u, m] = line.trim().split('|');
        const util = Number(u);
        const mem = Number(m);
        if (!Number.isFinite(util) && !Number.isFinite(mem)) continue;
        this._emit({
          gpuPct: Number.isFinite(util) ? Math.round(Math.min(100, util) * 10) / 10 : null,
          vramUsed: Number.isFinite(mem) ? Math.round((mem / GB) * 100) / 100 : null,
        });
      }
    });
    this._ps.on('error', () => { this._ps = null; });
  }

  // GPU die temperature is not exposed by Intel integrated graphics through any
  // unprivileged Windows API — ACPI thermal zones return access-denied without
  // elevation, and there is no vendor CLI equivalent to nvidia-smi. Record why,
  // so the UI can explain the dash rather than just showing one.
  _noteTempUnavailable() {
    this._emit({
      gpuTempReason:
        'GPU temperature and power need nvidia-smi (NVIDIA) or elevated ACPI access; neither is available for Intel integrated graphics.',
    });
  }

  start() {
    this._readStatic();
    this._sampleDisk();
    this._noteTempUnavailable();
    this._startGpuStream();
    this._sampleCpuAndRam();
    this._timers.push(setInterval(() => this._sampleCpuAndRam(), 250));
    this._timers.push(setInterval(() => this._sampleDisk(), 30000));
  }

  stop() {
    this._timers.forEach(clearInterval);
    this._timers = [];
    if (this._ps) {
      try { this._ps.kill(); } catch { /* already gone */ }
      this._ps = null;
    }
  }
}

module.exports = { Metrics };
