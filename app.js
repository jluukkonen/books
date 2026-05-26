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
    censorTimelines: null,
    
    // Network Graph variables
    svg: null,
    gContainer: null,
    simulation: null,
    highlightCity: null,
    zoom: null,
    
    // Leaflet variables
    map: null,
    mapMarkers: [],
    mapLines: [],
    activeCityMarkers: {},
    prevDecadeRings: {},
    
    // Chart.js instances
    charts: {
        leipzigFrankfurt: null,
        confessional: null,
        language: null,
        cityTimeline: null,
        actorTimeline: null
    },
    selectedCity: null,
    selectedCityConfession: null
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
    initTeamCabinet();
});

// Load resources via Fetch
async function loadData() {
    try {
        const netResponse = await fetch('data/network.json?v=' + Date.now());
        state.networkData = await netResponse.json();
        
        const timelineResponse = await fetch('data/timeline.csv?v=' + Date.now());
        const csvText = await timelineResponse.text();
        state.timelineData = parseCSV(csvText);
        
        const timelinesResponse = await fetch('data/censor_timelines.json?v=' + Date.now());
        state.censorTimelines = await timelinesResponse.json();
        
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
            
            // Restart/stop D3 force simulation based on active tab to save CPU
            if (state.simulation) {
                if (targetTab === 'network-tab') {
                    state.simulation.restart();
                } else {
                    state.simulation.stop();
                }
            }
            
            // Handle Leaflet re-size re-draw when switching to Map tab
            if (targetTab === 'map-tab' && state.map) {
                setTimeout(() => {
                    state.map.invalidateSize();
                }, 100);
            }
            
            // Force model-viewers to resize and recalculate layout upon tab activation
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
                const viewers = document.querySelectorAll('model-viewer');
                viewers.forEach(mv => {
                    if (typeof mv.resize === 'function') {
                        mv.resize();
                    }
                });
            }, 100);
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
    state.highlightCity = null; // Clear city selection
    updateInfoPanel(node);
    zoomToNode(nodeId);
    
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
    
    // Highlight in 2D network and trigger update of styles
    updateNetworkHighlights();
}

// Function to update highlights in the D3 2D graph
function updateNetworkHighlights() {
    if (!state.svg) return;
    
    const selectedNodeId = state.selectedNode;
    const highlightCity = state.highlightCity;
    
    // Toggle 'selected' class on node circles
    state.svg.selectAll(".node")
        .classed("selected", d => d.id === selectedNodeId || (highlightCity && getNodeCity(d) === highlightCity))
        .style("stroke-width", d => (d.id === selectedNodeId || (highlightCity && getNodeCity(d) === highlightCity)) ? "2.5px" : (d.is_jesuit ? "1.5px" : "0.5px"))
        .style("stroke", d => (d.id === selectedNodeId || (highlightCity && getNodeCity(d) === highlightCity)) ? "#ffffff" : (d.is_jesuit ? "#ffffff" : "#0f172a"))
        .style("opacity", d => {
            if (!selectedNodeId && !highlightCity) return 1;
            if (d.id === selectedNodeId) return 1;
            if (highlightCity && getNodeCity(d) === highlightCity) return 1;
            
            // Check connection
            if (selectedNodeId) {
                const isConnected = state.networkData.links.some(l => {
                    if (l.weight < state.networkThreshold) return false;
                    const sId = typeof l.source === 'object' ? l.source.id : l.source;
                    const tId = typeof l.target === 'object' ? l.target.id : l.target;
                    return (sId === selectedNodeId && tId === d.id) || (tId === selectedNodeId && sId === d.id);
                });
                return isConnected ? 0.95 : 0.15;
            }
            return 0.15;
        });
        
    state.svg.selectAll(".link")
        .classed("highlighted", l => {
            const sId = typeof l.source === 'object' ? l.source.id : l.source;
            const tId = typeof l.target === 'object' ? l.target.id : l.target;
            if (highlightCity) {
                const sCity = getNodeCity(l.source);
                const tCity = getNodeCity(l.target);
                return sCity === highlightCity || tCity === highlightCity;
            }
            return sId === selectedNodeId || tId === selectedNodeId;
        })
        .style("stroke-opacity", l => {
            const sId = typeof l.source === 'object' ? l.source.id : l.source;
            const tId = typeof l.target === 'object' ? l.target.id : l.target;
            
            if (!selectedNodeId && !highlightCity) return 0.35;
            
            if (highlightCity) {
                const sCity = getNodeCity(l.source);
                const tCity = getNodeCity(l.target);
                return (sCity === highlightCity || tCity === highlightCity) ? 0.95 : 0.05;
            }
            
            const isConnected = (sId === selectedNodeId || tId === selectedNodeId);
            return isConnected ? 0.95 : 0.05;
        });
}

// Programmatically switch tabs
function switchTab(tabId) {
    const btn = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
    if (btn) btn.click();
}

