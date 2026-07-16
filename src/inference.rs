use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::info;

/// Unified interface for different model inference engines
#[derive(Clone, Debug)]
pub enum InferenceEngine {
    Ollama { base_url: String },
    LmStudio { base_url: String },
    LlamaCpp { base_url: String },
}

impl InferenceEngine {
    /// Create Ollama engine (default: localhost:11434)
    pub fn ollama(base_url: Option<String>) -> Self {
        Self::Ollama {
            base_url: base_url.unwrap_or_else(|| "http://localhost:11434".to_string()),
        }
    }

    /// Create LM Studio engine (default: localhost:1234)
    pub fn lm_studio(base_url: Option<String>) -> Self {
        Self::LmStudio {
            base_url: base_url.unwrap_or_else(|| "http://localhost:1234".to_string()),
        }
    }

    /// Create llama.cpp engine (default: localhost:8000)
    pub fn llama_cpp(base_url: Option<String>) -> Self {
        Self::LlamaCpp {
            base_url: base_url.unwrap_or_else(|| "http://localhost:8000".to_string()),
        }
    }

    /// Auto-detect engine from port availability
    pub async fn detect() -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(2))
            .build()?;

        // Try Ollama first
        if let Ok(_) = client.get("http://localhost:11434/api/tags").send().await {
            info!("Detected Ollama at localhost:11434");
            return Ok(Self::ollama(None));
        }

        // Try LM Studio
        if let Ok(_) = client
            .get("http://localhost:1234/v1/models")
            .send()
            .await
        {
            info!("Detected LM Studio at localhost:1234");
            return Ok(Self::lm_studio(None));
        }

        // Try llama.cpp
        if let Ok(_) = client
            .get("http://localhost:8000/health")
            .send()
            .await
        {
            info!("Detected llama.cpp at localhost:8000");
            return Ok(Self::llama_cpp(None));
        }

        Err(anyhow!(
            "No inference engine detected. Please start Ollama, LM Studio, or llama.cpp"
        ))
    }

    pub fn base_url(&self) -> &str {
        match self {
            Self::Ollama { base_url } => base_url,
            Self::LmStudio { base_url } => base_url,
            Self::LlamaCpp { base_url } => base_url,
        }
    }
}

/// Request for model inference
#[derive(Debug, Clone, Serialize)]
pub struct InferenceRequest {
    pub prompt: String,
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
}

/// Response from model inference
#[derive(Debug, Clone, Deserialize)]
pub struct InferenceResponse {
    pub response: String,
    pub done: bool,
    #[serde(default)]
    pub prompt_eval_count: usize,
    #[serde(default)]
    pub eval_count: usize,
    #[serde(default)]
    pub total_duration: u64,
}

/// Inference client for calling model services
pub struct InferenceClient {
    engine: InferenceEngine,
    client: Client,
}

impl InferenceClient {
    pub fn new(engine: InferenceEngine) -> Self {
        Self {
            engine,
            client: Client::new(),
        }
    }

    /// Send inference request to the model server
    pub async fn infer(&self, request: InferenceRequest) -> Result<InferenceResponse> {
        let response = match &self.engine {
            InferenceEngine::Ollama { base_url } => {
                self.ollama_infer(base_url, request).await?
            }
            InferenceEngine::LmStudio { base_url } => {
                self.lm_studio_infer(base_url, request).await?
            }
            InferenceEngine::LlamaCpp { base_url } => {
                self.llama_cpp_infer(base_url, request).await?
            }
        };

        Ok(response)
    }

    async fn ollama_infer(
        &self,
        base_url: &str,
        request: InferenceRequest,
    ) -> Result<InferenceResponse> {
        let url = format!("{}/api/generate", base_url);

        let body = serde_json::json!({
            "model": request.model,
            "prompt": request.prompt,
            "stream": false,
            "options": {
                "temperature": request.temperature.unwrap_or(0.7)
            }
        });

        let response = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| anyhow!("Ollama request failed: {}", e))?;

        response
            .json::<InferenceResponse>()
            .await
            .map_err(|e| anyhow!("Failed to parse Ollama response: {}", e))
    }

    async fn lm_studio_infer(
        &self,
        base_url: &str,
        request: InferenceRequest,
    ) -> Result<InferenceResponse> {
        let url = format!("{}/v1/completions", base_url);

        let body = serde_json::json!({
            "model": request.model,
            "prompt": request.prompt,
            "max_tokens": request.max_tokens.unwrap_or(256),
            "temperature": request.temperature.unwrap_or(0.7)
        });

        let response = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| anyhow!("LM Studio request failed: {}", e))?;

        let text = response
            .text()
            .await
            .map_err(|e| anyhow!("Failed to read LM Studio response: {}", e))?;

        // Parse LM Studio's response format
        let parsed: serde_json::Value = serde_json::from_str(&text)
            .map_err(|e| anyhow!("Failed to parse LM Studio JSON: {}", e))?;

        let completion = parsed["choices"][0]["text"]
            .as_str()
            .unwrap_or("")
            .to_string();

        Ok(InferenceResponse {
            response: completion,
            done: true,
            prompt_eval_count: 0,
            eval_count: 0,
            total_duration: 0,
        })
    }

    async fn llama_cpp_infer(
        &self,
        base_url: &str,
        request: InferenceRequest,
    ) -> Result<InferenceResponse> {
        let url = format!("{}/completion", base_url);

        let body = serde_json::json!({
            "prompt": request.prompt,
            "n_predict": request.max_tokens.unwrap_or(256),
            "temperature": request.temperature.unwrap_or(0.7)
        });

        let response = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| anyhow!("llama.cpp request failed: {}", e))?;

        let text = response
            .text()
            .await
            .map_err(|e| anyhow!("Failed to read llama.cpp response: {}", e))?;

        let parsed: serde_json::Value = serde_json::from_str(&text)
            .map_err(|e| anyhow!("Failed to parse llama.cpp JSON: {}", e))?;

        let completion = parsed["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        Ok(InferenceResponse {
            response: completion,
            done: true,
            prompt_eval_count: 0,
            eval_count: 0,
            total_duration: 0,
        })
    }

    /// Check if the server is available
    pub async fn health_check(&self) -> Result<bool> {
        let url = match &self.engine {
            InferenceEngine::Ollama { base_url } => format!("{}/api/tags", base_url),
            InferenceEngine::LmStudio { base_url } => format!("{}/v1/models", base_url),
            InferenceEngine::LlamaCpp { base_url } => format!("{}/health", base_url),
        };

        match self.client.get(&url).send().await {
            Ok(response) => Ok(response.status().is_success()),
            Err(_) => Ok(false),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_creation() {
        let _ollama = InferenceEngine::ollama(None);
        let _lm_studio = InferenceEngine::lm_studio(None);
        let _llama_cpp = InferenceEngine::llama_cpp(None);
    }

    #[tokio::test]
    async fn test_client_creation() {
        let engine = InferenceEngine::ollama(None);
        let _client = InferenceClient::new(engine);
    }
}
