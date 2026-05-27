// city_trade.js

let giniChart = null;
let clusteringChart = null;
let distanceChart = null;
let comparisonChart = null;

let metadata = {};
const timeWindows = [
    "1500-1529", "1530-1559", "1560-1589", "1590-1619", 
    "1620-1649", "1650-1679", "1680-1709", "1710-1739", 
    "1740-1769", "1770-1799"
];

// Color palette for comparative lines
const colors = [
    "#38bdf8", "#fb7185", "#34d399", "#fbbf24", "#a78bfa", 
    "#f472b6", "#2dd4bf", "#fb923c", "#60a5fa", "#cbd5e1"
];

// DOM elements
const citySelector = document.getElementById("city-selector");
const comparisonChecklist = document.getElementById("comparison-checklist");

// Info panel elements
const infoCityName = document.getElementById("info-city-name");
const metaTerritory = document.getElementById("meta-territory");
const metaUni = document.getElementById("meta-uni");
const metaUniYear = document.getElementById("meta-uni-year");
const metaUniReligion = document.getElementById("meta-uni-religion");
const metaCityReligion = document.getElementById("meta-city-religion");
const metaCrises = document.getElementById("meta-crises");

// Chart configuration options
const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            labels: {
                color: "#94a3b8",
                font: { family: "Inter", size: 11 }
            }
        }
    },
    scales: {
        x: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "#64748b", font: { family: "Inter", size: 10 } }
        },
        y: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "#64748b", font: { family: "Inter", size: 10 } }
        }
    }
};

// Start application
window.addEventListener("DOMContentLoaded", async () => {
    await loadMetadata();
    setupChecklist();
    
    // Initial loads
    const initialCity = citySelector.value;
    loadCityMetadata(initialCity);
    await loadCityStats(initialCity);
    await updateComparisonChart();
    
    // Listeners
    citySelector.addEventListener("change", async (e) => {
        const cityId = e.target.value;
        loadCityMetadata(cityId);
        await loadCityStats(cityId);
    });
});

// Load metadata JSON
async function loadMetadata() {
    try {
        const res = await fetch("./data/work/city_metadata.json");
        metadata = await res.json();
    } catch (err) {
        console.error("Failed to load city metadata:", err);
    }
}

// Populate the checklist in sidebar
function setupChecklist() {
    const defaultCompared = ["jena", "leipzig", "wittenberg", "köln"];
    const cities = Array.from(citySelector.options).map(opt => ({ id: opt.value, name: opt.text }));
    
    comparisonChecklist.innerHTML = "";
    cities.forEach(city => {
        const label = document.createElement("label");
        label.className = "checklist-item";
        
        const isChecked = defaultCompared.includes(city.id) ? "checked" : "";
        label.innerHTML = `
            <input type="checkbox" value="${city.id}" ${isChecked}>
            <span>${city.name}</span>
        `;
        
        // Listener to refresh compare chart on toggle
        label.querySelector("input").addEventListener("change", updateComparisonChart);
        comparisonChecklist.appendChild(label);
    });
}

// Display city metadata in sidebar
function loadCityMetadata(cityId) {
    const data = metadata[cityId] || {
        name: citySelector.options[citySelector.selectedIndex].text,
        territory: "Unknown",
        university: "No",
        uni_year: "-",
        uni_religion: "-",
        city_religion: "-",
        crises: "No crisis context registered."
    };
    
    infoCityName.innerText = data.name;
    metaTerritory.innerText = data.territory;
    
    // Uni status check
    const isUni = data.university && (data.university.toLowerCase().includes("yes") || data.university === "Yes");
    metaUni.innerText = isUni ? "Yes" : "No";
    metaUniYear.innerText = data.uni_year && data.uni_year !== "NaN" ? data.uni_year : "-";
    metaUniReligion.innerText = data.uni_religion && data.uni_religion !== "NaN" ? data.uni_religion : "-";
    metaCityReligion.innerText = data.city_religion && data.city_religion !== "NaN" ? data.city_religion : "-";
    
    // Crises box
    metaCrises.innerHTML = data.crises ? data.crises.replace(/\\/g, "") : "No details available.";
}

