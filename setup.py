from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="local-llm-bench",
    version="0.1.0",
    author="Priyansh",
    author_email="pgupta@zaradigitalsolutions.it",
    description="A comprehensive benchmarking framework for local LLM models",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/Local-LLM-Bench",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
    install_requires=[
        "numpy>=1.20.0",
        "pandas>=1.3.0",
        "torch>=1.9.0",
        "transformers>=4.0.0",
        "pydantic>=1.8.0",
        "pyyaml>=5.4.0",
        "tqdm>=4.62.0",
    ],
    extras_require={
        "dev": [
            "pytest>=6.2.0",
            "pytest-cov>=2.12.0",
            "black>=21.5b0",
            "flake8>=3.9.0",
            "mypy>=0.910",
        ],
    },
)
