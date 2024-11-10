from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import pandas as pd
import os
import threading
import time
import json
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='frontend', static_url_path='/static')

CORS(app, resources={r"/*": {"origins": "*"}})

socketio = SocketIO(app, cors_allowed_origins="*")

DATA_FOLDER = Path("data")


@app.route('/', methods=['GET'])
def serve_frontend():
    return send_from_directory('frontend', 'index.html')

@app.route('/metrics/total_packets', methods=['GET'])
def get_total_packets():
    total_packets_path = DATA_FOLDER / "total_packets.csv"
    if not total_packets_path.exists():
        return jsonify({"error": "Total packets data not available."}), 404
    try:
        df = pd.read_csv(total_packets_path)
        if 'Value' in df.columns:
            total_packets = int(df['Value'][0])
            return jsonify({"total_packets": total_packets})
        else:
            return jsonify({"error": "'Value' column not found in total_packets.csv"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/metrics/protocol_counts', methods=['GET'])
def get_protocol_counts():
    protocol_counts_path = DATA_FOLDER / "protocol_counts.csv"
    if not protocol_counts_path.exists():
        return jsonify({"error": "Protocol counts data not available."}), 404
    try:
        df = pd.read_csv(protocol_counts_path)
        protocols = df.to_dict(orient='records')
        return jsonify({"protocol_counts": protocols})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/metrics/connections', methods=['GET'])
def get_connections():
    connections_path = DATA_FOLDER / "connections.csv"
    if not connections_path.exists():
        return jsonify({"error": "Connections data not available."}), 404
    try:
        df = pd.read_csv(connections_path)
        connections = df.to_dict(orient='records')
        return jsonify({"connections": connections})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# WebSocket Events

@socketio.on('connect')
def handle_connect():
    logger.info(f"WebSocket connected: {threading.active_count()} clients connected.")
    emit('connection_response', {'message': 'Connected to server.'})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"WebSocket disconnected: {threading.active_count()} clients connected.")

# Background File Watching Thread

def watch_files():
    last_mod_times = {
        "total_packets": None,
        "protocol_counts": None,
        "connections": None
    }
    while True:
        try:
            # Check Total Packets
            total_packets_path = DATA_FOLDER / "total_packets.csv"
            if total_packets_path.exists():
                mod_time = total_packets_path.stat().st_mtime
                if last_mod_times["total_packets"] != mod_time:
                    last_mod_times["total_packets"] = mod_time
                    df = pd.read_csv(total_packets_path)
                    
                    if not df.empty and "Value" in df.columns:
                        total_packets = int(df['Value'][0])
                        data = {"total_packets": total_packets}
                        socketio.emit('update', {"type": "total_packets", "data": data}, broadcast=True)
                        logger.info("Emitted total_packets update.")
                    else:
                        logger.warning("Unexpected format in total_packets.csv")

            # Check Protocol Counts
            protocol_counts_path = DATA_FOLDER / "protocol_counts.csv"
            if protocol_counts_path.exists():
                mod_time = protocol_counts_path.stat().st_mtime
                if last_mod_times["protocol_counts"] != mod_time:
                    last_mod_times["protocol_counts"] = mod_time
                    df = pd.read_csv(protocol_counts_path)
                    protocols = df.to_dict(orient='records')
                    data = {"protocol_counts": protocols}
                    socketio.emit('update', {"type": "protocol_counts", "data": data}, broadcast=True)
                    logger.info("Emitted protocol_counts update.")

            # Check Connections
            connections_path = DATA_FOLDER / "connections.csv"
            if connections_path.exists():
                mod_time = connections_path.stat().st_mtime
                if last_mod_times["connections"] != mod_time:
                    last_mod_times["connections"] = mod_time
                    df = pd.read_csv(connections_path)
                    connections = df.to_dict(orient='records')
                    data = {"connections": connections}
                    socketio.emit('update', {"type": "connections", "data": data}, broadcast=True)
                    logger.info("Emitted connections update.")

        except Exception as e:
            logger.error(f"Error watching files: {e}")

        time.sleep(1)  # Check every second

def start_background_thread():
    logger.info("Starting background file watching thread.")
    thread = threading.Thread(target=watch_files)
    thread.daemon = True
    thread.start()

@app.before_first_request
def before_first_request():
    start_background_thread()

if __name__ == '__main__':
    import eventlet
    eventlet.monkey_patch()
    logger.info("Starting Flask-SocketIO server on http://0.0.0.0:8000")
    socketio.run(app, host='0.0.0.0', port=8000)