// Camera Spotlight (Pan & Zoom-to-Node)
function zoomToNode(nodeId) {
    if (state.activeTab !== 'network-tab') {
        switchTab('network-tab');
    }
    
    // Brief timeout to let the DOM tab switch render and simulation wake up
    setTimeout(() => {
        const nodeObj = state.simulation ? state.simulation.nodes().find(n => n.id === nodeId) : null;
        if (nodeObj && state.svg && state.zoom) {
            const container = document.getElementById('network-container');
            if (!container) return;
            const width = container.clientWidth;
            const height = container.clientHeight;
            
            const transform = d3.zoomIdentity
                .translate(width / 2, height / 2)
                .scale(1.8)
                .translate(-nodeObj.x, -nodeObj.y);
                
            state.svg.transition()
                .duration(750)
                .call(state.zoom.transform, transform);
        }
    }, state.activeTab !== 'network-tab' ? 200 : 0);
}

// Render dynamic Chart.js actor timeline in dynamic sidebar card
function renderActorTimelineChart(actorId, type) {
    const canvas = document.getElementById('actor-timeline-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Destroy previous instance to avoid visual overlapping
    if (state.charts.actorTimeline) {
        state.charts.actorTimeline.destroy();
    }
    
    const counts = state.censorTimelines ? (state.censorTimelines[actorId] || Array(30).fill(0)) : Array(30).fill(0);
    const decades = [];
    for (let d = 1500; d <= 1790; d += 10) {
        decades.push(`${d}s`);
    }
    
    const themeColor = type === 'censor' ? '#38bdf8' : '#f43f5e';
    const fillRgba = type === 'censor' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(244, 63, 94, 0.15)';
    
    state.charts.actorTimeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: decades,
            datasets: [{
                label: type === 'censor' ? 'Approvals Given' : 'Vetted Titles Published',
                data: counts,
                borderColor: themeColor,
                backgroundColor: fillRgba,
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointBackgroundColor: themeColor
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y} books`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Inter', size: 9 },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 5
                    }
                },
                y: {
                    grid: { color: '#1e293b' },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Inter', size: 9 },
                        maxTicksLimit: 3
                    }
                }
            }
        }
    });
}

// Update Detail side-panel card
function updateInfoPanel(node) {
    const placeholder = document.getElementById('info-placeholder');
    const content = document.getElementById('info-content');
    
    placeholder.classList.add('hidden');
    content.classList.remove('hidden');
    
    // Hide map actions since we are looking at an actor node
    document.getElementById('section-map-actions').classList.add('hidden');
    
    // Hide city timeline and cover image and clean them up
    const cityTimelineSection = document.getElementById('section-city-timeline');
    if (cityTimelineSection) cityTimelineSection.classList.add('hidden');
    const cityImgSection = document.getElementById('section-city-image');
    if (cityImgSection) cityImgSection.classList.add('hidden');
    state.selectedCity = null;
    state.selectedCityConfession = null;
    if (state.charts.cityTimeline) {
        state.charts.cityTimeline.destroy();
        state.charts.cityTimeline = null;
    }
    
    // Select the correct GLB model for the actor
    let glbName = "book_closed.glb";
    if (node.type === 'censor') {
        if (node.is_jesuit) {
            // Alternate based on name length to keep it deterministic but varied
            glbName = (node.id.length % 2 === 0) ? "jesuit_christogram.glb" : "sacred_heart_emblem.glb";
        } else {
            glbName = "book_closed.glb";
        }
    } else if (node.type === 'publisher') {
        glbName = (node.degree && node.degree > 6) ? "printing_press.glb" : "book_open.glb";
    }
    
    const modelViewer = document.getElementById('sidebar-3d');
    const modelSection = document.getElementById('section-3d');
    if (modelViewer && modelSection) {
        modelViewer.src = `assets/glb/${glbName}`;
        modelSection.classList.remove('hidden');
    }
    
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
    
    // Show and render actor vetting activity timeline
    const actorTimelineSection = document.getElementById('section-actor-timeline');
    if (actorTimelineSection) {
        if (state.censorTimelines && state.censorTimelines[node.id]) {
            actorTimelineSection.classList.remove('hidden');
            renderActorTimelineChart(node.id, node.type);
        } else {
            actorTimelineSection.classList.add('hidden');
        }
    }
    
    // Show and render actor connections list
    const connSection = document.getElementById('section-connections');
    const connList = document.getElementById('info-connections-list');
    if (connSection && connList && state.networkData) {
        connSection.classList.remove('hidden');
        connList.innerHTML = '';
        
        // Find all links related to this node in networkData
        const allLinks = state.networkData.links.filter(l => {
            const sId = typeof l.source === 'object' ? l.source.id : l.source;
            const tId = typeof l.target === 'object' ? l.target.id : l.target;
            return sId === node.id || tId === node.id;
        });
        
        // Map to structured partners list
        const partners = allLinks.map(l => {
            const sId = typeof l.source === 'object' ? l.source.id : l.source;
            const tId = typeof l.target === 'object' ? l.target.id : l.target;
            const partnerId = sId === node.id ? tId : sId;
            const partnerNode = state.networkData.nodes.find(n => n.id === partnerId);
            return {
                id: partnerId,
                city: partnerNode ? (getNodeCity(partnerNode) || 'Unknown') : 'Unknown',
                weight: l.weight,
                isVisible: l.weight >= state.networkThreshold
            };
        });
        
        // Sort by weight descending
        partners.sort((a, b) => b.weight - a.weight);
        
        // Render list items
        partners.forEach(p => {
            const li = document.createElement('li');
            li.className = `connection-item ${p.isVisible ? '' : 'low-weight-link'}`;
            li.innerHTML = `
                <div>
                    <span class="connection-partner">${p.id}</span>
                    <span class="connection-city">(${p.city})</span>
                </div>
                <span class="connection-weight">${p.weight} ${p.weight === 1 ? 'book' : 'books'}</span>
            `;
            connList.appendChild(li);
        });
    }
}

// Reset all panels
function resetVisualization() {
    state.selectedNode = null;
    state.highlightCity = null;
    document.getElementById('search-input').value = '';
    
    // Hide details panel
    document.getElementById('info-placeholder').classList.remove('hidden');
    document.getElementById('info-content').classList.add('hidden');
    document.getElementById('section-map-actions').classList.add('hidden');
    
    // Hide connections section
    const connSection = document.getElementById('section-connections');
    if (connSection) connSection.classList.add('hidden');
    
    // Hide 3D view
    const modelViewer = document.getElementById('sidebar-3d');
    const modelSection = document.getElementById('section-3d');
    if (modelSection) modelSection.classList.add('hidden');
    if (modelViewer) modelViewer.removeAttribute('src');
    
    // Hide and clear city timeline chart and cover image
    const cityTimelineSection = document.getElementById('section-city-timeline');
    if (cityTimelineSection) cityTimelineSection.classList.add('hidden');
    const cityImgSection = document.getElementById('section-city-image');
    if (cityImgSection) cityImgSection.classList.add('hidden');
    state.selectedCity = null;
    state.selectedCityConfession = null;
    if (state.charts.cityTimeline) {
        state.charts.cityTimeline.destroy();
        state.charts.cityTimeline = null;
    }
    
    // Hide and clear actor timeline chart
    const actorTimelineSection = document.getElementById('section-actor-timeline');
    if (actorTimelineSection) actorTimelineSection.classList.add('hidden');
    if (state.charts.actorTimeline) {
        state.charts.actorTimeline.destroy();
        state.charts.actorTimeline = null;
    }
    
    // Clear geographic flow lines
    if (state.mapLines && state.map) {
        state.mapLines.forEach(l => state.map.removeLayer(l));
        state.mapLines = [];
    }
    
    // Reset network highlights
    state.highlightCity = null;
    updateNetworkHighlights();
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
    state.zoom = d3.zoom()
        .extent([[0, 0], [width, height]])
        .scaleExtent([0.15, 6])
        .on("zoom", ({transform}) => {
            state.gContainer.attr("transform", transform);
        });
        
    state.svg.call(state.zoom);
    
    updateNetworkGraph();
}

function updateNetworkGraph() {
    if (!state.networkData) return;
    
    const container = document.getElementById('network-container');
    const width = container ? container.clientWidth : 800;
    const height = container ? container.clientHeight : 600;
    
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
        .call(drag())
        .on("click", (e, d) => {
            selectNode(d.id);
            e.stopPropagation();
        });
        
    // Interactive hover triggers
    const selectedNodeId = state.selectedNode;
    node.on("mouseover", (e, d) => {
        // Highlight active connections
        state.selectedNode = d.id;
        updateNetworkHighlights();
        
        // Show tooltip
        const nodeCity = getNodeCity(d) || 'Unknown';
        const nodeType = d.type === 'censor' ? (d.is_jesuit ? 'Jesuit Censor' : 'Censor') : 'Publisher/Printer';
        const tooltip = document.getElementById('network-tooltip');
        tooltip.innerHTML = `
            <div style="font-weight: 700; font-size:13px; color:#ffffff; margin-bottom:4px;">${d.id}</div>
            <div style="font-size:11px; color:#94a3b8; margin-bottom:2px;"><strong style="color:#cbd5e1;">Type:</strong> ${nodeType}</div>
            <div style="font-size:11px; color:#94a3b8; margin-bottom:2px;"><strong style="color:#cbd5e1;">City:</strong> ${nodeCity}</div>
            <div style="font-size:11px; color:#94a3b8;"><strong style="color:#cbd5e1;">Connections:</strong> ${d.degree} nodes</div>
        `;
        tooltip.classList.remove('hidden');
    })
    .on("mousemove", (e) => {
        const tooltip = document.getElementById('network-tooltip');
        const container = document.getElementById('network-container');
        const cRect = container.getBoundingClientRect();
        tooltip.style.left = (e.clientX - cRect.left + 15) + 'px';
        tooltip.style.top = (e.clientY - cRect.top + 15) + 'px';
    })
    .on("mouseout", () => {
        state.selectedNode = selectedNodeId;
        updateNetworkHighlights();
        document.getElementById('network-tooltip').classList.add('hidden');
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
    
    // Update selections
    updateNetworkHighlights();
}

// Drag & Drop handlers
function drag() {
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
    
    // Load historical HRE borders GeoJSON
    fetch('data/hre_boundary.geojson?v=' + Date.now())
        .then(response => response.json())
        .then(data => {
            L.geoJSON(data, {
                style: {
                    color: '#b5912b', // Weathered gold
                    weight: 1.5,
                    dashArray: '6, 10',
                    fillColor: '#b5912b',
                    fillOpacity: 0.015,
                    interactive: false // Clicks pass through to city markers
                }
            }).addTo(state.map);
        })
        .catch(err => console.error("Error loading HRE boundary GeoJSON:", err));
        
    updateMapMarkers();
}

// Get color hex code for a city confession
function getConfessionColor(confession) {
    if (confession === "Catholic") return "#d4af37"; // Gold
    if (confession === "Protestant") return "#5b21b6"; // Deep Purple
    return "#94a3b8"; // Mixed / Gray
}

// Aggregate city printing count decade-over-decade from 1500 to 1790
function getCityDecadeCounts(city) {
    const decades = [];
    for (let d = 1500; d <= 1790; d += 10) {
        decades.push(d);
    }
    const counts = Array(decades.length).fill(0);
    
    if (state.timelineData) {
        state.timelineData.forEach(row => {
            const yr = parseInt(row["year"]);
            if (yr >= 1500 && yr < 1800 && row["city"] === city) {
                const decadeIndex = Math.floor((yr - 1500) / 10);
                counts[decadeIndex] += parseInt(row["count"]) || 0;
            }
        });
    }
    return { decades, counts };
}

// Render/Update the sidebar line chart for a selected city
function updateCityTimelineChart(city, activeDecade, confession) {
    const confessionColor = getConfessionColor(confession);
    const { decades, counts } = getCityDecadeCounts(city);
    const activeIndex = decades.indexOf(activeDecade);
    
    // Clear and reveal the container
    const section = document.getElementById('section-city-timeline');
    if (section) section.classList.remove('hidden');
    
    const canvas = document.getElementById('city-timeline-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // If a chart already exists, destroy it to avoid visual bugs
    if (state.charts.cityTimeline) {
        state.charts.cityTimeline.destroy();
    }
    
    // Build dynamic point styles
    const pointRadii = counts.map((_, idx) => idx === activeIndex ? 6 : 0);
    const pointBgColors = counts.map((_, idx) => idx === activeIndex ? '#ffffff' : confessionColor);
    const pointBorderColors = counts.map((_, idx) => idx === activeIndex ? confessionColor : 'transparent');
    const pointBorderWidths = counts.map((_, idx) => idx === activeIndex ? 3 : 0);
    
    // Convert color hex to rgba for the line fill area
    const fillRgba = confession === "Catholic" ? 'rgba(212, 175, 55, 0.15)' : 
                     (confession === "Protestant" ? 'rgba(91, 33, 182, 0.15)' : 'rgba(148, 163, 184, 0.15)');
    
    state.charts.cityTimeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: decades.map(d => `${d}s`),
            datasets: [{
                label: 'Publications',
                data: counts,
                borderColor: confessionColor,
                backgroundColor: fillRgba,
                borderWidth: 2.5,
                fill: true,
                tension: 0.25,
                pointRadius: pointRadii,
                pointHoverRadius: pointRadii.map(r => r > 0 ? 8 : 4),
                pointBackgroundColor: pointBgColors,
                pointBorderColor: pointBorderColors,
                pointBorderWidth: pointBorderWidths
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y} titles`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Inter', size: 9 },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 5
                    }
                },
                y: {
                    grid: { color: '#1e293b' },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Inter', size: 9 },
                        maxTicksLimit: 3
                    }
                }
            }
        }
    });
}

