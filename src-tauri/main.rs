// Tauri backend for LLM Bench GUI
#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

use tauri::State;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

// Shared state for benchmark results
struct AppState {
    results: Arc<Mutex<HashMap<String, String>>>,
}

#[tauri::command]
async fn run_benchmark(
    model: String,
    iterations: usize,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let result = format!(
        "Benchmarking {} for {} iterations...\nThis would call the llm-bench CLI backend.",
        model, iterations
    );

    let mut results = state.results.lock().unwrap();
    results.insert(model.clone(), result.clone());

    Ok(result)
}

#[tauri::command]
async fn list_models() -> Result<Vec<String>, String> {
    Ok(vec![
        "ollama:mistral".to_string(),
        "ollama:neural-chat".to_string(),
        "ollama:orca".to_string(),
        "lmstudio:model-name".to_string(),
        "llama-cpp:model".to_string(),
    ])
}

#[tauri::command]
async fn get_system_info() -> Result<HashMap<String, String>, String> {
    let mut info = HashMap::new();
    info.insert("os".to_string(), "Windows".to_string());
    info.insert("version".to_string(), "0.2.0".to_string());
    info.insert("status".to_string(), "Ready".to_string());
    Ok(info)
}

#[tauri::command]
async fn export_results(format: String, results: String) -> Result<String, String> {
    match format.as_str() {
        "json" => Ok(format!("{{\"results\": {}}}", results)),
        "csv" => Ok("Model,Dataset,Latency\n".to_string() + &results),
        "html" => Ok(format!("<html><body><pre>{}</pre></body></html>", results)),
        _ => Err("Unknown format".to_string()),
    }
}

fn main() {
    let app_state = AppState {
        results: Arc::new(Mutex::new(HashMap::new())),
    };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            run_benchmark,
            list_models,
            get_system_info,
            export_results
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
