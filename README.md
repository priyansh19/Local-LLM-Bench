# Local LLM Bench

A comprehensive benchmarking framework for evaluating and comparing local LLM models, written in Rust for maximum performance and cross-platform compatibility.

**Available as:**
- 🖥️ **Windows GUI App** (No Smart App Control warnings) - See [WINDOWS_APP.md](WINDOWS_APP.md)
- 💻 **Cross-Platform CLI** (Linux, macOS, Windows)
- 🐳 **Docker Container** (Works on any system)

## Features

- ⚡ Fast, efficient benchmarking in Rust
- 🔄 Cross-platform (Windows, macOS, Linux)
- 📊 Multiple output formats (JSON, CSV, HTML)
- 📈 Detailed performance metrics (latency, throughput)
- 🛠️ Easy-to-use CLI interface
- 📦 Support for multiple model formats

## Installation

### From Source

```bash
git clone https://github.com/priyansh19/Local-LLM-Bench.git
cd Local-LLM-Bench
cargo build --release
```

The binary will be at `target/release/llm-bench` (or `llm-bench.exe` on Windows).

### Add to PATH

To use from anywhere:

```bash
# On macOS/Linux
export PATH="$PATH:$(pwd)/target/release"

# On Windows PowerShell
$env:PATH += ";$(pwd)/target/release"
```

## Quick Start

### List available datasets

```bash
llm-bench list-datasets
```

### Run a benchmark

```bash
llm-bench run ./path/to/model --dataset standard --iterations 5 --output results.json
```

### Get model information

```bash
llm-bench info ./path/to/model
```

### Generate a report

```bash
llm-bench report results.json --format json
llm-bench report results.json --format csv
llm-bench report results.json --format html
```

## CLI Usage

```
USAGE:
    llm-bench [OPTIONS] <COMMAND>

OPTIONS:
    -v, --verbose    Enable verbose logging
    -h, --help       Print help information
    -V, --version    Print version

COMMANDS:
    run              Run a benchmark on a local LLM model
    list-datasets    List available benchmark datasets
    info             Show detailed information about a model
    report           Generate a report from benchmark results
```

### Run Command

```
USAGE:
    llm-bench run [OPTIONS] <MODEL_PATH>

ARGS:
    <MODEL_PATH>    Path to the model file or directory

OPTIONS:
    -d, --dataset <DATASET>      Benchmark dataset to use [default: standard]
    -i, --iterations <ITERATIONS> Number of iterations [default: 5]
    -o, --output <OUTPUT>        Output file for results
```

## Examples

### Basic benchmark with default settings
```powershell
llm-bench run C:\Models\model.bin
```

### Run with custom iterations and save results
```bash
llm-bench run ~/models/llama-7b --iterations 10 --output benchmark_results.json
```

### Generate HTML report
```bash
llm-bench report benchmark_results.json --format html > report.html
```

### Verbose mode for debugging
```bash
llm-bench -v run ~/models/model --iterations 3
```

## Project Structure

```
Local-LLM-Bench/
├── src/
│   ├── main.rs           # Entry point
│   ├── cli.rs            # CLI argument parsing
│   ├── benchmark.rs      # Benchmark runner
│   ├── models.rs         # Model loading and inference
│   └── results.rs        # Results processing
├── tests/                # Integration tests
├── Cargo.toml            # Project manifest
└── README.md
```

## Development

### Run tests

```bash
cargo test
```

### Build debug version

```bash
cargo build
```

### Build optimized release

```bash
cargo build --release
```

### Check for issues

```bash
cargo clippy
```

## Performance

Benchmarks are optimized for:
- Low latency measurements
- Minimal overhead during runs
- Accurate timing with hardware-level precision
- Memory-efficient result storage

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) file for details.

## Author

Created by Priyansh - [GitHub](https://github.com/priyansh19)

## Support

For issues, questions, or suggestions, please open an [issue](https://github.com/priyansh19/Local-LLM-Bench/issues) on GitHub.
