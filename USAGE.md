# Local LLM Bench - Usage Guide

## Installation

### Build from Source
```bash
git clone https://github.com/priyansh19/Local-LLM-Bench
cd Local-LLM-Bench
cargo build --release
```

Binary: `target/release/llm-bench`

### Add to PATH
```bash
# Linux/macOS
export PATH="$PATH:$(pwd)/target/release"

# Windows PowerShell
$env:PATH += ";$(pwd)/target/release"
```

## Quick Start

### 1. Start a Model Service

**Ollama:**
```bash
# Install from ollama.com then:
ollama serve
ollama pull mistral  # or another model
```

**LM Studio:**
- Download from lmstudio.ai
- Load a model in the UI
- Enable "Local Server"

**llama.cpp:**
```bash
./server -m model.gguf
```

### 2. Run Benchmark

```bash
llm-bench run ollama:mistral --iterations 5
```

### 3. View Results

```bash
# JSON (default)
llm-bench run ollama:mistral --iterations 5

# Save to file
llm-bench run ollama:mistral --iterations 5 --output results.json

# Export to different formats
llm-bench report results.json --format csv
llm-bench report results.json --format html > report.html
```

## Command Reference

### `run` - Run benchmarks

```bash
llm-bench run <MODEL> [OPTIONS]

Arguments:
  <MODEL>  Model identifier:
           - ollama:model-name (e.g., ollama:mistral)
           - lmstudio:model-name
           - llama-cpp:model-name
           - hf://model-id (HuggingFace)
           - /path/to/local/model.gguf

Options:
  -d, --dataset <DATASET>      Benchmark dataset [default: standard]
  -i, --iterations <ITER>      Number of iterations [default: 5]
  -o, --output <FILE>          Save results to file
  -v, --verbose                Enable verbose logging
```

### `report` - Generate reports

```bash
llm-bench report <RESULTS_FILE> [OPTIONS]

Arguments:
  <RESULTS_FILE>   Path to results JSON file

Options:
  -f, --format <FORMAT>  Output format: json|csv|html [default: json]
```

### `info` - Model information

```bash
llm-bench info <MODEL>

Shows:
- Model name
- Type
- Source
- Parameter count
```

### `list-datasets` - Available datasets

```bash
llm-bench list-datasets

Lists:
- Standard benchmark suite
- LLaMA eval dataset
- Custom dataset support
```

## Usage Examples

### Example 1: Quick Benchmark
```bash
llm-bench run ollama:mistral --iterations 3
```
Output: Latency measurements for each iteration

### Example 2: Save Results
```bash
llm-bench run ollama:neural-chat --iterations 10 --output neural_chat.json
```

### Example 3: Export to CSV
```bash
llm-bench report neural_chat.json --format csv
```

Output:
```
Model,Dataset,Type,Timestamp,Average(ms),Min(ms),Max(ms),Tokens/Sec,QualityPass%
neural-chat,standard,ollama,2026-07-16T...,1234.56,1100.00,1500.00,50.5,85.0
```

### Example 4: Generate HTML Report
```bash
llm-bench report results.json --format html > benchmark_report.html
```

### Example 5: Compare Models
```bash
# Benchmark multiple models
llm-bench run ollama:mistral --iterations 5 --output mistral.json
llm-bench run ollama:neural-chat --iterations 5 --output neural.json
llm-bench run ollama:orca --iterations 5 --output orca.json

# Compare results
cat mistral.json neural.json orca.json | jq '.[] | {model, avg_latency, tokens_per_second}'
```

## Output Formats

### JSON Format
Full results with all metrics:
```json
{
  "model_name": "mistral",
  "dataset": "standard",
  "model_type": "ollama",
  "timestamp": "2026-07-16T12:34:56Z",
  "latencies": [1234.5, 1256.2, 1245.1],
  "tokens_per_second": 50.5,
  "throughput_curve": { "1": 50.5, "2": 95.2, "4": 180.5 },
  "quality_pass_rate": 85.0,
  "system_metrics": { "cpu_percent": 78.5, "gpu_percent": 92.1, "memory_percent": 65.2 }
}
```

### CSV Format
Comma-separated values for spreadsheets:
```
Model,Dataset,Type,Timestamp,Average(ms),Min(ms),Max(ms),Tokens/Sec,QualityPass%
mistral,standard,ollama,2026-07-16T12:34:56Z,1245.27,1234.50,1256.20,50.5,85.0
```

### HTML Format
Interactive web report:
- Model information
- Latency metrics
- Throughput data
- System statistics
- Formatted for web viewing

## Advanced Usage

### Verbose Mode
```bash
llm-bench -v run ollama:mistral --iterations 5
```
Shows detailed logging of each step.

### Custom Datasets
```bash
# Create custom_prompts.json
[
  {
    "id": "test_1",
    "prompt": "Explain quantum computing",
    "category": "explain"
  }
]

# Use in benchmark
llm-bench run ollama:mistral --dataset custom_prompts.json
```

### Batch Benchmarking
```bash
#!/bin/bash
for model in mistral neural-chat orca; do
  echo "Benchmarking $model..."
  llm-bench run ollama:$model --iterations 10 --output results_$model.json
done
```

## Performance Optimization

### For Accurate Benchmarks
1. Run system without other heavy processes
2. Use consistent iterations (10-20 recommended)
3. Allow model to warm up (first iteration often slower)
4. Run multiple times and average results

### For Fast Testing
1. Use small models (7B parameters)
2. Reduce iterations (3-5)
3. Use quantized models (GGUF Q4, Q5)

## Troubleshooting

### Connection Refused
```bash
# Check service is running
curl http://localhost:11434/api/tags  # Ollama
curl http://localhost:1234/v1/models  # LM Studio
curl http://localhost:8000/health      # llama.cpp
```

### Slow Performance
- Check available RAM and VRAM
- Monitor CPU/GPU usage during run
- Try smaller models for testing
- Close other applications

### Invalid Model
```bash
# Verify model exists
ollama list          # For Ollama
llm-bench info ollama:mistral  # Get info
```

## Performance Tips

1. **GPU Acceleration**: Models run faster on GPU if available
2. **Quantization**: GGUF Q4/Q5 quantization reduces memory usage
3. **Batching**: Run multiple iterations in one session for better averaging
4. **Context Size**: Smaller context = faster inference
5. **Temperature**: Lower temperature slightly improves latency (model-dependent)

## Next Steps

- Join the community: GitHub Issues & Discussions
- Report bugs: Create GitHub Issue with benchmark results
- Contribute: Submit PRs for new features
- Share results: Compare your benchmark results
