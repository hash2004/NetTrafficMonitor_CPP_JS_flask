// Function to fetch and display total packets
async function fetchTotalPackets() {
    try {
        const response = await fetch('/metrics/total_packets');
        const data = await response.json();
        if (data.total_packets !== undefined) {
            document.getElementById('total-packets-count').innerText = data.total_packets;
        } else {
            document.getElementById('total-packets-count').innerText = 'Error loading data';
        }
    } catch (error) {
        console.error('Error fetching total packets:', error);
        document.getElementById('total-packets-count').innerText = 'Error loading data';
    }
}

// Function to fetch and display protocol counts
async function fetchProtocolCounts() {
    try {
        const response = await fetch('/metrics/protocol_counts');
        const data = await response.json();
        const tbody = document.getElementById('protocol-counts-body');
        tbody.innerHTML = ''; // Clear existing data

        if (data.protocol_counts) {
            data.protocol_counts.forEach(protocol => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${protocol.Protocol}</td>
                    <td>${protocol['Packet Count']}</td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="2">Error loading data</td></tr>';
        }
    } catch (error) {
        console.error('Error fetching protocol counts:', error);
        document.getElementById('protocol-counts-body').innerHTML = '<tr><td colspan="2">Error loading data</td></tr>';
    }
}

// Function to fetch and display connections
async function fetchConnections() {
    try {
        const response = await fetch('/metrics/connections');
        const data = await response.json();
        const tbody = document.getElementById('connections-body');
        tbody.innerHTML = ''; // Clear existing data

        if (data.connections) {
            data.connections.forEach(conn => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${conn['Source IP']}</td>
                    <td>${conn['Source Port']}</td>
                    <td>${conn['Source Domain']}</td>
                    <td>${conn['Destination IP']}</td>
                    <td>${conn['Destination Port']}</td>
                    <td>${conn['Destination Domain']}</td>
                    <td>${conn['Protocol']}</td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="7">Error loading data</td></tr>';
        }
    } catch (error) {
        console.error('Error fetching connections:', error);
        document.getElementById('connections-body').innerHTML = '<tr><td colspan="7">Error loading data</td></tr>';
    }
}

// Initialize WebSocket for real-time updates
function initializeWebSocket() {
    const ws = new WebSocket(`ws://${window.location.host}/ws/updates`);

    ws.onopen = () => {
        console.log('WebSocket connection established.');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        switch(message.type) {
            case 'total_packets':
                document.getElementById('total-packets-count').innerText = message.data.total_packets;
                break;
            case 'protocol_counts':
                const protocolTbody = document.getElementById('protocol-counts-body');
                protocolTbody.innerHTML = '';
                message.data.protocol_counts.forEach(protocol => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${protocol.Protocol}</td>
                        <td>${protocol['Packet Count']}</td>
                    `;
                    protocolTbody.appendChild(row);
                });
                break;
            case 'connections':
                const connectionsTbody = document.getElementById('connections-body');
                connectionsTbody.innerHTML = '';
                message.data.connections.forEach(conn => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${conn['Source IP']}</td>
                        <td>${conn['Source Port']}</td>
                        <td>${conn['Source Domain']}</td>
                        <td>${conn['Destination IP']}</td>
                        <td>${conn['Destination Port']}</td>
                        <td>${conn['Destination Domain']}</td>
                        <td>${conn['Protocol']}</td>
                    `;
                    connectionsTbody.appendChild(row);
                });
                break;
            default:
                console.warn('Unknown message type:', message.type);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket connection closed. Attempting to reconnect in 5 seconds...');
        setTimeout(initializeWebSocket, 5000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        ws.close();
    };
}

// Initial data fetch
fetchTotalPackets();
fetchProtocolCounts();
fetchConnections();

// Initialize WebSocket for real-time updates
initializeWebSocket();

// Optionally, set intervals to periodically refresh data
// setInterval(fetchTotalPackets, 5000);
// setInterval(fetchProtocolCounts, 5000);
// setInterval(fetchConnections, 5000);
