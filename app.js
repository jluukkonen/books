// ==========================================================================
// APPLICATION STATE
// ==========================================================================
const state = {
    activeTab: 'network-tab',
    networkThreshold: 4,
    showJesuitsOnly: false,
    selectedNode: null,
    activeYear: 1610,
    searchQuery: '',
    isPlaying: false,
    playInterval: null,
    
    // Raw Datasets
    networkData: null,
    timelineData: null,
    
    // D3 variables
    svg: null,
    simulation: null,
    gContainer: null,
    
    // Leaflet variables
    map: null,
    mapMarkers: [],
    mapLines: [],
    
    // Chart.js instances
    charts: {
        leipzigFrankfurt: null,
        confessional: null,
        language: null
    }
};

// Coordinate database cities with lat/long for leaflet
const cityCoordinates = {
    "Leipzig": [51.3397, 12.3731],
    "Frankfurt am Main": [50.1109, 8.6821],
    "Frankfurt (Oder)": [52.3425, 14.5389],
    "Wittenberg": [51.8669, 12.6427],
    "Köln": [50.9375, 6.9603],
    "Cologne": [50.9375, 6.9603],
    "Nürnberg": [49.4521, 11.0767],
    "Nuremberg": [49.4521, 11.0767],
    "Basel": [47.5596, 7.5886],
    "Jena": [50.9271, 11.5892],
    "Wien": [48.2082, 16.3738],
    "Vienna": [48.2082, 16.3738],
    "Munich": [48.1351, 11.5820],
    "München": [48.1351, 11.5820],
    "Strasbourg": [48.5734, 7.7521],
    "Straßburg": [48.5734, 7.7521],
    "Augsburg": [48.3705, 10.8978],
    "Hamburg": [53.5511, 9.9937],
    "Halle": [51.4970, 11.9688],
    "Dresden": [51.0504, 13.7373],
    "Helmstedt": [52.2275, 11.0095],
    "Rostock": [54.0833, 12.1088],
    "Göttingen": [51.5413, 9.9048],
    "Tübingen": [48.5216, 9.0576],
    "Erfurt": [50.9787, 11.0290],
    "Altdorf": [49.3855, 11.3562],
    "Königsberg": [54.7104, 20.4522],
    "Giessen": [50.5872, 8.6755],
    "Berlin": [52.5200, 13.4050],
    "Magdeburg": [52.1205, 11.6276],
    "Greifswald": [54.0833, 13.3833],
    "Breslau": [51.1079, 17.0385],
    "Marburg": [50.8090, 8.7707],
    "Hannover": [52.3759, 9.7320],
    "Regensburg": [49.0134, 12.1016],
    "Braunschweig": [52.2689, 10.5268],
    "Ingolstadt": [48.7665, 11.4258],
    "Stettin": [53.4285, 14.5528],
    "Zürich": [47.3769, 8.5417],
    "Gotha": [50.9481, 10.7183],
    "Stuttgart": [48.7758, 9.1829],
    "Heidelberg": [49.3988, 8.6724],
    "Altenburg": [50.9850, 12.4333],
    "Mainz": [49.9929, 8.2473],
    "Bremen": [53.0793, 8.8017],
    "Lübeck": [53.8655, 10.6866],
    "Prague": [50.0755, 14.4378],
    "Danzig": [54.3520, 18.6466]
};

// Heuristic to match a network node to a geographic city
function getNodeCity(node) {
    if (!node) return null;
    let searchString = '';
    if (typeof node === 'string') {
        searchString = node.toLowerCase();
    } else {
        searchString = ((node.id || '') + ' ' + (node.biography || '') + ' ' + (node.occupations || '')).toLowerCase();
    }
    for (const city of Object.keys(cityCoordinates)) {
        if (searchString.includes(city.toLowerCase())) {
            return city;
        }
    }
    // Confessional / alternative spelling mappings
    if (searchString.includes('köln') || searchString.includes('cologne')) return 'Köln';
    if (searchString.includes('münchen') || searchString.includes('munich')) return 'München';
    if (searchString.includes('nürnberg') || searchString.includes('nuremberg')) return 'Nürnberg';
    if (searchString.includes('wien') || searchString.includes('vienna')) return 'Wien';
    if (searchString.includes('straßburg') || searchString.includes('strasbourg')) return 'Strasbourg';
    return null;
}

// ==========================================================================
// STARTUP AND INITIALIZATION
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    initControls();
    loadData();
});

// Load resources via Fetch
async function loadData() {
    try {
        const netResponse = await fetch('data/network.json');
        state.networkData = await netResponse.json();
        
        const timelineResponse = await fetch('data/timeline.csv');
        const csvText = await timelineResponse.text();
        state.timelineData = parseCSV(csvText);
        
        // Hide loading spinner and init viz
        document.getElementById('network-loading').classList.add('hidden');
        
        initNetworkGraph();
        initMap();
        initTimelines();
        initSearch();
    } catch (err) {
        console.error("Error loading dashboard data files:", err);
        alert("Failed to load dashboard data files. Check if they are uploaded in the /data folder.");
    }
}