// Fetch stats files and draw charts
async function loadCityStats(cityId) {
    try {
        const res = await fetch(`./data/work/${cityId}_stats.json`);
        const stats = await res.json();
        
        // Extract metrics
        const pubGinis = [];
        const authGinis = [];
        const clusteringRatios = [];
        const distanceRatios = [];
        
        timeWindows.forEach(win => {
            const data = stats[win] || {};
            
            // Gini
            pubGinis.push(data.updeg_gini !== null ? data.updeg_gini : null);
            authGinis.push(data.lowdeg_gini !== null ? data.lowdeg_gini : null);
            
            // Clustering ratio
            const cRatio = (data.clustering && data.clustering.coef_mean) ? data.clustering.coef_mean : null;
            clusteringRatios.push(cRatio);
            
            // Distance ratio
            const dRatio = (data.distance && data.distance.coef_mean) ? data.distance.coef_mean : null;
            distanceRatios.push(dRatio);
        });
        
        // Render or update charts
        renderGiniChart(pubGinis, authGinis);
        renderRatioChart("chart-clustering", clusteringRatios, "Clustering Ratio (Obs / Rand)", "clusteringChart", "#34d399");
        renderRatioChart("chart-distance", distanceRatios, "Avg Distance Ratio (Obs / Rand)", "distanceChart", "#fb7185");
        
    } catch (err) {
        console.error(`Failed to load stats for ${cityId}:`, err);
    }
}

// Draw Gini Chart
function renderGiniChart(pubGinis, authGinis) {
    const ctx = document.getElementById("chart-gini").getContext("2d");
    
    if (giniChart) {
        giniChart.destroy();
    }
    
    giniChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: timeWindows,
            datasets: [
                {
                    label: "Publishers (Degree Monopoly)",
                    data: pubGinis,
                    borderColor: "#38bdf8",
                    backgroundColor: "rgba(56, 189, 248, 0.1)",
                    borderWidth: 2,
                    tension: 0.25,
                    spanGaps: true
                },
                {
                    label: "Authors (Degree Inequality)",
                    data: authGinis,
                    borderColor: "#a78bfa",
                    backgroundColor: "rgba(167, 139, 250, 0.1)",
                    borderWidth: 2,
                    tension: 0.25,
                    spanGaps: true
                }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    min: 0,
                    max: 1.0
                }
            }
        }
    });
}

// Helper to draw single ratio line charts
function renderRatioChart(canvasId, dataPoints, label, chartInstanceVar, color) {
    const ctx = document.getElementById(canvasId).getContext("2d");
    
    if (window[chartInstanceVar]) {
        window[chartInstanceVar].destroy();
    }
    
    window[chartInstanceVar] = new Chart(ctx, {
        type: "line",
        data: {
            labels: timeWindows,
            datasets: [{
                label: label,
                data: dataPoints,
                borderColor: color,
                backgroundColor: `${color}15`,
                borderWidth: 2,
                tension: 0.25,
                spanGaps: true
            }]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                annotation: {
                    // Draw a baseline helper at y = 1.0 (baseline compared to random model)
                    annotations: {
                        line1: {
                            type: "line",
                            yMin: 1.0,
                            yMax: 1.0,
                            borderColor: "rgba(255, 255, 255, 0.15)",
                            borderWidth: 1.5,
                            borderDash: [5, 5]
                        }
                    }
                }
            }
        }
    });
}

// Update the comparison chart based on checkbox states
async function updateComparisonChart() {
    const checkedBoxes = Array.from(comparisonChecklist.querySelectorAll("input:checked"));
    const selectedCities = checkedBoxes.map(cb => cb.value);
    
    const datasets = [];
    
    for (let i = 0; i < selectedCities.length; i++) {
        const cityId = selectedCities[i];
        const color = colors[i % colors.length];
        
        try {
            const res = await fetch(`./data/work/${cityId}_stats.json`);
            const stats = await res.json();
            
            const ginis = [];
            timeWindows.forEach(win => {
                const data = stats[win] || {};
                ginis.push(data.updeg_gini !== null ? data.updeg_gini : null);
            });
            
            const cityName = citySelector.querySelector(`option[value="${cityId}"]`).text;
            
            datasets.push({
                label: cityName,
                data: ginis,
                borderColor: color,
                backgroundColor: "transparent",
                borderWidth: 2,
                tension: 0.2,
                spanGaps: true
            });
            
        } catch (err) {
            console.error(`Failed to load comparison stats for ${cityId}:`, err);
        }
    }
    
    const ctx = document.getElementById("chart-compare-gini").getContext("2d");
    if (comparisonChart) {
        comparisonChart.destroy();
    }
    
    comparisonChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: timeWindows,
            datasets: datasets
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    min: 0,
                    max: 1.0
                }
            }
        }
    });
}
