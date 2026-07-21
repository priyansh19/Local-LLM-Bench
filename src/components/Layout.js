import React from 'react';
import ModelTuner from './ModelTuner';

export default function Layout({
  children,
  systemInfo,
  startBenchmark,
  navItems,
  benchmarkConfig,
  setBenchmarkConfig,
  isTunerOpen,
  setIsTunerOpen,
  onNavigate
}) {
  // Any field can legitimately be null on hardware that doesn't expose it.
  // Render "—" rather than inventing a plausible number.
  const has = (v) => v !== null && v !== undefined;

  const {
    vram, vramUsed, vramShared, gpuPct, gpuTemp, gpuPower, gpuTempReason,
    cpuPct, memory, memoryUsed, diskUsed, diskTotal,
  } = systemInfo || {};

  // On integrated graphics this pool is shared system RAM, not dedicated VRAM.
  const vramLabel = vramShared ? 'GPU MEM' : 'VRAM';
  const vramStr = has(vramUsed) ? vramUsed.toFixed(1) : '—';
  const vramTotalStr = has(vram) ? `/${vram}G` : '';
  const vramPct = has(vramUsed) && vram > 0 ? (vramUsed / vram) * 100 : 0;

  // Utilisation is readable on this hardware even when temp/power are not.
  const gpuPctStr = has(gpuPct) ? `${gpuPct.toFixed(0)}%` : '—';
  const gpuTail = has(gpuTemp) || has(gpuPower)
    ? `${has(gpuTemp) ? `${gpuTemp}°C` : '—'} · ${has(gpuPower) ? `${gpuPower}W` : '—'}`
    : null;

  const cpuStr = has(cpuPct) ? `${cpuPct.toFixed(0)}%` : '—';
  const ramStr = has(memoryUsed) && has(memory) ? `${memoryUsed.toFixed(1)}/${memory}G` : '—';
  const ramPct = has(memoryUsed) && memory > 0 ? (memoryUsed / memory) * 100 : 0;

  const diskStr = has(diskUsed) && has(diskTotal) ? `${diskUsed} / ${diskTotal} GB` : '—';
  const diskPct = has(diskUsed) && has(diskTotal) && diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;

  const gpuLine = has(systemInfo?.gpu) ? systemInfo.gpu : 'Detecting GPU…';
  const cpuLine = [systemInfo?.cpu, has(memory) ? `${memory} GB` : null, systemInfo?.os]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="llm-bench">
      {/* Title Bar — draggable; the three dots are the real window controls */}
      <div className="title-bar">
        <div className="title-bar-left">
          <div className="title-logo"></div>
          <span className="title-text">LLMBench</span>
          <span className="title-version">v0.9 · on-device benchmarking</span>
        </div>
        <div className="title-bar-right">
          <button
            className="title-dot"
            title="Minimize"
            aria-label="Minimize"
            onClick={() => window.electron?.minimizeWindow?.()}
          ></button>
          <button
            className="title-dot"
            title="Maximize"
            aria-label="Maximize"
            onClick={() => window.electron?.maximizeWindow?.()}
          ></button>
          <button
            className="title-dot active"
            title="Close"
            aria-label="Close"
            onClick={() => window.electron?.closeWindow?.()}
          ></button>
        </div>
      </div>

      {/* Model tuning slide-in panel — always mounted so it can animate */}
      <ModelTuner
        open={isTunerOpen}
        config={benchmarkConfig}
        setConfig={setBenchmarkConfig}
        onClose={() => setIsTunerOpen(false)}
        systemInfo={systemInfo}
        onStart={() => (startBenchmark ? startBenchmark() : onNavigate('run'))}
      />

      <div className="main-content">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="nav-items">
            {navItems.map((item) => (
              <div
                key={item.id}
                className={`nav-item ${item.active ? 'active' : ''}`}
                onClick={() => onNavigate(item.action, item.data)}
              >
                <span>{item.label}</span>
                {item.badge && <span className="badge">{item.badge}</span>}
              </div>
            ))}
          </div>

          {/* System Panel */}
          <div className="system-panel">
            <div className="system-header">
              <div className="status-dot"></div>
              <span className="system-label">This machine</span>
            </div>
            <div className="system-name">{gpuLine}</div>
            <div className="system-details">{cpuLine}</div>

            <div className="metric">
              <div className="metric-label">
                <span title={vramShared ? 'Integrated graphics share system RAM — there is no dedicated VRAM.' : undefined}>
                  {vramLabel}
                </span>
                <span className="metric-value">
                  {vramStr}
                  <span className="metric-unit">{vramTotalStr}</span>
                </span>
              </div>
              <div className="metric-bar">
                <div className="metric-fill is-live" style={{ width: `${vramPct}%` }}></div>
              </div>
            </div>

            <div className="metric">
              <div className="metric-label">
                <span title={!gpuTail && gpuTempReason ? gpuTempReason : undefined}>GPU</span>
                <span className="metric-value metric-value-dark">
                  {gpuPctStr}
                  {gpuTail && <span className="metric-unit"> · {gpuTail}</span>}
                </span>
              </div>
              <div className="metric-bar">
                <div
                  className="metric-fill metric-fill-dark is-live"
                  style={{ width: `${has(gpuPct) ? gpuPct : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="metric">
              <div className="metric-label">
                <span>CPU</span>
                <span className="metric-value metric-value-dark">
                  {cpuStr}
                  <span className="metric-unit"> · {ramStr} RAM</span>
                </span>
              </div>
              <div className="metric-bar">
                <div
                  className="metric-fill metric-fill-dark is-live"
                  style={{ width: `${has(cpuPct) ? cpuPct : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="metric">
              <div className="metric-label">
                <span>RAM</span>
                <span className="metric-value metric-value-sm">{ramStr}</span>
              </div>
              <div className="metric-bar">
                <div className="metric-fill metric-fill-muted is-live" style={{ width: `${ramPct}%` }}></div>
              </div>
            </div>

            <div className="metric metric-disk">
              <div className="metric-label">
                <span>Disk</span>
                <span className="metric-value metric-value-sm">{diskStr}</span>
              </div>
              <div className="metric-bar">
                <div className="metric-fill metric-fill-muted" style={{ width: `${diskPct}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="content-area">
          {children}
        </div>
      </div>
    </div>
  );
}