// Custom CSV Parser
function parseCSV(text) {
    const lines = text.split("\n").filter(l => l.trim() !== "");
    const headers = lines[0].split(",");
    
    return lines.slice(1).map(line => {
        // Handle comma splitting (being mindful of potential quoted values)
        const values = line.split(",");
        const row = {};
        headers.forEach((header, index) => {
            row[header.trim()] = values[index] ? values[index].trim() : "";
        });
        return row;
    });
}

// ==========================================================================
// TABS NAVIGATION CONTROLLER
// ==========================================================================
function initTabs() {
    const buttons = document.querySelectorAll(".tab-button");
    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const targetTab = btn.getAttribute("data-tab");
            document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
            document.getElementById(targetTab).classList.add("active");
            
            state.activeTab = targetTab;
            
            // Handle Leaflet re-size re-draw when switching to Map tab
            if (targetTab === 'map-tab' && state.map) {
                setTimeout(() => {
                    state.map.invalidateSize();
                }, 100);
            }
        });
    });
}

// ==========================================================================
// SEARCH & AUTOCOMPLETE CONTROLLER
// ==========================================================================
function initSearch() {
    const searchInput = document.getElementById('search-input');
    const dropdown = document.getElementById('search-results');
    
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        state.searchQuery = val;
        
        if (!val) {
            dropdown.classList.add('hidden');
            return;
        }
        
        // Search nodes in active simulation
        const matches = state.networkData.nodes.filter(n => {
            return n.id.toLowerCase().includes(val) || (n.occupations && n.occupations.toLowerCase().includes(val));
        }).slice(0, 10); // Limit to top 10 matches
        
        if (matches.length === 0) {
            dropdown.innerHTML = '<div class="search-item" style="color:#64748b; cursor:default;">No actors found</div>';
            dropdown.classList.remove('hidden');
            return;
        }
        
        dropdown.innerHTML = matches.map(m => `
            <div class="search-item" data-node-id="${m.id}">
                <span>${m.id}</span>
                <span class="search-type ${m.type === 'censor' ? 'cns' : 'pub'}">${m.type === 'censor' ? 'Censor' : 'Publisher'}</span>
            </div>
        `).join('');
        
        dropdown.classList.remove('hidden');
        
        // Select matching node on click
        dropdown.querySelectorAll('.search-item').forEach(item => {
            item.addEventListener('click', () => {
                const nodeId = item.getAttribute('data-node-id');
                selectNode(nodeId);
                searchInput.value = nodeId;
                dropdown.classList.add('hidden');
            });
        });
    });
    
    // Hide dropdown on clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

// Select node from search or click
function selectNode(nodeId) {
    if (!state.networkData) return;
    
    const node = state.networkData.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    state.selectedNode = nodeId;
    updateInfoPanel(node);
    
    // Pan map to associated city if it exists
    const associatedCity = getNodeCity(node);
    if (associatedCity && cityCoordinates[associatedCity] && state.map) {
        state.map.setView(cityCoordinates[associatedCity], 7);
    }
    
    // Draw geographic flow lines on the map if it exists
    if (state.map) {
        // Clear previous lines
        if (state.mapLines) {
            state.mapLines.forEach(l => state.map.removeLayer(l));
        }
        state.mapLines = [];
        
        if (associatedCity && cityCoordinates[associatedCity]) {
            const srcCoords = cityCoordinates[associatedCity];
            
            // Find all links connected to the selected node
            const connectedLinks = state.networkData.links.filter(l => 
                l.source === nodeId || l.target === nodeId || 
                (l.source && l.source.id === nodeId) || 
                (l.target && l.target.id === nodeId)
            );
            
            connectedLinks.forEach(link => {
                const targetNodeObj = (link.source === nodeId || (link.source && link.source.id === nodeId)) ? link.target : link.source;
                const targetId = typeof targetNodeObj === 'object' ? targetNodeObj.id : targetNodeObj;
                const targetNode = state.networkData.nodes.find(n => n.id === targetId);
                
                if (targetNode) {
                    const destCity = getNodeCity(targetNode);
                    if (destCity && cityCoordinates[destCity] && destCity !== associatedCity) {
                        const destCoords = cityCoordinates[destCity];
                        
                        // Set style based on connection type
                        const isCensor = node.type === 'censor';
                        const lineColor = isCensor ? '#38bdf8' : '#f43f5e'; // sky blue for censors, rose for publishers
                        
                        // Draw line
                        const polyline = L.polyline([srcCoords, destCoords], {
                            color: lineColor,
                            weight: 3,
                            opacity: 0.8,
                            dashArray: '8, 12',
                            className: 'flow-polyline' // Class for CSS animation
                        }).addTo(state.map);
                        
                        // Bind tooltip to the line
                        polyline.bindTooltip(`
                            <div style="font-family: inherit; font-size:11px;">
                                <strong>Geographic link:</strong><br/>
                                ${node.id} (${associatedCity}) &harr; ${targetNode.id} (${destCity})
                            </div>
                        `, { sticky: true });
                        
                        state.mapLines.push(polyline);
                    }
                }
            });
        }
    }
    
    // Highlight in D3 svg
    d3.selectAll('.node').classed('selected', n => n.id === nodeId);
    
    // Highlight links
    d3.selectAll('.link')
      .classed('highlighted', l => l.source.id === nodeId || l.target.id === nodeId)
      .style('stroke-opacity', l => (l.source.id === nodeId || l.target.id === nodeId) ? 0.9 : 0.08);
      
    // Shift focus in network graph if active
    if (state.activeTab === 'network-tab') {
        const d3Node = d3.selectAll('.node').filter(n => n.id === nodeId).datum();
        if (d3Node) {
            // Zoom/pan to node
            const transform = d3.zoomIdentity
                .translate(window.innerWidth / 2 - 200 - d3Node.x, window.innerHeight / 2 - d3Node.y)
                .scale(1.2);
                
            d3.select('#network-svg')
              .transition()
              .duration(750)
              .call(d3.zoom().transform, transform);
        }
    }
}

