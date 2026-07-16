use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Quality benchmark test case
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestCase {
    pub id: String,
    pub name: String,
    pub prompt: String,
    pub expected_output: String,
    pub category: String,
}

/// Dataset collection for quality benchmarking
pub struct BenchmarkDataset {
    pub name: String,
    pub description: String,
    pub cases: Vec<TestCase>,
}

impl BenchmarkDataset {
    /// Create MBPP sample dataset (Python benchmarks)
    pub fn mbpp_sample() -> Self {
        let cases = vec![
            TestCase {
                id: "mbpp_1".to_string(),
                name: "Sum of Even Numbers".to_string(),
                prompt: "Write a Python function to return the sum of even numbers from 1 to n.".to_string(),
                expected_output: "def sum_even(n): return sum(i for i in range(2, n+1, 2))".to_string(),
                category: "arithmetic".to_string(),
            },
            TestCase {
                id: "mbpp_2".to_string(),
                name: "Check Palindrome".to_string(),
                prompt: "Write a Python function to check if a string is a palindrome.".to_string(),
                expected_output: "def is_palindrome(s): return s == s[::-1]".to_string(),
                category: "string".to_string(),
            },
            TestCase {
                id: "mbpp_3".to_string(),
                name: "Find Prime Numbers".to_string(),
                prompt: "Write a Python function to find all prime numbers up to n.".to_string(),
                expected_output: "def find_primes(n): return [i for i in range(2, n+1) if all(i%j != 0 for j in range(2, int(i**0.5)+1))]".to_string(),
                category: "arithmetic".to_string(),
            },
            TestCase {
                id: "mbpp_4".to_string(),
                name: "Reverse List".to_string(),
                prompt: "Write a Python function to reverse a list in place.".to_string(),
                expected_output: "def reverse_list(lst): lst.reverse()".to_string(),
                category: "list".to_string(),
            },
            TestCase {
                id: "mbpp_5".to_string(),
                name: "Find Maximum in Array".to_string(),
                prompt: "Write a Python function to find the maximum element in an array without using built-in max().".to_string(),
                expected_output: "def find_max(arr): return max(arr) if arr else None".to_string(),
                category: "array".to_string(),
            },
        ];

        Self {
            name: "MBPP Sample".to_string(),
            description: "Python benchmarking dataset - sample of 5 problems".to_string(),
            cases,
        }
    }

    /// Create HumanEval sample dataset
    pub fn humaneval_sample() -> Self {
        let cases = vec![
            TestCase {
                id: "he_1".to_string(),
                name: "HumanEval/0 - Sum Range".to_string(),
                prompt: "def sum_of_range(n):\n    \"\"\"Sum all integers from 1 to n inclusive.\"\"\"\n    return n\n\ndef test():\n    assert sum_of_range(5) == 15\n    assert sum_of_range(10) == 55".to_string(),
                expected_output: "return sum(range(1, n+1))".to_string(),
                category: "arithmetic".to_string(),
            },
            TestCase {
                id: "he_2".to_string(),
                name: "HumanEval/1 - Longest String".to_string(),
                prompt: "def longest_string(strings):\n    \"\"\"Return the longest string from a list.\"\"\"\n    pass".to_string(),
                expected_output: "return max(strings, key=len) if strings else None".to_string(),
                category: "string".to_string(),
            },
            TestCase {
                id: "he_3".to_string(),
                name: "HumanEval/2 - Fibonacci".to_string(),
                prompt: "def fibonacci(n):\n    \"\"\"Return the n-th Fibonacci number.\"\"\"\n    pass".to_string(),
                expected_output: "if n <= 1: return n\n    return fibonacci(n-1) + fibonacci(n-2)".to_string(),
                category: "recursion".to_string(),
            },
            TestCase {
                id: "he_4".to_string(),
                name: "HumanEval/3 - Sort Pairs".to_string(),
                prompt: "def sort_pairs(pairs):\n    \"\"\"Sort a list of pairs by their second element.\"\"\"\n    pass".to_string(),
                expected_output: "return sorted(pairs, key=lambda x: x[1])".to_string(),
                category: "sorting".to_string(),
            },
            TestCase {
                id: "he_5".to_string(),
                name: "HumanEval/4 - Remove Duplicates".to_string(),
                prompt: "def remove_duplicates(lst):\n    \"\"\"Remove duplicate elements while preserving order.\"\"\"\n    pass".to_string(),
                expected_output: "seen = set()\n    return [x for x in lst if not (x in seen or seen.add(x))]".to_string(),
                category: "list".to_string(),
            },
        ];

        Self {
            name: "HumanEval Sample".to_string(),
            description: "HumanEval dataset - sample of 5 problems".to_string(),
            cases,
        }
    }

    /// Load dataset from JSON file
    pub fn load_from_file(path: &Path) -> Result<Self> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| anyhow!("Failed to read dataset file: {}", e))?;

        serde_json::from_str(&content)
            .map_err(|e| anyhow!("Failed to parse dataset JSON: {}", e))
    }

    /// Save dataset to JSON file
    pub fn save_to_file(&self, path: &Path) -> Result<()> {
        let json = serde_json::to_string_pretty(self)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    /// Get number of test cases
    pub fn len(&self) -> usize {
        self.cases.len()
    }

    /// Check if dataset is empty
    pub fn is_empty(&self) -> bool {
        self.cases.is_empty()
    }

    /// Filter test cases by category
    pub fn filter_by_category(&self, category: &str) -> Vec<&TestCase> {
        self.cases.iter().filter(|tc| tc.category == category).collect()
    }
}

impl Serialize for BenchmarkDataset {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        #[derive(Serialize)]
        struct Dataset<'a> {
            name: &'a str,
            description: &'a str,
            cases: &'a [TestCase],
        }

        Dataset {
            name: &self.name,
            description: &self.description,
            cases: &self.cases,
        }
        .serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for BenchmarkDataset {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct Dataset {
            name: String,
            description: String,
            cases: Vec<TestCase>,
        }

        let dataset = Dataset::deserialize(deserializer)?;
        Ok(BenchmarkDataset {
            name: dataset.name,
            description: dataset.description,
            cases: dataset.cases,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mbpp_sample() {
        let dataset = BenchmarkDataset::mbpp_sample();
        assert_eq!(dataset.len(), 5);
        assert!(!dataset.is_empty());
    }

    #[test]
    fn test_humaneval_sample() {
        let dataset = BenchmarkDataset::humaneval_sample();
        assert_eq!(dataset.len(), 5);
    }

    #[test]
    fn test_filter_by_category() {
        let dataset = BenchmarkDataset::mbpp_sample();
        let arithmetic = dataset.filter_by_category("arithmetic");
        assert_eq!(arithmetic.len(), 2);
    }

    #[test]
    fn test_dataset_serialization() {
        let dataset = BenchmarkDataset::mbpp_sample();
        let json = serde_json::to_string(&dataset).unwrap();
        assert!(json.contains("MBPP Sample"));
    }
}
