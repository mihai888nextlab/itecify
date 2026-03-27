#!/usr/bin/env python3
import subprocess
import json
import sys
import tempfile
import os
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

ALLOWED_LANGUAGES = {
    'javascript': {
        'extension': 'js',
        'command': ['node', '/code/main.js'],
        'timeout': 10
    },
    'python': {
        'extension': 'py',
        'command': ['python3', '/code/main.py'],
        'timeout': 10
    }
}

ALLOWED_PACKAGES = {
    'python': ['requests', 'numpy', 'pandas']
}

@app.route('/execute', methods=['POST'])
def execute():
    try:
        data = request.json
        code = data.get('code', '')
        language = data.get('language', 'javascript')
        
        if language not in ALLOWED_LANGUAGES:
            return jsonify({
                'success': False,
                'error': f'Language {language} not supported'
            }), 400
        
        lang_config = ALLOWED_LANGUAGES[language]
        
        with tempfile.TemporaryDirectory() as tmpdir:
            code_path = os.path.join(tmpdir, f'main.{lang_config["extension"]}')
            
            with open(code_path, 'w') as f:
                f.write(code)
            
            try:
                result = subprocess.run(
                    lang_config['command'],
                    cwd=tmpdir,
                    capture_output=True,
                    text=True,
                    timeout=lang_config['timeout']
                )
                
                return jsonify({
                    'success': True,
                    'stdout': result.stdout,
                    'stderr': result.stderr,
                    'exitCode': result.returncode,
                    'executionTime': f'{result.returncode == 0}'
                })
                
            except subprocess.TimeoutExpired:
                return jsonify({
                    'success': False,
                    'error': f'Execution timed out after {lang_config["timeout"]} seconds'
                }), 408
            except Exception as e:
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500
                
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