// Update Detail side-panel card
function updateInfoPanel(node) {
    const placeholder = document.getElementById('info-placeholder');
    const content = document.getElementById('info-content');
    
    placeholder.classList.add('hidden');
    content.classList.remove('hidden');
    
    // Hide map actions since we are looking at an actor node
    document.getElementById('section-map-actions').classList.add('hidden');
    
    document.getElementById('info-name').innerText = node.id;
    
    // Type Tag
    const typeTag = document.getElementById('info-tag-type');
    typeTag.innerText = node.type === 'censor' ? 'Censor' : 'Publisher';
    typeTag.style.backgroundColor = node.type === 'censor' ? '#38bdf8' : '#f43f5e';
    typeTag.style.color = '#0f172a';
    
    // Jesuit Tag
    const jesuitTag = document.getElementById('info-tag-jesuit');
    if (node.is_jesuit) {
        jesuitTag.classList.remove('hidden');
    } else {
        jesuitTag.classList.add('hidden');
    }
    
    // GND link
    const gndSection = document.getElementById('section-gnd');
    const gndLink = document.getElementById('info-gnd-link');
    if (node.gnd_id) {
        gndLink.href = `https://d-nb.info/gnd/${node.gnd_id}`;
        gndLink.innerText = `GND ${node.gnd_id} (Integrated Authority File)`;
        gndSection.classList.remove('hidden');
    } else {
        gndSection.classList.add('hidden');
    }
    
    // Occupations
    const occSection = document.getElementById('section-occupations');
    const occText = document.getElementById('info-occupations');
    if (node.occupations) {
        occText.innerText = node.occupations;
        occSection.classList.remove('hidden');
    } else {
        occSection.classList.add('hidden');
    }
    
    // Biography
    const bioSection = document.getElementById('section-biography');
    const bioText = document.getElementById('info-biography');
    if (node.biography) {
        bioText.innerText = node.biography;
        bioSection.classList.remove('hidden');
    } else {
        bioSection.classList.add('hidden');
    }
    
    // Degree stats
    document.getElementById('info-degree').innerText = node.degree;
}

// Reset all panels
function resetVisualization() {
    state.selectedNode = null;
    document.getElementById('search-input').value = '';
    
    // Hide details panel
    document.getElementById('info-placeholder').classList.remove('hidden');
    document.getElementById('info-content').classList.add('hidden');
    document.getElementById('section-map-actions').classList.add('hidden');
    
    // Clear geographic flow lines
    if (state.mapLines && state.map) {
        state.mapLines.forEach(l => state.map.removeLayer(l));
        state.mapLines = [];
    }
    
    // Reset D3 styling
    d3.selectAll('.node').classed('selected', false);
    d3.selectAll('.link')
      .classed('highlighted', false)
      .style('stroke-opacity', 0.35);
      
    // Center D3 network
    d3.select('#network-svg')
      .transition()
      .duration(750)
      .call(d3.zoom().transform, d3.zoomIdentity.translate(0, 0).scale(1.0));
}

// Bind reset and sliders
function initControls() {
    // Edge Weight slider
    const slider = document.getElementById('weight-slider');
    const sliderValue = document.getElementById('weight-value');
    slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.networkThreshold = val;
        sliderValue.innerText = val;
        updateNetworkGraph();
    });
    
    // Jesuit checkbox
    const jesuitCheckbox = document.getElementById('jesuit-checkbox');
    jesuitCheckbox.addEventListener('change', (e) => {
        state.showJesuitsOnly = e.target.checked;
        updateNetworkGraph();
    });
    
    // Reset button
    document.getElementById('reset-button').addEventListener('click', resetVisualization);
    
    // Map slider
    const mapSlider = document.getElementById('map-year-slider');
    const mapLabel = document.getElementById('map-year-label');
    mapSlider.addEventListener('input', (e) => {
        const yr = parseInt(e.target.value);
        state.activeYear = yr;
        mapLabel.innerText = `Decade: ${yr}s`;
        updateMapMarkers();
    });

    // Map play button
    const playBtn = document.getElementById('map-play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', toggleMapPlay);
    }
    
    // Map output volume threshold slider
    const volumeSlider = document.getElementById('map-volume-slider');
    const volumeLabel = document.getElementById('map-volume-label');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            volumeLabel.innerText = val === 1 ? '1 title' : `${val} titles`;
            updateMapMarkers();
        });
    }
    
    // Confessional checkbox filters
    const filterCatholic = document.getElementById('filter-catholic');
    const filterProtestant = document.getElementById('filter-protestant');
    const filterMixed = document.getElementById('filter-mixed');
    
    if (filterCatholic) filterCatholic.addEventListener('change', updateMapMarkers);
    if (filterProtestant) filterProtestant.addEventListener('change', updateMapMarkers);
    if (filterMixed) filterMixed.addEventListener('change', updateMapMarkers);
}

