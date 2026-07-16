use std::path::{Path, PathBuf};
use crate::cli::{Result, AppError};
use crate::inference::{InferenceEngine, InferenceClient, InferenceRequest};
use tracing::info;

#[derive(Clone)]
pub enum ModelSource {
    Ollama { model_id: String },
    LmStudio { model_id: String },
    LlamaCpp { model_id: String },
    LocalFile { path: PathBuf },
    HuggingFace { model_id: String },
}

#[derive(Clone)]
pub struct Model {
    pub name: String,
    pub model_type: String,
    pub source: ModelSource,
    pub parameters: Option<usize>,
}

impl Model {
    /// Load a model from various sources
    /// Supported formats:
    /// - "ollama:mistral" - Ollama model
    /// - "lmstudio:model-name" - LM Studio model
    /// - "llama-cpp:model-name" - llama.cpp model
    /// - "hf://mistralai/Mistral-7B" - HuggingFace model
    /// - "/path/to/model.gguf" - Local file
    pub fn load(identifier: &str) -> Result<Self> {
        info!("Loading model: {}", identifier);

        let (source, name) = if identifier.starts_with("ollama:") {
            let model_id = identifier.strip_prefix("ollama:").unwrap().to_string();
            (ModelSource::Ollama { model_id: model_id.clone() }, model_id)
        } else if identifier.starts_with("lmstudio:") {
            let model_id = identifier.strip_prefix("lmstudio:").unwrap().to_string();
            (ModelSource::LmStudio { model_id: model_id.clone() }, model_id)
        } else if identifier.starts_with("llama-cpp:") {
            let model_id = identifier.strip_prefix("llama-cpp:").unwrap().to_string();
            (ModelSource::LlamaCpp { model_id: model_id.clone() }, model_id)
        } else if identifier.starts_with("hf://") {
            let model_id = identifier.strip_prefix("hf://").unwrap().to_string();
            (ModelSource::HuggingFace { model_id: model_id.clone() }, model_id)
        } else {
            let path = Path::new(identifier);
            if !path.exists() {
                return Err(AppError(format!("Model path does not exist: {}", identifier)));
            }
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();
            (ModelSource::LocalFile { path: path.to_path_buf() }, name)
        };

        let model_type = match &source {
            ModelSource::Ollama { .. } => "ollama".to_string(),
            ModelSource::LmStudio { .. } => "lm-studio".to_string(),
            ModelSource::LlamaCpp { .. } => "llama-cpp".to_string(),
            ModelSource::HuggingFace { .. } => "huggingface".to_string(),
            ModelSource::LocalFile { path } => {
                path.extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("unknown")
                    .to_string()
            }
        };

        Ok(Self {
            name,
            model_type,
            source,
            parameters: None,
        })
    }

    /// Get the model source as a string
    pub fn source_str(&self) -> String {
        match &self.source {
            ModelSource::Ollama { model_id } => format!("ollama:{}", model_id),
            ModelSource::LmStudio { model_id } => format!("lmstudio:{}", model_id),
            ModelSource::LlamaCpp { model_id } => format!("llama-cpp:{}", model_id),
            ModelSource::HuggingFace { model_id } => format!("hf://{}", model_id),
            ModelSource::LocalFile { path } => path.display().to_string(),
        }
    }

    /// Infer text using the model (async version required)
    pub async fn infer(&self, prompt: &str) -> Result<String> {
        match &self.source {
            ModelSource::Ollama { model_id } => {
                self.infer_ollama(model_id, prompt).await
            }
            ModelSource::LmStudio { model_id } => {
                self.infer_lm_studio(model_id, prompt).await
            }
            ModelSource::LlamaCpp { model_id } => {
                self.infer_llama_cpp(model_id, prompt).await
            }
            ModelSource::HuggingFace { .. } => {
                Err(AppError("HuggingFace inference not yet implemented".to_string()))
            }
            ModelSource::LocalFile { .. } => {
                Err(AppError("Local file inference requires model-specific loader".to_string()))
            }
        }
    }

    async fn infer_ollama(&self, model_id: &str, prompt: &str) -> Result<String> {
        let engine = InferenceEngine::ollama(None);
        let client = InferenceClient::new(engine);

        if !client.health_check().await? {
            return Err(AppError("Ollama server not responding at localhost:11434".to_string()));
        }

        let request = InferenceRequest {
            prompt: prompt.to_string(),
            model: model_id.to_string(),
            max_tokens: None,
            temperature: None,
        };

        let response = client.infer(request).await?;
        Ok(response.response)
    }

    async fn infer_lm_studio(&self, model_id: &str, prompt: &str) -> Result<String> {
        let engine = InferenceEngine::lm_studio(None);
        let client = InferenceClient::new(engine);

        if !client.health_check().await? {
            return Err(AppError("LM Studio not responding at localhost:1234".to_string()));
        }

        let request = InferenceRequest {
            prompt: prompt.to_string(),
            model: model_id.to_string(),
            max_tokens: None,
            temperature: None,
        };

        let response = client.infer(request).await?;
        Ok(response.response)
    }

    async fn infer_llama_cpp(&self, _model_id: &str, prompt: &str) -> Result<String> {
        let engine = InferenceEngine::llama_cpp(None);
        let client = InferenceClient::new(engine);

        if !client.health_check().await? {
            return Err(AppError("llama.cpp not responding at localhost:8000".to_string()));
        }

        let request = InferenceRequest {
            prompt: prompt.to_string(),
            model: String::new(),
            max_tokens: None,
            temperature: None,
        };

        let response = client.infer(request).await?;
        Ok(response.response)
    }

    pub fn info(&self) -> Result<String> {
        let source = self.source_str();
        let info = format!(
            "Model Information:\n  Name: {}\n  Type: {}\n  Source: {}\n  Parameters: {}",
            self.name,
            self.model_type,
            source,
            self.parameters
                .map(|p| format!("{}M", p))
                .unwrap_or_else(|| "Unknown".to_string())
        );
        Ok(info)
    }
}
