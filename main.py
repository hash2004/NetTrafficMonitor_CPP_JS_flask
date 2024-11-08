from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os
import asyncio
import json
from typing import List
from pathlib import Path
from fastapi.staticfiles import StaticFiles  # Ensure this import is present

app = FastAPI()

# Allow CORS for frontend development (adjust origins as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update this to your frontend's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FOLDER = Path("data")
app.mount("/static", StaticFiles(directory="frontend"), name="static")

# Endpoint to serve the frontend (optional)
@app.get("/", response_class=HTMLResponse)
async def get_frontend():
    return FileResponse("frontend/index.html")

@app.get("/metrics/total_packets")
async def get_total_packets():
    total_packets_path = DATA_FOLDER / "total_packets.csv"
    if not total_packets_path.exists():
        return {"error": "Total packets data not available."}
    try:
        df = pd.read_csv(total_packets_path)
        if 'Value' in df.columns:
            total_packets = int(df['Value'][0])
            return {"total_packets": total_packets}
        else:
            return {"error": "'Value' column not found in total_packets.csv"}
    except Exception as e:
        return {"error": str(e)}


@app.get("/metrics/protocol_counts")
async def get_protocol_counts():
    protocol_counts_path = DATA_FOLDER / "protocol_counts.csv"
    if not protocol_counts_path.exists():
        return {"error": "Protocol counts data not available."}
    try:
        df = pd.read_csv(protocol_counts_path)
        protocols = df.to_dict(orient='records')
        return {"protocol_counts": protocols}
    except Exception as e:
        return {"error": str(e)}

@app.get("/metrics/connections")
async def get_connections():
    connections_path = DATA_FOLDER / "connections.csv"
    if not connections_path.exists():
        return {"error": "Connections data not available."}
    try:
        df = pd.read_csv(connections_path)
        connections = df.to_dict(orient='records')
        return {"connections": connections}
    except Exception as e:
        return {"error": str(e)}

# WebSocket Manager to handle multiple connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket connected: {len(self.active_connections)} clients connected.")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"WebSocket disconnected: {len(self.active_connections)} clients connected.")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # Handle broken connections
                self.disconnect(connection)

manager = ConnectionManager()

@app.websocket("/ws/updates")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection open
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Background task to watch for CSV updates and broadcast to clients
async def watch_files():
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
                        await manager.broadcast(json.dumps({"type": "total_packets", "data": data}))
                    else:
                        print("Unexpected format in total_packets.csv")
            
            # Check Protocol Counts
            protocol_counts_path = DATA_FOLDER / "protocol_counts.csv"
            if protocol_counts_path.exists():
                mod_time = protocol_counts_path.stat().st_mtime
                if last_mod_times["protocol_counts"] != mod_time:
                    last_mod_times["protocol_counts"] = mod_time
                    df = pd.read_csv(protocol_counts_path)
                    protocols = df.to_dict(orient='records')
                    data = {"protocol_counts": protocols}
                    await manager.broadcast(json.dumps({"type": "protocol_counts", "data": data}))
            
            # Check Connections
            connections_path = DATA_FOLDER / "connections.csv"
            if connections_path.exists():
                mod_time = connections_path.stat().st_mtime
                if last_mod_times["connections"] != mod_time:
                    last_mod_times["connections"] = mod_time
                    df = pd.read_csv(connections_path)
                    connections = df.to_dict(orient='records')
                    data = {"connections": connections}
                    await manager.broadcast(json.dumps({"type": "connections", "data": data}))
        
        except Exception as e:
            print(f"Error watching files: {e}")
        
        await asyncio.sleep(1)  # Check every second


# Start the background task when the app starts
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(watch_files())