// Animate decade slider advancing
function toggleMapPlay() {
    const playBtn = document.getElementById('map-play-btn');
    const playIcon = document.getElementById('play-icon');
    const playText = playBtn.querySelector('span');
    
    if (state.isPlaying) {
        // Pause
        clearInterval(state.playInterval);
        state.playInterval = null;
        state.isPlaying = false;
        playBtn.classList.remove('playing');
        playText.innerText = 'Play';
        playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
    } else {
        // Play
        state.isPlaying = true;
        playBtn.classList.add('playing');
        playText.innerText = 'Pause';
        playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
        
        state.playInterval = setInterval(() => {
            const slider = document.getElementById('map-year-slider');
            let currentVal = parseInt(slider.value);
            let nextVal = currentVal + 10;
            if (nextVal > 1790) {
                nextVal = 1500; // Loop back
            }
            slider.value = nextVal;
            
            // Trigger slider input event manually
            state.activeYear = nextVal;
            document.getElementById('map-year-label').innerText = `Decade: ${nextVal}s`;
            updateMapMarkers();
        }, 1500);
    }
}

// ==========================================================================
// D3 NETWORK GRAPH CONTROLLER
// ==========================================================================
function initNetworkGraph() {
    const container = document.getElementById('network-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // SVG Setup
    state.svg = d3.select("#network-svg")
        .attr("viewBox", [0, 0, width, height]);
        
    state.gContainer = state.svg.append("g");
    
    // Add Pan & Zoom support
    state.svg.call(d3.zoom()
        .extent([[0, 0], [width, height]])
        .scaleExtent([0.15, 6])
        .on("zoom", ({transform}) => {
            state.gContainer.attr("transform", transform);
        })
    );
    
    updateNetworkGraph();
}

function updateNetworkGraph() {
    if (!state.networkData) return;
    
    // 1. Filter Links based on threshold
    let links = state.networkData.links.map(l => ({...l}))
        .filter(l => l.weight >= state.networkThreshold);
        
    // 2. Filter Nodes based on Jesuit filter and degree
    let activeNodes = new Set();
    links.forEach(l => {
        activeNodes.add(l.source);
        activeNodes.add(l.target);
    });
    
    let nodes = state.networkData.nodes.map(n => ({...n}))
        .filter(n => activeNodes.has(n.id));
        
    if (state.showJesuitsOnly) {
        // Keep publishers OR Jesuit censors
        nodes = nodes.filter(n => n.type === 'publisher' || n.is_jesuit);
        // Clean orphaned links
        const nodeSet = new Set(nodes.map(n => n.id));
        links = links.filter(l => nodeSet.has(l.source) && nodeSet.has(l.target));
    }
    
    // Clear old elements
    state.gContainer.selectAll("*").remove();
    
    // Draw links
    const link = state.gContainer.append("g")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("class", "link")
        .attr("stroke-width", d => Math.min(1 + d.weight * 0.4, 6.0));
        
    // Draw nodes
    const node = state.gContainer.append("g")
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("class", "node")
        .attr("r", d => {
            if (d.type === 'publisher') return 6 + Math.min(d.degree * 0.4, 16);
            return d.is_jesuit ? 7 + Math.min(d.degree * 0.5, 14) : 4 + Math.min(d.degree * 0.3, 10);
        })
        .attr("fill", d => {
            if (d.type === 'publisher') return "#f43f5e"; // Rose
            return d.is_jesuit ? "#fbbf24" : "#38bdf8"; // Gold vs Sky Blue
        })
        .attr("stroke", d => d.is_jesuit ? "#ffffff" : "none")
        .attr("stroke-width", d => d.is_jesuit ? 1.5 : 0)
        .call(drag(state.simulation))
        .on("click", (e, d) => {
            selectNode(d.id);
            e.stopPropagation();
        });
        
    // Interactive hover triggers
    node.on("mouseover", (e, d) => {
        // Highlight active connections
        link.classed("highlighted", l => l.source.id === d.id || l.target.id === d.id)
            .style("stroke-opacity", l => (l.source.id === d.id || l.target.id === d.id) ? 0.9 : 0.08);
    }).on("mouseout", () => {
        if (state.selectedNode) {
            // Keep selected node highlighted
            link.classed("highlighted", l => l.source.id === state.selectedNode || l.target.id === state.selectedNode)
                .style("stroke-opacity", l => (l.source.id === state.selectedNode || l.target.id === state.selectedNode) ? 0.9 : 0.08);
        } else {
            link.classed("highlighted", false).style("stroke-opacity", 0.35);
        }
    });

    // Add labels for major hubs
    const labelThreshold = 8;
    const labelNodes = nodes.filter(n => n.degree >= labelThreshold);
    
    const labels = state.gContainer.append("g")
        .selectAll("text")
        .data(labelNodes)
        .join("text")
        .attr("class", "node-label")
        .attr("dx", 10)
        .attr("dy", 3)
        .text(d => d.id);
        
    // D3 Force Simulation Setup
    const container = document.getElementById('network-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    state.simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(60))
        .force("charge", d3.forceManyBody().strength(-120))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(d => 12 + Math.min(d.degree * 0.4, 16)));
        
    state.simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
            
        labels
            .attr("x", d => d.x)
            .attr("y", d => d.y);
    });
}

