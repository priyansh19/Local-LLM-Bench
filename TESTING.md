# Testing Guide for Local LLM Bench

## Running Tests

### Unit Tests
All modules include comprehensive unit tests. Run them with:

```bash
cargo test
```

### Specific Module Tests
Test individual modules:

```bash
# Test tokenizer
cargo test tokenizer::

# Test metrics
cargo test metrics::

# Test statistics
cargo test stats::

# Test datasets
cargo test datasets::

# Test UI/animations
cargo test animations:: ui::
```

### Integration Tests
Integration tests are in `tests/integration_tests.rs`. They test core functionality without requiring external services:

```bash
cargo test --test integration_tests
```

## Manual Testing

### Prerequisites
- Rust 1.70+
- One of: Ollama, LM Studio, or llama.cpp running locally

### Test 1: Basic Benchmark with Ollama

```bash
# Ensure Ollama is running with a model
# ollama serve

# Run benchmark
cargo run --release -- run ollama:mistral --iterations 5

# Expected output:
# - Latency measurements
# - Average, min, max latency
# - Results in JSON format
```

### Test 2: Throughput Measurement

```bash
cargo run --release -- run ollama:mistral --iterations 10
```

Expected: Should show consistent latency measurements across iterations.

### Test 3: Results Export

```bash
# Save results to file
cargo run --release -- run ollama:mistral --iterations 5 --output results.json

# View in different formats
cargo run --release -- report results.json --format json
cargo run --release -- report results.json --format csv
cargo run --release -- report results.json --format html > report.html
```

### Test 4: Model Information

```bash
cargo run --release -- info ollama:mistral
```

Expected: Displays model information (name, type, source).

### Test 5: List Datasets

```bash
cargo run --release -- list-datasets
```

Expected: Shows available benchmark datasets.

## Test Coverage Areas

### Phase 1 (Foundation)
- ✅ Model source detection (ollama:, lmstudio:, hf://, file paths)
- ✅ HTTP API communication with model services
- ✅ Basic latency measurements
- ✅ JSON/CSV/HTML export

### Phase 2 (Metrics)
- ✅ Token counting (fallback and model-specific)
- ✅ System metrics (CPU, GPU, memory)
- ✅ Statistical analysis (percentiles, std dev)
- ✅ Quality benchmark datasets (MBPP, HumanEval)
- ✅ Concurrency sweep logic
- ✅ Extended results export

### Phase 3 (UI)
- ✅ Splash screen rendering
- ✅ Spinner animations
- ✅ Progress bar display
- ✅ Stats header formatting

## Testing Scenarios

### Scenario 1: Quick Benchmark
```bash
cargo run -- run ollama:mistral --iterations 3
```
Duration: ~1 minute
Tests: Basic functionality, latency measurement

### Scenario 2: Extended Metrics
```bash
cargo run -- run ollama:mistral --iterations 10 --output results.json
```
Duration: ~2-3 minutes
Tests: Extended metrics, results export

### Scenario 3: Multi-Model Comparison
```bash
# Benchmark multiple models
cargo run -- run ollama:mistral --iterations 5 --output results_mistral.json
cargo run -- run ollama:neural-chat --iterations 5 --output results_neural.json
```
Tests: Multi-model handling, comparison logic

## Continuous Integration

For CI/CD environments without GPU:

```bash
# Run tests without GPU
SKIP_GPU_TESTS=1 cargo test
```

## Expected Test Results

### Unit Test Coverage
- 40+ unit tests across all modules
- All should pass on Linux/macOS/CI systems
- May have linker issues on Windows MSVC (environmental issue, not code)

### Integration Test Coverage
- Model source detection validation
- Results serialization/deserialization
- Metrics calculations
- Export format validation
- Statistical calculation validation

## Troubleshooting

### "Model service not responding"
- Ensure Ollama/LM Studio/llama.cpp is running
- Check port (Ollama: 11434, LM Studio: 1234, llama.cpp: 8000)
- Try: `curl http://localhost:11434/api/tags`

### Build fails on Windows
- Expected due to MSVC linker configuration
- Use Linux/macOS or GitHub Actions CI
- WSL2 with proper Rust setup should work

### Slow benchmark runs
- Check CPU usage (models are compute-intensive)
- Reduce `--iterations` for faster testing
- Use smaller models for testing

## Performance Baselines

Expected latency ranges (per iteration):
- Small models (7B): 500ms - 2000ms
- Medium models (13B): 1000ms - 3000ms
- Large models (70B+): 3000ms+

These vary significantly based on:
- Model quantization
- Hardware (CPU/GPU)
- System load
- Model context size

## Continuous Monitoring

Metrics to track across benchmarks:
- Latency (average, p95, p99)
- Tokens per second
- System resource usage
- Quality benchmark pass rates
- Throughput curve (concurrency sweep)
