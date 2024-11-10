// app.js

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

// Initialize Socket.IO for real-time updates
function initializeSocketIO() {
    // Establish a Socket.IO connection
    const socket = io(); // By default, it connects to the host that serves the page

    socket.on('connect', () => {
        console.log('Socket.IO connection established.');
    });

    // Listen for 'update' events from the server
    socket.on('update', (message) => {
        console.log('Received update:', message); // Debugging line
        const { type, data } = message;
        switch(type) {
            case 'total_packets':
                if (data.total_packets !== undefined) {
                    document.getElementById('total-packets-count').innerText = data.total_packets;
                } else {
                    document.getElementById('total-packets-count').innerText = 'Error loading data';
                }
                break;
            case 'protocol_counts':
                const protocolTbody = document.getElementById('protocol-counts-body');
                protocolTbody.innerHTML = '';
                if (data.protocol_counts) {
                    data.protocol_counts.forEach(protocol => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${protocol.Protocol}</td>
                            <td>${protocol['Packet Count']}</td>
                        `;
                        protocolTbody.appendChild(row);
                    });
                } else {
                    protocolTbody.innerHTML = '<tr><td colspan="2">Error loading data</td></tr>';
                }
                break;
            case 'connections':
                const connectionsTbody = document.getElementById('connections-body');
                connectionsTbody.innerHTML = '';
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
                        connectionsTbody.appendChild(row);
                    });
                } else {
                    connectionsTbody.innerHTML = '<tr><td colspan="7">Error loading data</td></tr>';
                }
                break;
            default:
                console.warn('Unknown message type:', type);
        }
    });

    socket.on('disconnect', () => {
        console.log('Socket.IO connection closed. Attempting to reconnect in 5 seconds...');
        setTimeout(initializeSocketIO, 5000); // Attempt to reconnect after 5 seconds
    });

    socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
    });
}

fetchTotalPackets();
fetchProtocolCounts();
fetchConnections();

initializeSocketIO();
setInterval(fetchTotalPackets, 1);
setInterval(fetchProtocolCounts, 1);
setInterval(fetchConnections, 1);
