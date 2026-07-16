# Contributing to Local LLM Bench

Thank you for your interest in contributing! Please follow these guidelines.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/Local-LLM-Bench.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Install development dependencies: `pip install -e ".[dev]"`

## Development Workflow

1. Make your changes
2. Run tests: `pytest`
3. Run code quality checks: `black . && flake8 . && mypy .`
4. Commit with clear messages: `git commit -m "Add feature: description"`
5. Push and create a pull request

## Code Style

- Follow PEP 8
- Use type hints
- Maximum line length: 88 characters (Black default)
- Write docstrings for all public functions

## Testing

- Write tests for new features
- Ensure all tests pass: `pytest --cov`
- Aim for >80% code coverage

## Pull Request Process

1. Update README.md if needed
2. Add tests for new functionality
3. Ensure CI/CD passes
4. Request review from maintainers

## Questions?

Open an issue or discussion in the repository.
