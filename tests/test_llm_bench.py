"""Tests for the LLM Bench module."""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from llm_bench import Benchmark


def test_benchmark_initialization():
    """Test Benchmark class initialization."""
    bench = Benchmark()
    assert bench.results == {}
    assert bench.models == []


def test_benchmark_run():
    """Test running a benchmark."""
    bench = Benchmark()
    results = bench.run("test_model", dataset="standard")

    assert results["model"] == "test_model"
    assert results["dataset"] == "standard"
    assert "metrics" in results
    assert results["status"] == "pending"


def test_benchmark_generate_report():
    """Test report generation."""
    bench = Benchmark()
    results = bench.run("test_model", dataset="test_dataset")
    report = bench.generate_report(results)

    assert "test_model" in report
    assert "test_dataset" in report
    assert "Benchmark Report" in report
