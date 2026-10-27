Lokale MediaPipe-Dateien (keine Netzwerkzugriffe zur Laufzeit):
- vision_wasm_internal.js / .wasm  → aus node_modules/@mediapipe/tasks-vision/wasm (Version siehe package.json)
- selfie_segmenter.tflite           → https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite
Bei einem Update von @mediapipe/tasks-vision die wasm-Dateien erneut kopieren.
