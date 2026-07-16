use anyhow::{anyhow, Result};
use tokenizers::Tokenizer;

/// Token counter wrapper for counting tokens in text
pub struct TokenCounter {
    tokenizer: Option<Tokenizer>,
}

impl TokenCounter {
    /// Create a new token counter, attempting to load a tokenizer for the model
    pub fn new(model_name: Option<&str>) -> Self {
        let tokenizer = model_name.and_then(|name| {
            // Try to load common model tokenizers from HuggingFace
            let repo_id = match name.to_lowercase() {
                n if n.contains("mistral") => Some("mistralai/Mistral-7B"),
                n if n.contains("llama") => Some("meta-llama/Llama-2-7b"),
                n if n.contains("gpt") => Some("openai/gpt2"),
                _ => None,
            };

            repo_id.and_then(|rid| {
                Tokenizer::from_pretrained(rid, None).ok()
            })
        });

        Self { tokenizer }
    }

    /// Count tokens in text
    /// Falls back to approximate count if tokenizer unavailable
    pub fn count_tokens(&self, text: &str) -> Result<usize> {
        match &self.tokenizer {
            Some(tokenizer) => {
                let encoding = tokenizer
                    .encode(text, false)
                    .map_err(|e| anyhow!("Tokenization error: {}", e))?;
                Ok(encoding.get_ids().len())
            }
            None => {
                // Fallback: approximate token count
                // Average ~4 characters per token
                Ok((text.len() + 3) / 4)
            }
        }
    }

    /// Count tokens in a prompt + response pair
    pub fn count_prompt_response(&self, prompt: &str, response: &str) -> Result<(usize, usize, usize)> {
        let prompt_tokens = self.count_tokens(prompt)?;
        let response_tokens = self.count_tokens(response)?;
        let total_tokens = prompt_tokens + response_tokens;

        Ok((prompt_tokens, response_tokens, total_tokens))
    }

    /// Calculate tokens per second
    pub fn tokens_per_second(token_count: usize, duration_secs: f64) -> f64 {
        if duration_secs > 0.0 {
            token_count as f64 / duration_secs
        } else {
            0.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_counter_creation() {
        let counter = TokenCounter::new(None);
        assert!(counter.tokenizer.is_none());
    }

    #[test]
    fn test_approximate_token_count() {
        let counter = TokenCounter::new(None);
        let count = counter.count_tokens("Hello world").unwrap();
        // Approximate: "Hello world" = 11 chars → ~3 tokens
        assert!(count >= 2 && count <= 5);
    }

    #[test]
    fn test_tokens_per_second() {
        let tps = TokenCounter::tokens_per_second(100, 2.0);
        assert_eq!(tps, 50.0);
    }

    #[test]
    fn test_tokens_per_second_zero_duration() {
        let tps = TokenCounter::tokens_per_second(100, 0.0);
        assert_eq!(tps, 0.0);
    }
}
