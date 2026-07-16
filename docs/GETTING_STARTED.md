# Getting Started with Local LLM Bench

## Installation

### From source

```bash
git clone https://github.com/yourusername/Local-LLM-Bench.git
cd Local-LLM-Bench
pip install -e .
```

### Development setup

```bash
pip install -e ".[dev]"
```

## First Benchmark

### 1. Prepare your model

Ensure you have a local LLM model in a supported format (GGML, PyTorch, etc.).

### 2. Run a benchmark

```python
from llm_bench import Benchmark

bench = Benchmark()
results = bench.run("path/to/your/model")
report = bench.generate_report(results)
print(report)
```

### 3. Explore results

Results are saved to `benchmarks/results/` directory in JSON format.

## Available Datasets

- `standard`: Standard benchmark suite
- `custom`: Custom dataset path

## Configuration

Create a `config.yaml` in the project root:

```yaml
benchmark:
  timeout: 300
  batch_size: 32
  num_runs: 5

models:
  - name: model1
    path: /path/to/model1

datasets:
  - name: standard
    path: ./data/standard_benchmark.txt
```

## Next Steps

- See [README.md](../README.md) for full documentation
- Check [examples/](../examples/) for sample scripts
