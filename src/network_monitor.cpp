#include <pcap.h>
#include <iostream>
#include <netinet/ip.h>
#include <netinet/tcp.h>
#include <netinet/udp.h>
#include <arpa/inet.h>
#include <unordered_map>
#include <string>
#include <fstream>
#include <chrono>
#include <thread>
#include <mutex>
#include <vector>
#include <cstring>
#include <netdb.h>    // For getnameinfo
#include <atomic>
#include <sys/stat.h> // For mkdir and stat
#include <sys/types.h>
#include <cerrno>     // For errno

// Structure to hold connection information
struct Connection {
    std::string src_ip;
    uint16_t src_port;
    std::string dst_ip;
    uint16_t dst_port;
    std::string protocol;
    std::string src_domain; // Source domain name
    std::string dst_domain; // Destination domain name
    // Additional fields can be added as needed
};

// Global metrics
struct Metrics {
    uint64_t total_packets = 0;
    std::unordered_map<std::string, uint64_t> protocol_counts;
    std::unordered_map<std::string, Connection> connections;
    std::mutex mtx; // To protect shared data
} metrics;

// Directory to store CSV files
const std::string DATA_FOLDER = "data";

// CSV file paths within the data folder
const std::string TOTAL_PACKETS_CSV = DATA_FOLDER + "/total_packets.csv";
const std::string PROTOCOL_COUNTS_CSV = DATA_FOLDER + "/protocol_counts.csv";
const std::string CONNECTIONS_CSV = DATA_FOLDER + "/connections.csv";

// Global domain cache
std::unordered_map<std::string, std::string> domain_cache;
std::mutex cache_mtx; // Mutex to protect the cache

// Function to check if a directory exists
bool directory_exists(const std::string& path) {
    struct stat info;
    if (stat(path.c_str(), &info) != 0) {
        // Cannot access path
        return false;
    } else if (info.st_mode & S_IFDIR) {
        // Path is a directory
        return true;
    } else {
        // Path exists but is not a directory
        return false;
    }
}

// Function to create a directory
bool create_directory(const std::string& path) {
    #ifdef _WIN32
        // Windows-specific directory creation
        int ret = _mkdir(path.c_str());
    #else
        // Unix/Linux-specific directory creation with permissions rwxr-xr-x
        int ret = mkdir(path.c_str(), 0755);
    #endif
    if (ret == 0) {
        std::cout << "Directory '" << path << "' created successfully.\n";
        return true;
    } else {
        if (errno == EEXIST) {
            std::cout << "Directory '" << path << "' already exists.\n";
        } else {
            std::cerr << "Error creating directory '" << path << "': " << strerror(errno) << "\n";
        }
        return false;
    }
}

// Function to resolve domain names with caching
std::string resolve_domain(const std::string& ip) {
    // Check if the IP is already in the cache
    {
        std::lock_guard<std::mutex> lock(cache_mtx);
        auto it = domain_cache.find(ip);
        if (it != domain_cache.end()) {
            return it->second;
        }
    }

    // If not cached, perform DNS resolution
    struct sockaddr_in sa;
    char host[NI_MAXHOST];
    memset(&sa, 0, sizeof(sa));
    sa.sin_family = AF_INET;
    sa.sin_addr.s_addr = inet_addr(ip.c_str());

    std::string domain = "";
    if (getnameinfo((struct sockaddr*)&sa, sizeof(sa), host, sizeof(host), NULL, 0, 0) == 0) {
        domain = std::string(host);
    }

    // Update the cache
    {
        std::lock_guard<std::mutex> lock(cache_mtx);
        domain_cache[ip] = domain;
    }

    return domain;
}

// Packet processing callback
void packet_handler(u_char *args, const struct pcap_pkthdr *header, const u_char *packet) {
    // Assuming Ethernet + IP
    const struct ip* ip_hdr = (struct ip*)(packet + 14); // Ethernet header is 14 bytes
    std::string src_ip = inet_ntoa(ip_hdr->ip_src);
    std::string dst_ip = inet_ntoa(ip_hdr->ip_dst);

    uint16_t src_port = 0;
    uint16_t dst_port = 0;
    std::string protocol;

    // Determine protocol and extract ports
    if (ip_hdr->ip_p == IPPROTO_TCP) {
        protocol = "TCP";
        const struct tcphdr* tcp_hdr = (struct tcphdr*)(packet + 14 + ip_hdr->ip_hl * 4);
        src_port = ntohs(tcp_hdr->th_sport);
        dst_port = ntohs(tcp_hdr->th_dport);
    } else if (ip_hdr->ip_p == IPPROTO_UDP) {
        protocol = "UDP";
        const struct udphdr* udp_hdr = (struct udphdr*)(packet + 14 + ip_hdr->ip_hl * 4);
        src_port = ntohs(udp_hdr->uh_sport);
        dst_port = ntohs(udp_hdr->uh_dport);
    } else {
        protocol = "Other";
    }

    // Resolve domain names with caching
    std::string src_domain = resolve_domain(src_ip);
    std::string dst_domain = resolve_domain(dst_ip);

    // Update metrics
    std::lock_guard<std::mutex> lock(metrics.mtx);
    metrics.total_packets++;
    metrics.protocol_counts[protocol]++;

    // Identify unique connection by src-dst IP and ports
    std::string connection_key = src_ip + ":" + std::to_string(src_port) + "->" + dst_ip + ":" + std::to_string(dst_port);
    if (metrics.connections.find(connection_key) == metrics.connections.end()) {
        Connection conn;
        conn.src_ip = src_ip;
        conn.src_port = src_port;
        conn.dst_ip = dst_ip;
        conn.dst_port = dst_port;
        conn.protocol = protocol;
        conn.src_domain = src_domain.empty() ? "N/A" : src_domain; // Set source domain
        conn.dst_domain = dst_domain.empty() ? "N/A" : dst_domain; // Set destination domain
        metrics.connections[connection_key] = conn;
    }

    // Optionally, you can store per-connection packet counts, etc.
}

