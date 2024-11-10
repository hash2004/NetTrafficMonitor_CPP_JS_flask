// Initialize charts
let totalPacketsData = [];
let packetRateData = [];
let totalPacketsChart;
let packetRateChart;
let protocolCountsChart;

// Function to initialize the total packets chart
function initializeTotalPacketsChart() {
    const svg = d3.select("#totalPacketsChart"),
        margin = {top: 20, right: 20, bottom: 50, left: 50},
        width = +svg.attr("width") - margin.left - margin.right,
        height = +svg.attr("height") - margin.top - margin.bottom;

    const chart = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleTime().range([0, width]);
    const y = d3.scaleLinear().range([height, 0]);

    // Axes
    const xAxis = d3.axisBottom(x).tickFormat(d3.timeFormat("%H:%M:%S"));
    const yAxis = d3.axisLeft(y);

    // Line generator
    const line = d3.line()
        .x(d => x(d.time))
        .y(d => y(d.value));

    // Append axes
    chart.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`);

    chart.append("g")
        .attr("class", "y-axis");

    // Store references for updates
    totalPacketsChart = {
        svg: svg,
        chart: chart,
        x: x,
        y: y,
        xAxis: xAxis,
        yAxis: yAxis,
        line: line,
        width: width,
        height: height
    };
}

// Function to update the total packets chart
function updateTotalPacketsChart() {
    const chart = totalPacketsChart;

    // Update scales
    chart.x.domain(d3.extent(totalPacketsData, d => d.time));
    chart.y.domain([0, d3.max(totalPacketsData, d => d.value)]);

    // Update axes
    chart.chart.select(".x-axis")
        .call(chart.xAxis)
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    chart.chart.select(".y-axis")
        .call(chart.yAxis);

    // Bind data
    const linePath = chart.chart.selectAll(".total-packets-line")
        .data([totalPacketsData]);

    // Update existing line
    linePath
        .attr("d", chart.line);

    // Enter new line if not exists
    linePath.enter()
        .append("path")
        .attr("class", "line total-packets-line")
        .attr("d", chart.line)
        .style("stroke", "steelblue");
}

// Function to initialize the packet rate chart
function initializePacketRateChart() {
    const svg = d3.select("#packetRateChart"),
        margin = {top: 20, right: 20, bottom: 50, left: 50},
        width = +svg.attr("width") - margin.left - margin.right,
        height = +svg.attr("height") - margin.top - margin.bottom;

    const chart = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleTime().range([0, width]);
    const y = d3.scaleLinear().range([height, 0]);

    // Axes
    const xAxis = d3.axisBottom(x).tickFormat(d3.timeFormat("%H:%M:%S"));
    const yAxis = d3.axisLeft(y);

    // Line generator
    const line = d3.line()
        .x(d => x(d.time))
        .y(d => y(d.value));

    // Append axes
    chart.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`);

    chart.append("g")
        .attr("class", "y-axis");

    // Store references for updates
    packetRateChart = {
        svg: svg,
        chart: chart,
        x: x,
        y: y,
        xAxis: xAxis,
        yAxis: yAxis,
        line: line,
        width: width,
        height: height
    };
}

// Function to update the packet rate chart
function updatePacketRateChart() {
    const chart = packetRateChart;

    // Update scales
    chart.x.domain(d3.extent(packetRateData, d => d.time));
    chart.y.domain([0, d3.max(packetRateData, d => d.value)]);

    // Update axes
    chart.chart.select(".x-axis")
        .call(chart.xAxis)
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    chart.chart.select(".y-axis")
        .call(chart.yAxis);

    // Bind data
    const linePath = chart.chart.selectAll(".packet-rate-line")
        .data([packetRateData]);

    // Update existing line
    linePath
        .attr("d", chart.line);

    // Enter new line if not exists
    linePath.enter()
        .append("path")
        .attr("class", "line packet-rate-line")
        .attr("d", chart.line)
        .style("stroke", "orange");
}

// Function to fetch and update total packets data
let previousTotalPackets = null;
let previousTime = null;

