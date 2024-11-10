# NetTrafficMonitor_CPP_JS_fastapi

TO RUN THE CPP CODE:
g++ -std=c++11 src/network_monitor.cpp -lpcap -pthread -o network_monitor

sudo ./network_monitor

TO GET THE FRONTEND RUNNING:
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