// Synchronize chart highlight indicator on timeline dragging
function updateCityChartHighlight(activeDecade) {
    if (!state.charts.cityTimeline || !state.selectedCity) return;
    
    const chart = state.charts.cityTimeline;
    const decades = [];
    for (let d = 1500; d <= 1790; d += 10) {
        decades.push(d);
    }
    const activeIndex = decades.indexOf(activeDecade);
    const confessionColor = getConfessionColor(state.selectedCityConfession);
    
    const dataset = chart.data.datasets[0];
    dataset.pointRadius = dataset.data.map((_, idx) => idx === activeIndex ? 6 : 0);
    dataset.pointHoverRadius = dataset.data.map((_, idx) => idx === activeIndex ? 8 : 4);
    dataset.pointBackgroundColor = dataset.data.map((_, idx) => idx === activeIndex ? '#ffffff' : confessionColor);
    dataset.pointBorderColor = dataset.data.map((_, idx) => idx === activeIndex ? confessionColor : 'transparent');
    dataset.pointBorderWidth = dataset.data.map((_, idx) => idx === activeIndex ? 3 : 0);
    
    chart.update('none'); // Instantaneous update without animation
}

function updateMapMarkers() {
    if (!state.timelineData || !state.map) return;
    
    const targetDecade = state.activeYear;
    
    // Synchronize active selection timeline chart highlight if visible
    updateCityChartHighlight(targetDecade);
    
    // Clear old lines
    if (state.mapLines) {
        state.mapLines.forEach(l => state.map.removeLayer(l));
        state.mapLines = [];
    }
    
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
    
    // For each city in cityCoordinates, update/create/remove its marker and prev-decade-ring
    for (const city of Object.keys(cityCoordinates)) {
        const coords = cityCoordinates[city];
        const data = cityTotals[city];
        const prevData = prevCityTotals[city];
        
        const isVisible = data && data.count >= minVolume;
        
        if (isVisible) {
            const currentZoom = state.map.getZoom();
            const zoomFactor = Math.pow(1.5, currentZoom - 6);
            let radius = (Math.pow(data.count, 0.35) * 1.1 + 1.2) * zoomFactor;
            const maxCap = Math.max(8, currentZoom * 4.5);
            radius = Math.max(2.5, Math.min(maxCap, radius));
            const iconSize = radius * 2.2;
            
            let prevRadius = 0;
            if (prevData && prevData.count >= minVolume) {
                prevRadius = (Math.pow(prevData.count, 0.35) * 1.1 + 1.2) * zoomFactor;
                prevRadius = Math.max(2.5, Math.min(maxCap, prevRadius));
            }
            
            const isComparisonAvailable = prevRadius > 0;
            const isSignificantChange = isComparisonAvailable && Math.abs(radius - prevRadius) > 0.5;
            const isGrowth = isSignificantChange && radius > prevRadius;
            const isDecline = isSignificantChange && prevRadius > radius;
            
            let glowClass = "glow-neutral";
            if (isSignificantChange) {
                if (isGrowth) {
                    glowClass = "glow-growth";
                } else if (isDecline) {
                    glowClass = "glow-decline";
                }
            }
            
            let markerClasses = [glowClass];
            if (data.count > 500) {
                markerClasses.push('pulse-marker');
            }
            
            let color = "#94a3b8";
            if (data.confession === "Catholic") color = "#d4af37";
            else if (data.confession === "Protestant") color = "#5b21b6";
            
            let markerImg = "assets/markers/mixed_marker.jpg";
            if (data.confession === "Catholic") markerImg = "assets/markers/catholic_marker.jpg";
            else if (data.confession === "Protestant") markerImg = "assets/markers/protestant_marker.jpg";
            
            const tooltipHTML = `
                <div style="font-family: inherit; font-size:12px;">
                    <strong style="font-size:13px; color:#ffffff;">${city}</strong><br/>
                    <span style="color:#94a3b8; font-weight:600;">Confession:</span> ${data.confession}<br/>
                    <span style="color:#94a3b8; font-weight:600;">Decade Output:</span> ${data.count} titles
                </div>
            `;
            
            let marker = state.activeCityMarkers[city];
            if (marker) {
                marker._shouldRemove = false;
                if (!state.map.hasLayer(marker)) {
                    marker.addTo(state.map);
                }
                
                const icon = marker.options.icon;
                if (icon && icon.options) {
                    icon.options.iconSize = [iconSize, iconSize];
                    icon.options.iconAnchor = [iconSize / 2, iconSize / 2];
                }
                
                const el = marker.getElement();
                if (el) {
                    el.style.width = `${iconSize}px`;
                    el.style.height = `${iconSize}px`;
                    el.style.marginLeft = `${-iconSize / 2}px`;
                    el.style.marginTop = `${-iconSize / 2}px`;
                    el.style.opacity = '1';
                    
                    const wrapper = el.querySelector('.custom-map-marker-wrapper');
                    if (wrapper) {
                        wrapper.className = `custom-map-marker-wrapper ${markerClasses.join(' ')}`;
                        wrapper.style.width = '100%';
                        wrapper.style.height = '100%';
                    }
                    const img = el.querySelector('img');
                    if (img) {
                        img.src = markerImg;
                    }
                }
                
                marker.setTooltipContent(tooltipHTML);
            } else {
                const divIcon = L.divIcon({
                    html: `<div class="custom-map-marker-wrapper ${markerClasses.join(' ')}" style="width:${iconSize}px; height:${iconSize}px;">
                             <div class="marker-image-wrapper" style="width:100%; height:100%;">
                                 <img src="${markerImg}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">
                             </div>
                           </div>`,
                    className: 'custom-map-marker',
                    iconSize: [iconSize, iconSize],
                    iconAnchor: [iconSize / 2, iconSize / 2]
                });
                
                marker = L.marker(coords, {
                    icon: divIcon
                }).addTo(state.map);
                
                marker.bindTooltip(tooltipHTML, { direction: 'top', offset: [0, -10] });
                
                marker.on('click', () => {
                    state.selectedCity = city;
                    state.selectedCityConfession = data.confession;
                    updateCityTimelineChart(city, targetDecade, data.confession);
                    
                    state.selectedNode = null;
                    updateNetworkHighlights();
                    const actorTimelineSection = document.getElementById('section-actor-timeline');
                    if (actorTimelineSection) actorTimelineSection.classList.add('hidden');
                    if (state.charts.actorTimeline) {
                        state.charts.actorTimeline.destroy();
                        state.charts.actorTimeline = null;
                    }
                    
                    const connSection = document.getElementById('section-connections');
                    if (connSection) connSection.classList.add('hidden');
                    
                    const cityAssetMap = {
                        "Leipzig": "leipzig",
                        "Frankfurt am Main": "frankfurt",
                        "Köln": "cologne",
                        "München": "munich",
                        "Wien": "vienna"
                    };
                    const assetName = cityAssetMap[city];
                    const cityImgSection = document.getElementById('section-city-image');
                    const cityImg = document.getElementById('sidebar-city-image');
                    
                    if (assetName && cityImg && cityImgSection) {
                        cityImg.src = `assets/hubs/city_${assetName}.jpg`;
                        cityImgSection.classList.remove('hidden');
                    } else if (cityImgSection) {
                        cityImgSection.classList.add('hidden');
                    }
                    
                    // Show city 3D model
                    const cityGLBMap = {
                        "Leipzig": "coin_leipzig.glb",
                        "München": "coin_munich.glb",
                        "Munich": "coin_munich.glb",
                        "Frankfurt am Main": "coin_imperial_eagle.glb",
                        "Wien": "coin_imperial_eagle.glb",
                        "Vienna": "coin_imperial_eagle.glb"
                    };
                    const glbName = cityGLBMap[city] || "book_closed.glb";
                    const modelViewer = document.getElementById('sidebar-3d');
                    const modelSection = document.getElementById('section-3d');
                    if (modelViewer && modelSection) {
                        modelViewer.src = `assets/glb/${glbName}`;
                        modelSection.classList.remove('hidden');
                    }
                    
                    const sidePanel = document.getElementById('info-content');
                    const placeholder = document.getElementById('info-placeholder');
                    
                    placeholder.classList.add('hidden');
                    sidePanel.classList.remove('hidden');
                    
                    document.getElementById('info-name').innerText = city;
                    
                    if (state.mapLines) {
                        state.mapLines.forEach(l => state.map.removeLayer(l));
                    }
                    state.mapLines = [];
                    
                    if (state.networkData) {
                        const cityNodes = state.networkData.nodes.filter(n => getNodeCity(n) === city);
                        const cityNodeIds = new Set(cityNodes.map(n => n.id));
                        const drawnDestinations = new Set();
                        
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
                                    if (drawnDestinations.has(destCity)) return;
                                    drawnDestinations.add(destCity);
                                    
                                    const destCoords = cityCoordinates[destCity];
                                    const lineColor = data.confession === "Catholic" ? '#38bdf8' : 
                                                      (data.confession === "Protestant" ? '#5b21b6' : '#cbd5e1');
                                    
                                    const polyline = L.polyline([coords, destCoords], {
                                        color: lineColor,
                                        weight: 3.5,
                                        opacity: 0.75,
                                        dashArray: '8, 12',
                                        className: 'flow-polyline'
                                    }).addTo(state.map);
                                    
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
                    
                    const mapActions = document.getElementById('section-map-actions');
                    mapActions.classList.remove('hidden');
                    
                    const highlightBtn = document.getElementById('btn-highlight-city-actors');
                    const newHighlightBtn = highlightBtn.cloneNode(true);
                    highlightBtn.parentNode.replaceChild(newHighlightBtn, highlightBtn);
                    
                    newHighlightBtn.innerText = `Highlight ${city} Actors in Network`;
                    newHighlightBtn.addEventListener('click', () => {
                        const netTabBtn = document.querySelector('[data-tab="network-tab"]');
                        if (netTabBtn) netTabBtn.click();
                        document.getElementById('search-input').value = '';
                        state.searchQuery = '';
                        state.selectedNode = null;
                        state.highlightCity = city;
                        updateNetworkHighlights();
                    });
                });
                
                state.activeCityMarkers[city] = marker;
            }
            
            const hasRing = isSignificantChange;
            let ringMarker = state.prevDecadeRings[city];
            
            if (hasRing) {
                const prevIconSize = prevRadius * 2.2;
                const ringClasses = [isGrowth ? 'prev-ring-growth' : 'prev-ring-decline'];
                
                if (ringMarker) {
                    ringMarker._shouldRemove = false;
                    if (!state.map.hasLayer(ringMarker)) {
                        ringMarker.addTo(state.map);
                    }
                    
                    const icon = ringMarker.options.icon;
                    if (icon && icon.options) {
                        icon.options.iconSize = [prevIconSize, prevIconSize];
                        icon.options.iconAnchor = [prevIconSize / 2, prevIconSize / 2];
                    }
                    
                    const el = ringMarker.getElement();
                    if (el) {
                        el.style.width = `${prevIconSize}px`;
                        el.style.height = `${prevIconSize}px`;
                        el.style.marginLeft = `${-prevIconSize / 2}px`;
                        el.style.marginTop = `${-prevIconSize / 2}px`;
                        el.style.opacity = '1';
                        
                        const ring = el.querySelector('.prev-decade-ring');
                        if (ring) {
                            ring.className = `prev-decade-ring ${ringClasses.join(' ')}`;
                            ring.style.width = '100%';
                            ring.style.height = '100%';
                        }
                    }
                } else {
                    const prevDivIcon = L.divIcon({
                        html: `<div class="prev-decade-ring ${ringClasses.join(' ')}" style="width:${prevIconSize}px; height:${prevIconSize}px;"></div>`,
                        className: 'custom-prev-ring',
                        iconSize: [prevIconSize, prevIconSize],
                        iconAnchor: [prevIconSize / 2, prevIconSize / 2]
                    });
                    
                    ringMarker = L.marker(coords, {
                        icon: prevDivIcon,
                        zIndexOffset: -100,
                        interactive: false
                    }).addTo(state.map);
                    
                    state.prevDecadeRings[city] = ringMarker;
                }
            } else {
                if (ringMarker) {
                    ringMarker._shouldRemove = true;
                    const el = ringMarker.getElement();
                    if (el) {
                        el.style.width = '0px';
                        el.style.height = '0px';
                        el.style.marginLeft = '0px';
                        el.style.marginTop = '0px';
                        el.style.opacity = '0';
                        const currentRingMarker = ringMarker;
                        setTimeout(() => {
                            if (currentRingMarker._shouldRemove) {
                                state.map.removeLayer(currentRingMarker);
                            }
                        }, 600);
                    } else {
                        state.map.removeLayer(ringMarker);
                    }
                    delete state.prevDecadeRings[city];
                }
            }
            
        } else {
            const marker = state.activeCityMarkers[city];
            if (marker) {
                marker._shouldRemove = true;
                const el = marker.getElement();
                if (el) {
                    el.style.width = '0px';
                    el.style.height = '0px';
                    el.style.marginLeft = '0px';
                    el.style.marginTop = '0px';
                    el.style.opacity = '0';
                    const currentMarker = marker;
                    setTimeout(() => {
                        if (currentMarker._shouldRemove) {
                            state.map.removeLayer(currentMarker);
                        }
                    }, 600);
                } else {
                    state.map.removeLayer(marker);
                }
                delete state.activeCityMarkers[city];
            }
            
            const ringMarker = state.prevDecadeRings[city];
            if (ringMarker) {
                ringMarker._shouldRemove = true;
                const el = ringMarker.getElement();
                if (el) {
                    el.style.width = '0px';
                    el.style.height = '0px';
                    el.style.marginLeft = '0px';
                    el.style.marginTop = '0px';
                    el.style.opacity = '0';
                    const currentRingMarker = ringMarker;
                    setTimeout(() => {
                        if (currentRingMarker._shouldRemove) {
                            state.map.removeLayer(currentRingMarker);
                        }
                    }, 600);
                } else {
                    state.map.removeLayer(ringMarker);
                }
                delete state.prevDecadeRings[city];
            }
        }
    }
    
    // If a city is currently selected, dynamically update its sidebar text for the new active decade
    if (state.selectedCity) {
        const city = state.selectedCity;
        const data = cityTotals[city] || { count: 0, confession: state.selectedCityConfession };
        const prevData = prevCityTotals[city];
        
        const bioText = document.getElementById('info-biography');
        if (bioText) {
            let comparisonText = "";
            if (prevData && prevData.count > 0) {
                const diff = data.count - prevData.count;
                const percent = prevData.count > 0 ? ((diff / prevData.count) * 100).toFixed(1) : "0.0";
                const verb = diff >= 0 ? "increased" : "decreased";
                const changeColor = diff >= 0 ? "#10b981" : "#ef4444";
                const sign = diff >= 0 ? "+" : "";
                comparisonText = ` This represents a <strong style="color: ${changeColor};">${sign}${percent}%</strong> output change (${verb} by ${Math.abs(diff)} titles) compared to the previous decade (${previousDecade}s: ${prevData.count} titles).`;
            }
            
            bioText.innerHTML = `
                Historically classified as a <strong>${data.confession}</strong> printing hub.<br/><br/>
                During the <strong>${targetDecade}s</strong>, publishers in ${city} released a total of <strong>${data.count}</strong> cataloged titles in our database.${comparisonText}
            `;
        }
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

// ==========================================================================
// PORTRAIT / COIN CABINET TEAM VIEW CONTROLLER
// ==========================================================================
const TEAM_MEMBERS = [
    {
        name: "Thea Lindquist",
        role: "Team Lead & Cultural Heritage Expert",
        bio: "Focuses on cultural heritage data structures, matching research questions to historical and digital humanities methodologies, data sources, integrations and enhancements for humanities applications, and off-kilter humor...",
        model: "assets/glb/coin_imperial_eagle.glb"
    },
    {
        name: "Eetu Mäkelä",
        role: "Team Lead & Computing Coordinator",
        bio: "Provides organisational support, data access, compute access, and matching research questions to algorithms. Expert in all kinds of computing, machine learning, and digital humanities data wrangling...",
        model: "assets/glb/coin_imperial_eagle.glb"
    },
    {
        name: "Duong Nguyen",
        role: "Network Analyst & Statistician",
        bio: "Specializes in network analysis (clustering, simulations, hypothesis testing, multivariate model, event study), natural language processing (NER, sentiment analysis, topic modeling), programming, and data visualization...",
        model: "assets/glb/coin_leipzig.glb"
    },
    {
        name: "Harri",
        role: "Data Science Developer",
        bio: "Master's student in data science. Expert in software development, full stack web development (React), interactive data visualization (Python), LLMs, and prompt engineering...",
        model: "assets/glb/coin_leipzig.glb"
    },
    {
        name: "Aisvarya",
        role: "AI Engineer & Researcher",
        bio: "Focuses on Artificial Intelligence, Large Language Models, Local Models, Hallucination Mitigation, Prompt Engineering, Machine Learning, Cyber Security, Privacy, Qualitative Research and Analysis, and Human Computer Interaction...",
        model: "assets/glb/coin_leipzig.glb"
    },
    {
        name: "Sophia",
        role: "DH Data Pipeline Specialist",
        bio: "MA student in DH. Works on natural language processing (sentiment/emotion/bias detection), digital literary studies & corpus analysis, Python, data pipelines, and LLM data quality (hallucinations, trustworthiness)...",
        model: "assets/glb/coin_munich.glb"
    },
    {
        name: "Wanshu",
        role: "Early Modern Literature Scholar",
        bio: "Pursuing a Master's in English Literature. Combines close reading with computational methods such as Topic Modeling (GDSL), Sentiment Analysis, Voyant Tools, CLIC-based analysis, TEI annotation, and metadata-based archival work...",
        model: "assets/glb/coin_munich.glb"
    },
    {
        name: "Joonas Luukkonen",
        role: "Cognitive Linguist & Web Developer",
        bio: "BA student in English and Culture with minors in Japanese, Data Science, and Computer Science. Researches the intersection of language, cognition, and technology, specializing in digital humanities, metaphor analysis, and NLP...",
        model: "assets/glb/medal_jonas_luukkonen.glb"
    },
    {
        name: "Annalisa",
        role: "Medieval & Neo-Latin Text Specialist",
        bio: "PhD student in Medieval and Neo-Latin Studies. Focuses on text editing, medieval and modern European literature, early modern scholarly networks, TEI/XML schema modeling, event modeling, and AI-assisted data modeling...",
        model: "assets/glb/coin_munich.glb"
    },
    {
        name: "Giacomo",
        role: "Digital History Researcher",
        bio: "PhD candidate in Digital History. Researches rumour repetition & epistemic contamination, 19th-century newspapers rumours, and NLP pipelines in Python, HTML, and R...",
        model: "assets/glb/coin_munich.glb"
    },
    {
        name: "Udita",
        role: "Algorithm & Systems Analyst",
        bio: "MA student in CS, focusing on algorithm, logic, and computation. Researches programming languages, software development, network analysis, complex systems, and digital humanities literature review...",
        model: "assets/glb/coin_leipzig.glb"
    }
];

function initTeamCabinet() {
    const grid = document.getElementById('team-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    TEAM_MEMBERS.forEach(member => {
        const card = document.createElement('div');
        card.className = 'team-card';
        card.innerHTML = `
            <div class="coin-viewer-wrapper" title="Click to flip the coin!">
                <model-viewer 
                    src="${member.model}" 
                    auto-rotate 
                    camera-controls 
                    disable-zoom
                    disable-pan
                    shadow-intensity="0.6"
                    style="width: 100%; height: 100%;"
                    class="team-coin-model">
                </model-viewer>
            </div>
            <h3>${member.name}</h3>
            <div class="team-role">${member.role}</div>
            <p class="team-bio">${member.bio}</p>
        `;
        
        const wrapper = card.querySelector('.coin-viewer-wrapper');
        wrapper.addEventListener('click', () => {
            if (wrapper.classList.contains('flipping')) return;
            wrapper.classList.add('flipping');
            setTimeout(() => {
                wrapper.classList.remove('flipping');
            }, 1000);
        });
        
        grid.appendChild(card);
    });
}