// Function to write metrics to separate CSV files
void write_metrics_to_csv() {
    while (true) {
        std::this_thread::sleep_for(std::chrono::seconds(1));

        std::lock_guard<std::mutex> lock(metrics.mtx);

        // Write Total Packets to total_packets.csv
        std::ofstream total_packets_file(TOTAL_PACKETS_CSV, std::ios::trunc);
        if (!total_packets_file.is_open()) {
            std::cerr << "Failed to open " << TOTAL_PACKETS_CSV << " for writing.\n";
        } else {
            total_packets_file << "Metric,Value\n" << "Total Packets," << metrics.total_packets << "\n";
            total_packets_file.close();
        }

        // Write Protocol Counts to protocol_counts.csv
        std::ofstream protocol_counts_file(PROTOCOL_COUNTS_CSV, std::ios::trunc);
        if (!protocol_counts_file.is_open()) {
            std::cerr << "Failed to open " << PROTOCOL_COUNTS_CSV << " for writing.\n";
        } else {
            protocol_counts_file << "Protocol,Packet Count\n";
            for (const auto& [proto, count] : metrics.protocol_counts) {
                protocol_counts_file << proto << "," << count << "\n";
            }
            protocol_counts_file.close();
        }

        // Write Connections to connections.csv
        std::ofstream connections_file(CONNECTIONS_CSV, std::ios::trunc);
        if (!connections_file.is_open()) {
            std::cerr << "Failed to open " << CONNECTIONS_CSV << " for writing.\n";
        } else {
            connections_file << "Source IP,Source Port,Source Domain,Destination IP,Destination Port,Destination Domain,Protocol\n";
            for (const auto& [key, conn] : metrics.connections) {
                connections_file << conn.src_ip << "," << conn.src_port << "," 
                                 << conn.src_domain << "," 
                                 << conn.dst_ip << "," << conn.dst_port << "," 
                                 << conn.dst_domain << "," 
                                 << conn.protocol << "\n";
            }
            connections_file.close();
        }
    }
}

// Function to list all available network interfaces
std::vector<std::string> list_interfaces() {
    pcap_if_t *alldevs;
    pcap_if_t *d;
    char errbuf[PCAP_ERRBUF_SIZE];
    std::vector<std::string> interfaces;

    if (pcap_findalldevs(&alldevs, errbuf) == -1) {
        std::cerr << "Error finding devices: " << errbuf << "\n";
        return interfaces;
    }

    std::cout << "Available Network Interfaces:\n";
    int i = 0;
    for (d = alldevs; d != nullptr; d = d->next) {
        std::cout << ++i << ". " << (d->description ? d->description : "No description") << " (" << d->name << ")\n";
        interfaces.push_back(d->name);
    }

    pcap_freealldevs(alldevs);
    return interfaces;
}

int main(int argc, char* argv[]) {
    char* dev;
    char errbuf[PCAP_ERRBUF_SIZE];
    std::string interface;

    // Check and create the data directory
    if (!directory_exists(DATA_FOLDER)) {
        std::cout << "Directory '" << DATA_FOLDER << "' does not exist. Attempting to create it...\n";
        if (!create_directory(DATA_FOLDER)) {
            std::cerr << "Failed to create the data directory. Exiting.\n";
            return 1;
        }
    } else {
        std::cout << "Directory '" << DATA_FOLDER << "' already exists.\n";
    }

    if (argc < 2) {
        // List available interfaces
        std::vector<std::string> interfaces = list_interfaces();
        if (interfaces.empty()) {
            std::cerr << "No interfaces found. Exiting.\n";
            return 1;
        }

        // Prompt user to select an interface
        int choice = 0;
        std::cout << "Select the interface to monitor (1-" << interfaces.size() << "): ";
        std::cin >> choice;

        if (choice < 1 || choice > interfaces.size()) {
            std::cerr << "Invalid choice. Exiting.\n";
            return 1;
        }

        interface = interfaces[choice - 1];
        dev = const_cast<char*>(interface.c_str());
    } else {
        dev = argv[1];
    }

    std::cout << "Monitoring interface: " << dev << "\n";

    // Open the device for capturing
    pcap_t* handle = pcap_open_live(dev, BUFSIZ, 1, 1000, errbuf);
    if (handle == nullptr) {
        std::cerr << "Couldn't open device " << dev << ": " << errbuf << "\n";
        return 2;
    }

    // Start a thread to write metrics to CSV
    std::thread writer_thread(write_metrics_to_csv);
    writer_thread.detach();

    // Start capturing packets
    pcap_loop(handle, 0, packet_handler, nullptr);

    pcap_close(handle);
    return 0;
}
