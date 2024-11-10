from fastapi import FastAPI
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles  # Added this import
import pandas as pd
from pathlib import Path

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust as needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FOLDER = Path("data")
app.mount("/static", StaticFiles(directory="frontend"), name="static")

# Endpoint to serve the frontend
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
            total_packets = int(df['Value'].iloc[-1])  # Use latest value
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
