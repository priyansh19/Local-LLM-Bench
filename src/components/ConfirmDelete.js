import React from 'react';

// The design's delete-confirm modal. It is explicit about what is destroyed
// (the weights) and what survives (benchmark results) — worth keeping exact.
export default function ConfirmDelete({ model, onCancel, onConfirm }) {
  if (!model) return null;

  return (
    <div className="confirm-scrim" onClick={onCancel}>
      <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon">🗑</div>
        <h2 className="confirm-title">Delete {model.name}?</h2>
        <p className="confirm-body">
          This permanently removes <b>{model.sizeNum} GB</b> of model files from{' '}
          <span className="confirm-path">C:\LLMBench\models\</span>. Benchmark results are kept. This can’t be
          undone.
        </p>
        <div className="confirm-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-destructive" onClick={() => onConfirm(model)}>
            Delete files
          </button>
        </div>
      </div>
    </div>
  );
}