// Drag & Drop handlers
function drag(simulation) {
    function dragstarted(event) {
        if (!event.active) state.simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }
    
    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }
    
    function dragended(event) {
        if (!event.active) state.simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }
    
    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
}

// ==========================================================================
// LEAFLET SPATIAL MAP CONTROLLER
// ==========================================================================
function initMap() {
    // Point at Central Europe / Holy Roman Empire
    state.map = L.map('map-container').setView([50.5, 11.5], 6);
    
    // Premium dark thematic tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(state.map);
    
    // Adjust circle marker radii dynamically on zoom change
    state.map.on('zoomend', () => {
        updateMapMarkers();
    });
    
    updateMapMarkers();
}

function updateMapMarkers() {
    if (!state.timelineData || !state.map) return;
    
    // Clear old markers and lines
    state.mapMarkers.forEach(m => state.map.removeLayer(m));
    state.mapMarkers = [];
    if (state.mapLines) {
        state.mapLines.forEach(l => state.map.removeLayer(l));
        state.mapLines = [];
    }
    
    const targetDecade = state.activeYear;
    const previousDecade = targetDecade - 10;
    
    // Confessional filters state
    const showCatholic = document.getElementById('filter-catholic')?.checked !== false;
    const showProtestant = document.getElementById('filter-protestant')?.checked !== false;
    const showMixed = document.getElementById('filter-mixed')?.checked !== false;
    
    // Min printing output volume threshold filter state
    const minVolume = parseInt(document.getElementById('map-volume-slider')?.value || 1);
    
    // Aggregate printing volume by city for the active decade and previous decade
    const cityTotals = {};
    const prevCityTotals = {};
    
    state.timelineData.forEach(row => {
        const yr = parseInt(row["year"]);
        const city = row["city"];
        const count = parseInt(row["count"]) || 0;
        const confession = row["confession"];
        
        // Apply confession filters
        if (confession === "Catholic" && !showCatholic) return;
        if (confession === "Protestant" && !showProtestant) return;
        if (confession === "Mixed" && !showMixed) return;
        
        // Active decade
        if (yr >= targetDecade && yr < targetDecade + 10) {
            if (!cityTotals[city]) {
                cityTotals[city] = {
                    count: 0,
                    confession: confession
                };
            }
            cityTotals[city].count += count;
        }
        // Previous decade
        else if (previousDecade >= 1500 && yr >= previousDecade && yr < previousDecade + 10) {
            if (!prevCityTotals[city]) {
                prevCityTotals[city] = {
                    count: 0
                };
            }
            prevCityTotals[city].count += count;
        }
    });
    
    // Render markers on map
    for (const [city, data] of Object.entries(cityTotals)) {
        const coords = cityCoordinates[city];
        if (!coords || data.count < minVolume) continue;
        
        // Scale with power-law (exponent 0.35) for a balanced sizing dynamic, then scale by zoom
        const currentZoom = state.map.getZoom();
        const zoomFactor = Math.pow(1.5, currentZoom - 6);
        let radius = (Math.pow(data.count, 0.35) * 1.1 + 1.2) * zoomFactor;
        const maxCap = Math.max(8, currentZoom * 4.5);
        radius = Math.max(2.5, Math.min(maxCap, radius));
        
        // Calculate previous decade radius for comparison
        let prevRadius = 0;
        const prevData = prevCityTotals[city];
        if (prevData && prevData.count >= minVolume) {
            prevRadius = (Math.pow(prevData.count, 0.35) * 1.1 + 1.2) * zoomFactor;
            prevRadius = Math.max(2.5, Math.min(maxCap, prevRadius));
        }
        
        // Determine growth/decline characteristics
        const isComparisonAvailable = prevRadius > 0;
        const isSignificantChange = isComparisonAvailable && Math.abs(radius - prevRadius) > 0.5;
        const isGrowth = isSignificantChange && radius > prevRadius;
        const isDecline = isSignificantChange && prevRadius > radius;
        
        // 1. Draw glowing comparison outline of the previous decade FIRST (sits behind the solid marker)
        if (isSignificantChange) {
            const outlineColor = isGrowth ? "#10b981" : "#ef4444"; // emerald green for growth, crimson red for decline
            const prevGlowClass = isGrowth ? "prev-marker-glow-growth" : "prev-marker-glow-decline";
            
            const prevMarker = L.circleMarker(coords, {
                radius: prevRadius,
                fillColor: "transparent",
                color: outlineColor,
                weight: 2.0,
                dashArray: "4, 6",
                opacity: 0.75,
                fillOpacity: 0,
                className: prevGlowClass,
                interactive: false // Click events pass through to the main marker
            }).addTo(state.map);
            state.mapMarkers.push(prevMarker);
        }
        
        // 2. Determine styling parameters for the active main city marker
        let borderStrokeColor = "#ffffff";
        let strokeWeight = 1.0;
        let glowClass = "glow-neutral";
        
        if (isSignificantChange) {
            if (isGrowth) {
                borderStrokeColor = "#10b981"; // Emerald green
                strokeWeight = 2.0;
                glowClass = "glow-growth";
            } else if (isDecline) {
                borderStrokeColor = "#ef4444"; // Crimson red
                strokeWeight = 2.0;
                glowClass = "glow-decline";
            }
        }
        
        let markerClasses = [glowClass];
        if (data.count > 500) {
            markerClasses.push('pulse-marker');
        }
        
        let color = "#94a3b8"; // Mixed / Gray
        if (data.confession === "Catholic") color = "#d4af37"; // Gold
        else if (data.confession === "Protestant") color = "#5b21b6"; // Deep Purple
        
        // Create the active main city marker
        const marker = L.circleMarker(coords, {
            radius: radius,
            fillColor: color,
            color: borderStrokeColor,
            weight: strokeWeight,
            opacity: 0.9,
            fillOpacity: 0.75,
            className: markerClasses.join(' ')
        }).addTo(state.map);
        
        // Interactive mouseover hover highlight style
        marker.on('mouseover', function () {
            this.setStyle({
                weight: strokeWeight + 1.5,
                fillOpacity: 0.95
            });
        });
        marker.on('mouseout', function () {
            this.setStyle({
                weight: strokeWeight,
                fillOpacity: 0.75
            });
        });
        
        // Rich tooltip detail
        marker.bindTooltip(`
            <div style="font-family: inherit; font-size:12px;">
                <strong style="font-size:13px; color:#ffffff;">${city}</strong><br/>
                <span style="color:#94a3b8; font-weight:600;">Confession:</span> ${data.confession}<br/>
                <span style="color:#94a3b8; font-weight:600;">Decade Output:</span> ${data.count} titles
            </div>
        `, { direction: 'top', offset: [0, -10] });
        
        // Sidebar metadata bind on click
        marker.on('click', () => {
            const sidePanel = document.getElementById('info-content');
            const placeholder = document.getElementById('info-placeholder');
            
            placeholder.classList.add('hidden');
            sidePanel.classList.remove('hidden');
            
            document.getElementById('info-name').innerText = city;
            
            // Draw geographic flow lines for this city
            if (state.mapLines) {
                state.mapLines.forEach(l => state.map.removeLayer(l));
            }
            state.mapLines = [];
            
            if (state.networkData) {
                // Find all nodes (actors) associated with this city
                const cityNodes = state.networkData.nodes.filter(n => getNodeCity(n) === city);
                const cityNodeIds = new Set(cityNodes.map(n => n.id));
                const drawnDestinations = new Set();
                
                // Find all links connected to any actor in this city
                const connectedLinks = state.networkData.links.filter(l => {
                    const sId = typeof l.source === 'object' ? l.source.id : l.source;
                    const tId = typeof l.target === 'object' ? l.target.id : l.target;
                    return cityNodeIds.has(sId) || cityNodeIds.has(tId);
                });
                
                connectedLinks.forEach(link => {
                    const sId = typeof link.source === 'object' ? link.source.id : link.source;
                    const tId = typeof link.target === 'object' ? link.target.id : link.target;
                    
                    const isSourceInCity = cityNodeIds.has(sId);
                    const otherNodeId = isSourceInCity ? tId : sId;
                    const otherNode = state.networkData.nodes.find(n => n.id === otherNodeId);
                    
                    if (otherNode) {
                        const destCity = getNodeCity(otherNode);
                        if (destCity && cityCoordinates[destCity] && destCity !== city) {
                            if (drawnDestinations.has(destCity)) return; // Avoid duplicate lines
                            drawnDestinations.add(destCity);
                            
                            const destCoords = cityCoordinates[destCity];
                            
                            // Set style based on city confession
                            const lineColor = data.confession === "Catholic" ? '#38bdf8' : 
                                              (data.confession === "Protestant" ? '#5b21b6' : '#cbd5e1');
                            
                            // Draw flow polyline
                            const polyline = L.polyline([coords, destCoords], {
                                color: lineColor,
                                weight: 3.5,
                                opacity: 0.75,
                                dashArray: '8, 12',
                                className: 'flow-polyline'
                            }).addTo(state.map);
                            
                            // Tooltip showing connection
                            polyline.bindTooltip(`
                                <div style="font-family: inherit; font-size:11px;">
                                    <strong>Geographic Channel:</strong><br/>
                                    ${city} &harr; ${destCity}
                                </div>
                            `, { sticky: true });
                            
                            state.mapLines.push(polyline);
                        }
                    }
                });
            }
            
            const typeTag = document.getElementById('info-tag-type');
            typeTag.innerText = 'Printing Center';
            typeTag.style.backgroundColor = color;
            typeTag.style.color = '#ffffff';
            
            document.getElementById('info-tag-jesuit').classList.add('hidden');
            document.getElementById('section-gnd').classList.add('hidden');
            document.getElementById('section-occupations').classList.add('hidden');
            
            const bioText = document.getElementById('info-biography');
            document.getElementById('section-biography').classList.remove('hidden');
            
            // Reconstruct text to dynamically show active and previous decade comparison in sidebar
            let comparisonText = "";
            if (prevData && prevData.count > 0) {
                const diff = data.count - prevData.count;
                const percent = ((diff / prevData.count) * 100).toFixed(1);
                const verb = diff >= 0 ? "increased" : "decreased";
                const changeColor = diff >= 0 ? "#10b981" : "#ef4444";
                const sign = diff >= 0 ? "+" : "";
                comparisonText = ` This represents a <strong style="color: ${changeColor};">${sign}${percent}%</strong> output change (${verb} by ${Math.abs(diff)} titles) compared to the previous decade (${previousDecade}s: ${prevData.count} titles).`;
            }
            
            bioText.innerHTML = `
                Historically classified as a <strong>${data.confession}</strong> printing hub.<br/><br/>
                During the <strong>${targetDecade}s</strong>, publishers in ${city} released a total of <strong>${data.count}</strong> cataloged titles in our database.${comparisonText}
            `;
            
            document.getElementById('info-degree').innerText = 'N/A';
            
            // Show map actions panel for highlighting network actors
            const mapActions = document.getElementById('section-map-actions');
            mapActions.classList.remove('hidden');
            
            const highlightBtn = document.getElementById('btn-highlight-city-actors');
            // Remove previous event listeners by cloning
            const newHighlightBtn = highlightBtn.cloneNode(true);
            highlightBtn.parentNode.replaceChild(newHighlightBtn, highlightBtn);
            
            newHighlightBtn.innerText = `Highlight ${city} Actors in Network`;
            newHighlightBtn.addEventListener('click', () => {
                // 1. Switch to network tab
                const netTabBtn = document.querySelector('[data-tab="network-tab"]');
                if (netTabBtn) netTabBtn.click();
                
                // 2. Clear current search input
                document.getElementById('search-input').value = '';
                state.searchQuery = '';
                
                // 3. Highlight D3 nodes matching this city
                d3.selectAll('.node').classed('selected', n => getNodeCity(n) === city);
                
                // 4. Highlight lines connected to those nodes
                d3.selectAll('.link')
                  .classed('highlighted', l => {
                      const sCity = getNodeCity(l.source);
                      const tCity = getNodeCity(l.target);
                      return sCity === city || tCity === city;
                  })
                  .style('stroke-opacity', l => {
                      const sCity = getNodeCity(l.source);
                      const tCity = getNodeCity(l.target);
                      return (sCity === city || tCity === city) ? 0.9 : 0.05;
                  });
            });
        });
        
        state.mapMarkers.push(marker);
    }
}