function fetchTotalPacketsData() {
    return fetch('/metrics/total_packets')
        .then(response => response.json())
        .then(data => {
            if (data.total_packets !== undefined) {
                const now = new Date();
                const totalPackets = data.total_packets;
                totalPacketsData.push({ time: now, value: totalPackets });

                // Keep only the last 60 data points
                if (totalPacketsData.length > 60) {
                    totalPacketsData.shift();
                }

                if (totalPacketsChart) {
                    updateTotalPacketsChart();
                }

                // Calculate packet rate
                if (previousTotalPackets !== null && previousTime !== null) {
                    const timeDiff = (now - previousTime) / 1000; // Time difference in seconds
                    const packetDiff = totalPackets - previousTotalPackets;
                    const rate = packetDiff / timeDiff; // Packets per second

                    packetRateData.push({ time: now, value: rate });

                    // Keep only the last 60 data points
                    if (packetRateData.length > 60) {
                        packetRateData.shift();
                    }

                    if (packetRateChart) {
                        updatePacketRateChart();
                    }
                }

                previousTotalPackets = totalPackets;
                previousTime = now;
            }
        })
        .catch(error => console.error('Error fetching total packets data:', error));
}

// Rest of the code remains the same...

// Function to initialize the protocol counts chart
function initializeProtocolCountsChart() {
    const svg = d3.select("#protocolCountsChart"),
        width = +svg.attr("width"),
        height = +svg.attr("height"),
        radius = Math.min(width, height) / 2;

    const chart = svg.append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    // Store references for updates
    protocolCountsChart = {
        svg: svg,
        chart: chart,
        radius: radius,
        color: d3.scaleOrdinal(d3.schemeCategory10)
    };
}

// Function to update the protocol counts chart
function updateProtocolCountsChart() {
    fetch('/metrics/protocol_counts')
        .then(response => response.json())
        .then(data => {
            if (data.protocol_counts) {
                const chart = protocolCountsChart;

                // Remove existing chart elements
                chart.chart.selectAll("*").remove();

                const pie = d3.pie()
                    .sort(null)
                    .value(d => d['Packet Count']);

                const path = d3.arc()
                    .outerRadius(chart.radius - 10)
                    .innerRadius(0);

                const label = d3.arc()
                    .outerRadius(chart.radius - 40)
                    .innerRadius(chart.radius - 40);

                const dataReady = pie(data.protocol_counts);

                const arcs = chart.chart.selectAll(".arc")
                    .data(dataReady)
                    .enter().append("g")
                    .attr("class", "arc");

                arcs.append("path")
                    .attr("d", path)
                    .attr("fill", d => chart.color(d.data.Protocol));

                arcs.append("text")
                    .attr("transform", d => `translate(${label.centroid(d)})`)
                    .attr("dy", "0.35em")
                    .style("fill", "#fff")
                    .style("font-size", "12px")
                    .text(d => d.data.Protocol);
            }
        })
        .catch(error => console.error('Error fetching protocol counts:', error));
}

// Function to fetch and display connections
async function fetchConnections() {
    try {
        const response = await fetch('/metrics/connections');
        const data = await response.json();

        // Initialize DataTable if not already initialized
        if (!$.fn.dataTable.isDataTable('#connections-table')) {
            $('#connections-table').DataTable({
                data: [],
                columns: [
                    { title: "Source IP" },
                    { title: "Source Port" },
                    { title: "Source Domain" },
                    { title: "Destination IP" },
                    { title: "Destination Port" },
                    { title: "Destination Domain" },
                    { title: "Protocol" }
                ],
                autoWidth: false,
                scrollX: true,
                paging: false,
                searching: false,
                info: false
            });
        }

        const table = $('#connections-table').DataTable();
        table.clear();

        if (data.connections) {
            data.connections.forEach(conn => {
                table.row.add([
                    conn['Source IP'],
                    conn['Source Port'],
                    conn['Source Domain'],
                    conn['Destination IP'],
                    conn['Destination Port'],
                    conn['Destination Domain'],
                    conn['Protocol']
                ]);
            });
            table.draw();
        }
    } catch (error) {
        console.error('Error fetching connections:', error);
    }
}

// Initialize everything when the document is ready
$(document).ready(function() {
    // Initialize charts
    initializeTotalPacketsChart();
    initializePacketRateChart();
    initializeProtocolCountsChart();

    // Fetch initial data and then set intervals
    fetchTotalPacketsData();
    setInterval(fetchTotalPacketsData, 1000); // Every second

    updateProtocolCountsChart();
    setInterval(updateProtocolCountsChart, 5000); // Every 5 seconds

    fetchConnections();
    setInterval(fetchConnections, 5000); // Every 5 seconds
});
