import React, { useState } from 'react';
import Layout from './Layout';
import buildNavItems from './navItems';
import { buildResults } from '../data/results';

export default function Results({ onNavigate, systemInfo, benchmarkConfig, setBenchmarkConfig, catalog, startBenchmark}) {
  const [isTunerOpen, setIsTunerOpen] = useState(false);
  const { radar, legend, heads, leaderboard, ranking, winnerLine, weightsNote } = buildResults();
  const navItems = buildNavItems('results', catalog);

  return (
    <Layout
      navItems={navItems}
      systemInfo={systemInfo}
      startBenchmark={startBenchmark}
      benchmarkConfig={benchmarkConfig}
      setBenchmarkConfig={setBenchmarkConfig}
      isTunerOpen={isTunerOpen}
      setIsTunerOpen={setIsTunerOpen}
      onNavigate={onNavigate}
    >
      <div className="screen-results">
        <div className="screen-label">Results · comparison</div>
        <h1 className="screen-title">Benchmark results</h1>
        <p className="screen-subtitle">
          {legend.length} models{systemInfo?.gpu ? ` · benchmarked on your ${systemInfo.gpu}` : ''} · vision + text
          suite
        </p>

        <div className="block-title">The shape of each model</div>
        <div className="radar-container">
          <svg className="radar-chart" viewBox="0 0 300 280" preserveAspectRatio="xMidYMid meet">
            {radar.rings.map((r) => (
              <polygon key={r} points={r} fill="none" stroke="var(--track)" strokeWidth="1" />
            ))}
            {radar.spokes.map((s) => (
              <line key={`${s.x}-${s.y}`} x1="150" y1="130" x2={s.x} y2={s.y} stroke="var(--track)" strokeWidth="1" />
            ))}
            {radar.models.map((m) => (
              <polygon key={m.color} points={m.points} fill={m.fill} stroke={m.color} strokeWidth="2" />
            ))}
            {radar.axes.map((a) => (
              <text
                key={a.label}
                x={a.x}
                y={a.y}
                textAnchor={a.anchor}
                style={{ font: '600 10px Inter, sans-serif', fill: 'var(--ink-3)' }}
              >
                {a.label}
              </text>
            ))}
          </svg>
          <div className="radar-legend">
            {legend.map((m) => (
              <div key={m.short} className="legend-item">
                <div className="legend-color" style={{ background: m.color }}></div>
                <div>
                  <div className="legend-name">{m.short}</div>
                  <div className="legend-tagline">{m.tagline}</div>
                </div>
              </div>
            ))}
            <div className="legend-note">{winnerLine}</div>
          </div>
        </div>

        <div className="block-title">Weighted leaderboard</div>
        <div className="results-table">
          <div className="results-header">
            <span>Model</span>
            {heads.map((h) => (
              <span key={h} className="header-right">
                {h}
              </span>
            ))}
            <span className="header-right">Score</span>
          </div>
          {leaderboard.map((m) => (
            <div key={m.short} className="results-row" style={{ background: m.rowBg }}>
              <span className="row-model">
                {m.isTop && <span>🏆</span>}
                {m.short}
              </span>
              {m.cells.map((c, j) => (
                <div key={j} className="result-cell">
                  <div className="result-value" style={{ color: c.valColor }}>
                    {c.value}
                  </div>
                  <div className="result-bar">
                    <div className="result-fill" style={{ background: c.barColor, width: c.pct }}></div>
                  </div>
                  <div className="result-delta">{c.delta}</div>
                </div>
              ))}
              <div className="result-score">
                <div className="score-large" style={{ color: m.scoreColor }}>
                  {m.score}
                </div>
                <div className="score-max">/100</div>
              </div>
            </div>
          ))}
        </div>
        <div className="weights-note">{weightsNote}</div>

        <div className="block-title">Ranking</div>
        <div className="ranking-list">
          {ranking.map((m) => (
            <div key={m.full} className={`ranking-item ${m.isTop ? 'is-top' : ''}`}>
              <div className="ranking-medal">{m.medal}</div>
              <div className="ranking-info">
                <div className="ranking-name">{m.full}</div>
                <div className="ranking-tagline">{m.tagline}</div>
              </div>
              <span className="ranking-badge" style={{ '--hue': m.badgeColor, color: m.badgeColor, background: m.badgeBg }}>
                {m.badge}
              </span>
              <div className="ranking-bar">
                <div className="ranking-fill" style={{ background: m.color, width: m.scorePct }}></div>
              </div>
              <div className="ranking-score">
                <span className="score-large">{m.score}</span>
                <span className="score-max">/100</span>
              </div>
            </div>
          ))}
        </div>

        <div className="results-actions">
          <button className="btn-dark" onClick={() => onNavigate('registry')}>
            Benchmark another model
          </button>
          <button className="btn-secondary">Export report</button>
        </div>
      </div>
    </Layout>
  );
}