// ==========================================================================
// CHART.JS TIMELINES CONTROLLER
// ==========================================================================
function initTimelines() {
    if (!state.timelineData) return;
    
    // Aggregation of CSV data into decades (1500 to 1790)
    const decades = [];
    for (let d = 1500; d <= 1790; d += 10) {
        decades.push(d);
    }
    
    const lpCounts = Array(decades.length).fill(0);
    const ffCounts = Array(decades.length).fill(0);
    
    const confCounts = {
        Catholic: Array(decades.length).fill(0),
        Protestant: Array(decades.length).fill(0),
        Mixed: Array(decades.length).fill(0)
    };
    
    const langCounts = {
        Catholic: { ger: Array(decades.length).fill(0), lat: Array(decades.length).fill(0) },
        Protestant: { ger: Array(decades.length).fill(0), lat: Array(decades.length).fill(0) },
        Mixed: { ger: Array(decades.length).fill(0), lat: Array(decades.length).fill(0) }
    };
    
    state.timelineData.forEach(row => {
        const yr = parseInt(row["year"]);
        if (yr < 1500 || yr >= 1800) return;
        
        const decadeIndex = Math.floor((yr - 1500) / 10);
        const city = row["city"];
        const count = parseInt(row["count"]) || 0;
        const confession = row["confession"];
        const lang = row["language"];
        
        // 1. Leipzig vs Frankfurt
        if (city === "Leipzig") {
            lpCounts[decadeIndex] += count;
        } else if (city === "Frankfurt am Main") {
            ffCounts[decadeIndex] += count;
        }
        
        // 2. Confessional shares
        if (confCounts[confession] !== undefined) {
            confCounts[confession][decadeIndex] += count;
        }
        
        // 3. Language distribution
        if (langCounts[confession] !== undefined && (lang === 'ger' || lang === 'lat')) {
            langCounts[confession][lang][decadeIndex] += count;
        }
    });
    
    // ----------------------------------------------------
    // CHART 1: Leipzig vs Frankfurt (Line Chart)
    // ----------------------------------------------------
    const ctxLF = document.getElementById('chart-leipzig-frankfurt').getContext('2d');
    state.charts.leipzigFrankfurt = new Chart(ctxLF, {
        type: 'line',
        data: {
            labels: decades.map(d => `${d}s`),
            datasets: [
                {
                    label: 'Leipzig (Protestant)',
                    data: lpCounts,
                    borderColor: '#2b5c8f',
                    backgroundColor: 'rgba(43, 92, 143, 0.1)',
                    borderWidth: 3.5,
                    tension: 0.2,
                    pointRadius: 3
                },
                {
                    label: 'Frankfurt am Main (Mixed/Imperial)',
                    data: ffCounts,
                    borderColor: '#e26d5c',
                    backgroundColor: 'rgba(226, 109, 92, 0.1)',
                    borderWidth: 3.5,
                    tension: 0.2,
                    pointRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#94a3b8', font: { family: 'Inter', weight: 500 } } }
            },
            scales: {
                x: { grid: { color: '#1e293b' }, ticks: { color: '#64748b' } },
                y: { grid: { color: '#1e293b' }, ticks: { color: '#64748b' } }
            }
        }
    });
    
    // ----------------------------------------------------
    // CHART 2: Confessional Shares (Stacked Area Chart)
    // ----------------------------------------------------
    // Convert counts to percentages
    const catholicPct = [];
    const mixedPct = [];
    const protestantPct = [];
    
    for (let i = 0; i < decades.length; i++) {
        const total = confCounts.Catholic[i] + confCounts.Mixed[i] + confCounts.Protestant[i];
        if (total > 0) {
            catholicPct.push((confCounts.Catholic[i] / total) * 100);
            mixedPct.push((confCounts.Mixed[i] / total) * 100);
            protestantPct.push((confCounts.Protestant[i] / total) * 100);
        } else {
            catholicPct.push(0);
            mixedPct.push(0);
            protestantPct.push(0);
        }
    }
    
    const ctxC = document.getElementById('chart-confessional').getContext('2d');
    state.charts.confessional = new Chart(ctxC, {
        type: 'line',
        data: {
            labels: decades.map(d => `${d}s`),
            datasets: [
                {
                    label: 'Catholic Hubs',
                    data: catholicPct,
                    fill: true,
                    backgroundColor: 'rgba(212, 175, 55, 0.8)',
                    borderColor: '#d4af37',
                    borderWidth: 1,
                    pointRadius: 0
                },
                {
                    label: 'Mixed Hubs',
                    data: mixedPct,
                    fill: true,
                    backgroundColor: 'rgba(148, 163, 184, 0.8)',
                    borderColor: '#94a3b8',
                    borderWidth: 1,
                    pointRadius: 0
                },
                {
                    label: 'Protestant Hubs',
                    data: protestantPct,
                    fill: true,
                    backgroundColor: 'rgba(91, 33, 182, 0.8)',
                    borderColor: '#5b21b6',
                    borderWidth: 1,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#94a3b8', font: { family: 'Inter', weight: 500 } } }
            },
            scales: {
                x: { grid: { color: '#1e293b' }, ticks: { color: '#64748b' } },
                y: { min: 0, max: 100, grid: { color: '#1e293b' }, ticks: { color: '#64748b', callback: v => `${v}%` } }
            }
        }
    });
    
    // ----------------------------------------------------
    // CHART 3: Language Shift (Percentage German)
    // ----------------------------------------------------
    const cathLangRatio = [];
    const protLangRatio = [];
    const mixedLangRatio = [];
    
    for (let i = 0; i < decades.length; i++) {
        const cTotal = langCounts.Catholic.ger[i] + langCounts.Catholic.lat[i];
        const pTotal = langCounts.Protestant.ger[i] + langCounts.Protestant.lat[i];
        const mTotal = langCounts.Mixed.ger[i] + langCounts.Mixed.lat[i];
        
        cathLangRatio.push(cTotal > 0 ? (langCounts.Catholic.ger[i] / cTotal) * 100 : 0);
        protLangRatio.push(pTotal > 0 ? (langCounts.Protestant.ger[i] / pTotal) * 100 : 0);
        mixedLangRatio.push(mTotal > 0 ? (langCounts.Mixed.ger[i] / mTotal) * 100 : 0);
    }
    
    const ctxL = document.getElementById('chart-language').getContext('2d');
    state.charts.language = new Chart(ctxL, {
        type: 'line',
        data: {
            labels: decades.map(d => `${d}s`),
            datasets: [
                {
                    label: 'Protestant Hubs (% German)',
                    data: protLangRatio,
                    borderColor: '#5b21b6',
                    borderWidth: 2.5,
                    tension: 0.15,
                    pointRadius: 2
                },
                {
                    label: 'Catholic Hubs (% German)',
                    data: cathLangRatio,
                    borderColor: '#d4af37',
                    borderWidth: 2.5,
                    tension: 0.15,
                    pointRadius: 2
                },
                {
                    label: 'Mixed Hubs (% German)',
                    data: mixedLangRatio,
                    borderColor: '#94a3b8',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    tension: 0.15,
                    pointRadius: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#94a3b8', font: { family: 'Inter', weight: 500 } } }
            },
            scales: {
                x: { grid: { color: '#1e293b' }, ticks: { color: '#64748b' } },
                y: { min: 0, max: 100, grid: { color: '#1e293b' }, ticks: { color: '#64748b', callback: v => `${v}%` } }
            }
        }
    });
}
