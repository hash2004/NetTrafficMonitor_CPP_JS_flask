// app.js

// Function to fetch and display total packets (Removed periodic fetches since we're using WebSockets)
async function fetchTotalPackets() {
    try {
        const response = await fetch('/metrics/total_packets');
        const data = await response.json();
        if (data.total_packets !== undefined) {
            document.getElementById('total-packets-count').innerText = data.total_packets;
            updateGlobalStatisticsChart(data.total_packets);
        } else {
            document.getElementById('total-packets-count').innerText = 'Error loading data';
        }
    } catch (error) {
        console.error('Error fetching total packets:', error);
        document.getElementById('total-packets-count').innerText = 'Error loading data';
    }
}

// Function to fetch and display protocol counts (Removed periodic fetches since we're using WebSockets)
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

            // Update the protocol distribution chart
            const protocolData = data.protocol_counts.map(protocol => ({
                protocol: protocol.Protocol,
                count: parseInt(protocol['Packet Count'])
            }));
            updateProtocolDistributionChart(protocolData);
        } else {
            tbody.innerHTML = '<tr><td colspan="2">Error loading data</td></tr>';
        }
    } catch (error) {
        console.error('Error fetching protocol counts:', error);
        document.getElementById('protocol-counts-body').innerHTML = '<tr><td colspan="2">Error loading data</td></tr>';
    }
}

// Function to fetch and display connections (Removed periodic fetches since we're using WebSockets)
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
    const socket = io(); // Ensure the correct URL and port

    socket.on('connect', () => {
        console.log('Socket.IO connection established.');
    });

    socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
    });

    socket.on('disconnect', () => {
        console.log('Socket.IO connection closed.');
    });

    // Listen for 'update' events from the server
    socket.on('update', (message) => {
        console.log('Received update:', message);
        const { type, data } = message;
        switch(type) {
            case 'total_packets':
                if (data.total_packets !== undefined) {
                    updateGlobalStatisticsChart(data.total_packets);
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
                    // Update the protocol distribution chart
                    const protocolData = data.protocol_counts.map(protocol => ({
                        protocol: protocol.Protocol,
                        count: parseInt(protocol['Packet Count'])
                    }));
                    updateProtocolDistributionChart(protocolData);
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
            case 'traffic_rate':
                    if (data.traffic_rate !== undefined) {
                        updateTrafficRateChart(data.traffic_rate);
                    } else {
                        console.warn('Received traffic_rate update with undefined value.');
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

// D3.js Chart Implementations

// 1. Global Statistics (Simple Counter with Animation)
function initializeGlobalStatisticsChart() {
    const svg = d3.select('#global-statistics svg');
    const width = parseInt(svg.style('width')) || 300;
    const height = parseInt(svg.style('height')) || 250;

    svg.attr('width', width)
       .attr('height', height);

    svg.append('text')
        .attr('id', 'global-stat-text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', '48px')
        .attr('fill', '#4CAF50')
        .text('0');
}

function updateGlobalStatisticsChart(value) {
    const svg = d3.select('#global-statistics svg');
    svg.select('#global-stat-text')
        .transition()
        .duration(1000)
        .tween("text", function() {
            const that = d3.select(this);
            const i = d3.interpolateNumber(+that.text(), value);
            return function(t) { that.text(Math.floor(i(t))); };
        });
}

// 2. Protocol Distribution (Donut Chart)
function initializeProtocolDistributionChart() {
    const svg = d3.select('#protocol-distribution svg');
    const width = parseInt(svg.style('width')) || 300;
    const height = parseInt(svg.style('height')) || 250;
    const radius = Math.min(width, height) / 2 - 20;

    svg.attr('width', width)
       .attr('height', height);

    const g = svg.append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);

    g.append('text')
        .attr('class', 'no-data-text')
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .text('No data available');

    // Add Tooltip
    d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
}

function updateProtocolDistributionChart(newData) {
    const svg = d3.select('#protocol-distribution svg');
    const width = parseInt(svg.style('width')) || 300;
    const height = parseInt(svg.style('height')) || 250;
    const radius = Math.min(width, height) / 2 - 20;

    const g = svg.select('g');

    // Remove "No data available" text if data is present
    if (newData.length > 0) {
        g.select('.no-data-text').remove();
    }

    const color = d3.scaleOrdinal()
        .domain(newData.map(d => d.protocol))
        .range(d3.schemeCategory10);

    const pie = d3.pie()
        .sort(null)
        .value(d => d.count);

    const path = d3.arc()
        .outerRadius(radius)
        .innerRadius(radius - 70);

    const arcs = g.selectAll('.arc')
        .data(pie(newData));

    // Update existing arcs
    arcs.select('path')
        .transition()
        .duration(750)
        .attrTween('d', function(d) {
            const interpolate = d3.interpolate(this._current, d);
            this._current = interpolate(0);
            return function(t) {
                return path(interpolate(t));
            };
        })
        .attr('fill', d => color(d.data.protocol));

    // Enter new arcs
    const newArcs = arcs.enter().append('g')
        .attr('class', 'arc');

    newArcs.append('path')
        .attr('d', path)
        .attr('fill', d => color(d.data.protocol))
        .each(function(d) { this._current = d; })
        .on('mouseover', function(event, d) {
            d3.select('.tooltip')
                .transition()
                .duration(200)
                .style('opacity', .9);
            d3.select('.tooltip')
                .html(`${d.data.protocol}: ${d.data.count}`)
                .style('left', (event.pageX) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function() {
            d3.select('.tooltip')
                .transition()
                .duration(500)
                .style('opacity', 0);
        });

    // Remove old arcs
    arcs.exit().remove();
}

// 3. Traffic Rate (Line Chart)
let trafficData = [];

function initializeTrafficRateChart() {
    const svg = d3.select('#traffic-rate svg');
    const width = parseInt(svg.style('width')) - 50 || 250;
    const height = parseInt(svg.style('height')) - 50 || 200;

    width -= 50; // Adjust for margins
    height -= 50;

    svg.attr('width', width + 50)
       .attr('height', height + 50);

    const x = d3.scaleTime().range([0, width]);
    const y = d3.scaleLinear().range([height, 0]);

    const g = svg.append('g')
        .attr('transform', 'translate(40,10)');

    // Define axes
    g.append('g')
        .attr('class', 'x axis')
        .attr('transform', `translate(0,${height})`);

    g.append('g')
        .attr('class', 'y axis');

    // Define the line path
    g.append('path')
        .datum(trafficData)
        .attr('class', 'line')
        .attr('fill', 'none')
        .attr('stroke', '#ff5722')
        .attr('stroke-width', 2);

    // Tooltip
    d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
}

function updateTrafficRateChart(newRate) {
    console.log('Updating traffic rate chart with rate:', newRate); // Add this line

    const svg = d3.select('#traffic-rate svg');
    const width = parseInt(svg.style('width')) - 50 || 250;
    const height = parseInt(svg.style('height')) - 50 || 200;

    const x = d3.scaleTime().range([0, width]);
    const y = d3.scaleLinear().range([height, 0]);

    const line = d3.line()
        .x(d => x(d.time))
        .y(d => y(d.rate));

    const g = svg.select('g');

    // Update data
    const now = new Date();
    trafficData.push({ time: now, rate: newRate });

    // Keep only the last 30 data points
    if (trafficData.length > 30) {
        trafficData.shift();
    }

    // Update scales
    x.domain(d3.extent(trafficData, d => d.time));
    y.domain([0, d3.max(trafficData, d => d.rate) + 10]);

    // Update axes
    g.select('.x.axis')
        .transition()
        .duration(500)
        .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%H:%M:%S")));

    g.select('.y.axis')
        .transition()
        .duration(500)
        .call(d3.axisLeft(y));

    // Update line
    g.select('.line')
        .datum(trafficData)
        .transition()
        .duration(500)
        .attr('d', line);

    // Update dots
    const dots = g.selectAll('.dot')
        .data(trafficData);

    dots.enter().append('circle')
        .attr('class', 'dot')
        .attr('cx', d => x(d.time))
        .attr('cy', d => y(d.rate))
        .attr('r', 4)
        .attr('fill', '#ff5722')
        .on('mouseover', function(event, d) {
            d3.select('.tooltip')
                .transition()
                .duration(200)
                .style('opacity', .9);
            d3.select('.tooltip')
                .html(`Time: ${d3.timeFormat("%H:%M:%S")(d.time)}<br/>Rate: ${d.rate} pkt/s`)
                .style('left', (event.pageX) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function() {
            d3.select('.tooltip')
                .transition()
                .duration(500)
                .style('opacity', 0);
        })
        .merge(dots)
        .transition()
        .duration(500)
        .attr('cx', d => x(d.time))
        .attr('cy', d => y(d.rate));

    dots.exit().remove();
}


// Initialize all charts
function initializeCharts() {
    initializeGlobalStatisticsChart();
    initializeProtocolDistributionChart();
    initializeTrafficRateChart();
}

// Initialize everything after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeCharts();
    fetchTotalPackets();
    fetchProtocolCounts();
    fetchConnections();
    initializeSocketIO();
});
